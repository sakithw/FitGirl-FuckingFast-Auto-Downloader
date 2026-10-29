const { isSupportedUrl, parseFilePageUrl, detectCandidate, detectDownloadControl } = globalThis.FFAD.fuckingFast;
const { watchForCandidate } = globalThis.FFAD;
const { createAutoClickEngine, createDownloadController } = globalThis.FFAD;
const fixtureSelector = '[data-ffad-fixture-control="download"]';
const failures = [];
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function test(name, run) {
  try {
    await run();
    passed += 1;
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

async function fixture(name) {
  const response = await fetch(`../fixtures/${name}.html`);
  assert(response.ok, `Cannot load ${name} fixture`);
  const template = document.createElement("template");
  template.innerHTML = await response.text();
  return template.content;
}

async function mountedFixture(name) {
  const root = document.createElement("section");
  root.append(await fixture(name));
  document.body.append(root);
  return root;
}

const pageUrl = "https://fuckingfast.co/abc123#example.rar";
const pageWithoutFragment = "https://fuckingfast.co/abc123";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await test("exact HTTPS host is supported", () => {
  assert(isSupportedUrl("https://fuckingfast.co/f/example"), "Expected supported host");
  assert(isSupportedUrl("https://FUCKINGFAST.CO/"), "Hostnames should be case insensitive");
});

await test("host spoofing and other schemes are rejected", () => {
  for (const url of [
    "http://fuckingfast.co/f/example",
    "https://www.fuckingfast.co/f/example",
    "https://fuckingfast.co.evil.invalid/f/example",
    "https://evil.invalid/fuckingfast.co",
    "https://fuckingfast.co@evil.invalid/f/example",
    "https://user@fuckingfast.co/f/example",
    "https://fuckingfast.co:8443/f/example",
    "not a URL"
  ]) {
    assert(!isSupportedUrl(url), `Unexpected supported URL: ${url}`);
  }
});

await test("generic fixture selection remains opt-in", async () => {
  const root = await fixture("supported");
  const result = detectCandidate(root);
  assert(result.status === "unverified" && result.element === null, "Production must stay unverified");
});

await test("fixture candidate excludes an advertisement", async () => {
  const root = await fixture("supported");
  const result = detectCandidate(root, fixtureSelector);
  assert(result.status === "candidate" && result.count === 1, "Expected one fixture candidate");
  assert(result.element.hasAttribute("data-ffad-fixture-control"), "Wrong element selected");
});

await test("unsupported and missing fixtures have no candidate", async () => {
  for (const name of ["unsupported", "missing-button"]) {
    const result = detectCandidate(await fixture(name), fixtureSelector);
    assert(result.status === "missing" && result.element === null, `${name} should be missing`);
  }
});

await test("multiple candidates are ambiguous", async () => {
  const result = detectCandidate(await fixture("ambiguous-button"), fixtureSelector);
  assert(result.status === "ambiguous" && result.count === 2 && result.element === null,
    "Ambiguous candidates must not select an element");
});

await test("disabled controls are excluded", async () => {
  const root = await fixture("missing-button");
  const disabled = document.createElement("button");
  disabled.setAttribute("data-ffad-fixture-control", "download");
  disabled.setAttribute("aria-disabled", "true");
  root.append(disabled);
  assert(detectCandidate(root, fixtureSelector).status === "missing", "Disabled control was selected");
});

await test("dynamic insertion is detected once and observer cleans up", async () => {
  const root = await fixture("dynamic-button");
  const statuses = [];
  watchForCandidate(root, fixtureSelector, (result) => statuses.push(result.status),
    { debounceMs: 15, timeoutMs: 150 });
  const control = document.createElement("a");
  control.setAttribute("data-ffad-fixture-control", "download");
  control.textContent = "DOWNLOAD";
  root.querySelector("#fixture-slot").append(control);
  await delay(50);
  assert(statuses.join(",") === "missing,candidate", `Unexpected statuses: ${statuses}`);
  root.querySelector("#fixture-slot").append(document.createElement("span"));
  await delay(40);
  assert(statuses.length === 2, "Observer remained active after candidate");
});

await test("rapid mutations are debounced", async () => {
  const root = await fixture("dynamic-button");
  const statuses = [];
  const disconnect = watchForCandidate(root, fixtureSelector,
    (result) => statuses.push(result.status), { debounceMs: 25, timeoutMs: 150 });
  const slot = root.querySelector("#fixture-slot");
  slot.append(document.createElement("span"));
  await delay(5);
  slot.append(document.createElement("span"));
  await delay(5);
  slot.append(document.createElement("span"));
  await delay(45);
  disconnect();
  assert(statuses.join(",") === "missing,missing", `Unexpected debounce statuses: ${statuses}`);
});

await test("observer expires without a candidate", async () => {
  const root = await fixture("dynamic-button");
  const statuses = [];
  watchForCandidate(root, fixtureSelector, (result) => statuses.push(result.status),
    { debounceMs: 10, timeoutMs: 25 });
  await delay(40);
  root.querySelector("#fixture-slot").append(document.createElement("button"));
  await delay(30);
  assert(statuses.join(",") === "missing", "Observer did not expire");
});

await test("observer reports bounded lifecycle without page data", async () => {
  const root = await fixture("dynamic-button");
  const events = [];
  watchForCandidate(root, fixtureSelector, () => {},
    { debounceMs: 5, timeoutMs: 20, onActivity: (event) => events.push(event) });
  root.querySelector("#fixture-slot").append(document.createElement("span"));
  await delay(35);
  assert(events.join(",") === "started,recheck,timeout", `Unexpected observer events: ${events}`);
});

await test("observed valid page yields one read-only candidate", async () => {
  const root = await mountedFixture("observed-valid");
  let clicks = 0;
  root.addEventListener("click", () => { clicks += 1; });
  const result = detectDownloadControl(root, pageUrl);
  assert(result.status === "candidate" && result.count === 1, "Expected one valid candidate");
  assert(result.element.getAttribute("hx-post") === "/f/abc123/go", "Wrong control selected");
  assert(clicks === 0, "Detection activated a control");
  root.remove();
});

await test("invalid hostname and unsupported routes are rejected", async () => {
  const root = await mountedFixture("observed-valid");
  assert(detectDownloadControl(root, "https://fuckingfast.co.evil.invalid/abc123#example.rar").status === "unsupported-host", "Spoofed host accepted");
  for (const url of ["https://fuckingfast.co/", "https://fuckingfast.co/f/abc123#example.rar"]) {
    assert(detectDownloadControl(root, url).status === "unsupported-page", `Unexpected page accepted: ${url}`);
  }
  root.remove();
});

await test("file pages work with or without fragments and with optional queries", async () => {
  const root = await mountedFixture("observed-valid");
  for (const url of [pageUrl, pageWithoutFragment,
    "https://fuckingfast.co/abc123?source=test",
    "https://fuckingfast.co/abc123?source=test#example.rar"]) {
    assert(detectDownloadControl(root, url).status === "candidate", `Legitimate URL rejected: ${url}`);
  }
  root.remove();
});

await test("file ID always comes from the pathname", async () => {
  const urls = [
    "https://fuckingfast.co/abc123",
    "https://fuckingfast.co/abc123#example.rar",
    "https://fuckingfast.co/abc123?query=value",
    "https://fuckingfast.co/abc123?file=other456#different-name.rar"
  ];
  for (const url of urls) {
    assert(parseFilePageUrl(url)?.fileId === "abc123", `File ID not taken from path: ${url}`);
  }
  assert(parseFilePageUrl("https://fuckingfast.co/f/abc123#example.rar") === null,
    "Unsupported path was parsed as a file page");
});

await test("all supported URL forms still require a matching POST file ID", async () => {
  const root = await mountedFixture("observed-wrong-id");
  for (const url of [
    "https://fuckingfast.co/abc123",
    "https://fuckingfast.co/abc123#example.rar",
    "https://fuckingfast.co/abc123?query=value"
  ]) {
    const result = detectDownloadControl(root, url);
    assert(result.status === "invalid" && result.reason === "wrong-file-id",
      `Mismatched POST accepted: ${url}`);
  }
  root.remove();
});

await test("invalid and cross-origin POST endpoints are rejected", async () => {
  const root = await mountedFixture("observed-invalid-post");
  assert(detectDownloadControl(root, pageUrl).status === "invalid", "External POST accepted");
  const control = root.querySelector("[hx-post]");
  for (const post of ["//ads.invalid/f/abc123/go", "/f/abc123/go?x=1", "/f/abc123/other"] ) {
    control.setAttribute("hx-post", post);
    assert(detectDownloadControl(root, pageUrl).status === "invalid", `Invalid POST accepted: ${post}`);
  }
  root.remove();
});

await test("missing control and synthetic error state stay missing", async () => {
  for (const name of ["observed-missing", "synthetic-error"]) {
    const root = await mountedFixture(name);
    assert(detectDownloadControl(root, pageUrl).status === "missing", `${name} should be missing`);
    root.remove();
  }
});

await test("multiple matching controls are ambiguous", async () => {
  const root = await mountedFixture("observed-ambiguous");
  const result = detectDownloadControl(root, pageUrl);
  assert(result.status === "ambiguous" && result.count === 2 && result.element === null, "Ambiguous control selected");
  root.remove();
});

await test("hidden and unrelated advertisements are excluded", async () => {
  const root = await mountedFixture("observed-hidden-ad");
  const result = detectDownloadControl(root, pageUrl);
  assert(result.status === "candidate" && result.count === 1 && result.invalidCount === 1, "Hidden control was selected");
  assert(result.element.getClientRects().length > 0, "Candidate is not visible");
  root.remove();
});

await test("wrong file identifier is rejected", async () => {
  const root = await mountedFixture("observed-wrong-id");
  const result = detectDownloadControl(root, pageUrl);
  assert(result.status === "invalid" && result.reason === "wrong-file-id", "Wrong file ID accepted");
  root.remove();
});

await test("text, element type, and required attributes are checked", async () => {
  const root = await mountedFixture("observed-valid");
  const control = root.querySelector("[hx-post]");
  control.textContent = "DOWNLOAD NOW";
  assert(detectDownloadControl(root, pageUrl).reason === "wrong-text", "Wrong text accepted");
  control.textContent = "DOWNLOAD";
  control.setAttribute("href", "https://ads.invalid/offer");
  assert(detectDownloadControl(root, pageUrl).reason === "wrong-attributes", "Unexpected href accepted");
  control.removeAttribute("href");
  control.classList.remove("gay-button");
  assert(detectDownloadControl(root, pageUrl).reason === "wrong-attributes", "Wrong classes accepted");
  const button = document.createElement("button");
  button.setAttribute("hx-post", "/f/abc123/go");
  root.replaceChildren(button);
  assert(detectDownloadControl(root, pageUrl).reason === "wrong-element-type", "Wrong element type accepted");
  root.remove();
});

await test("synthetic countdown is disabled and unverified", async () => {
  const root = await mountedFixture("synthetic-countdown");
  assert(detectDownloadControl(root, pageUrl).reason === "disabled", "Disabled countdown control accepted");
  root.remove();
});

await test("observed-shaped control can appear dynamically", async () => {
  const root = await mountedFixture("observed-dynamic");
  const statuses = [];
  const disconnect = watchForCandidate(root, (scope) => detectDownloadControl(scope, pageUrl),
    (result) => statuses.push(result.status), { debounceMs: 15, timeoutMs: 150 });
  const control = document.createElement("a");
  control.className = "link-button text-5xl gay-button";
  control.setAttribute("hx-post", "/f/abc123/go");
  control.setAttribute("hx-swap", "none");
  control.setAttribute("rel", "noopener");
  control.textContent = "DOWNLOAD";
  root.querySelector("#observed-slot").append(control);
  await delay(50);
  assert(statuses.join(",") === "missing,candidate", `Dynamic status mismatch: ${statuses}`);
  disconnect();
  root.remove();
});

await test("page navigation and repeated detection use the current file ID", async () => {
  const root = await mountedFixture("observed-valid");
  assert(detectDownloadControl(root, pageUrl).status === "candidate", "Initial page not detected");
  assert(detectDownloadControl(root, pageUrl).status === "candidate", "Repeated detection changed result");
  assert(detectDownloadControl(root, "https://fuckingfast.co/new456#another.rar").reason === "wrong-file-id", "New page reused old ID");
  root.querySelector("[hx-post]").setAttribute("hx-post", "/f/new456/go");
  assert(detectDownloadControl(root, "https://fuckingfast.co/new456#another.rar").status === "candidate", "New page ID not detected");
  root.remove();
});

function mockController({ enabled = true, tabId = 7, documentId = "test-document",
  sendToTab = async () => false } = {}) {
  const data = {};
  let currentTime = Date.parse("2026-01-01T00:00:00.000Z");
  let autoEnabled = enabled;
  const events = [];
  const eventDetails = [];
  const deadlines = [];
  const storage = {
    async get(key) {
      if (key === null) return structuredClone(data);
      return Object.hasOwn(data, key) ? { [key]: structuredClone(data[key]) } : {};
    },
    async set(values) { Object.assign(data, structuredClone(values)); },
    async remove(key) { delete data[key]; }
  };
  const configuration = {
    storage, getEnabled: async () => autoEnabled, now: () => currentTime,
    fingerprint: async (value) => value, sendToTab,
    scheduleDeadline: async (when) => { deadlines.push(when); },
    clearDeadline: async () => { deadlines.push(null); },
    onEvent: (event, details) => {
      events.push(event);
      eventDetails.push({ event, ...details });
    }
  };
  const controller = createDownloadController(configuration);
  const sender = { tab: { id: tabId }, frameId: 0, documentId, url: pageUrl };
  return { controller, sender, events, eventDetails, deadlines, data, storage,
    restart: () => createDownloadController(configuration),
    setEnabled: (value) => { autoEnabled = value; },
    advance: (ms) => { currentTime += ms; }, now: () => currentTime };
}

async function reportCandidate(mock) {
  await mock.controller.handleMessage({ type: "PAGE_STATUS", status: "candidate", valid: 1, invalid: 0 }, mock.sender);
}

await test("one verified control is automatically clicked after a claim", async () => {
  const root = await mountedFixture("observed-valid");
  const mock = mockController();
  await reportCandidate(mock);
  let clicks = 0;
  const clickSequence = [];
  root.querySelector("[hx-post]").addEventListener("click", () => {
    clicks += 1;
    clickSequence.push("dom-click");
  });
  const engine = createAutoClickEngine({
    detect: () => detectDownloadControl(root, pageUrl),
    claim: () => mock.controller.handleMessage({ type: "CLAIM_ATTEMPT" }, mock.sender),
    report: (result) => mock.controller.handleMessage({ type: "ATTEMPT_RESULT", result }, mock.sender),
    onEvent: (code) => clickSequence.push(code)
  });
  assert(await engine.attempt() === "clicked" && clicks === 1, "Expected exactly one click");
  assert(clickSequence.join(",") === "click-attempted,dom-click",
    "Click timing diagnostic was not emitted immediately before the DOM click");
  assert(await engine.attempt() === "duplicate-attempt" && clicks === 1, "Duplicate click occurred");
  const status = await mock.controller.handleMessage({ type: "GET_STATUS", tabId: 7 }, {});
  assert(status.attempt === "clicked" && status.download === "waiting", "Attempt state missing");
  root.remove();
});

await test("automation OFF denies the claim and never clicks", async () => {
  const root = await mountedFixture("observed-valid");
  const mock = mockController({ enabled: false });
  await reportCandidate(mock);
  let clicks = 0;
  root.querySelector("[hx-post]").addEventListener("click", () => { clicks += 1; });
  const engine = createAutoClickEngine({
    detect: () => detectDownloadControl(root, pageUrl),
    claim: () => mock.controller.handleMessage({ type: "CLAIM_ATTEMPT" }, mock.sender),
    report: async () => {}
  });
  assert(await engine.attempt() === "automation-disabled" && clicks === 0, "Disabled automation clicked");
  root.remove();
});

await test("turning automation OFF after a claim stops before clicking", async () => {
  const root = await mountedFixture("observed-valid");
  let clicks = 0;
  const reports = [];
  root.querySelector("[hx-post]").addEventListener("click", () => { clicks += 1; });
  const engine = createAutoClickEngine({
    detect: () => detectDownloadControl(root, pageUrl),
    claim: async () => ({ allowed: true }),
    isEnabled: async () => false,
    report: async (result) => reports.push(result)
  });
  assert(await engine.attempt() === "disabled" && clicks === 0 && reports[0] === "disabled-after-claim",
    "Disabled setting did not stop the claimed click");
  root.remove();
});

await test("queued content script resumes exactly one verified click", async () => {
  const root = await mountedFixture("observed-valid");
  let clicks = 0;
  const reports = [];
  root.querySelector("[hx-post]").addEventListener("click", () => { clicks += 1; });
  const engine = createAutoClickEngine({
    detect: () => detectDownloadControl(root, pageUrl),
    claim: async () => ({ queued: true, reason: "attempt-queued" }),
    report: async (result) => reports.push(result)
  });
  assert(await engine.attempt() === "attempt-queued" && engine.canAcceptQueuedGrant(),
    "Queued engine did not wait");
  assert(await engine.resume() === "clicked" && clicks === 1 && reports[0] === "clicked",
    "Queued grant did not click exactly once");
  assert(await engine.resume() === "duplicate-attempt" && clicks === 1, "Queued page clicked twice");
  root.remove();
});

await test("early queued grant waits for the claim response", async () => {
  const root = await mountedFixture("observed-valid");
  let clicks = 0;
  let resolveClaim;
  root.querySelector("[hx-post]").addEventListener("click", () => { clicks += 1; });
  const engine = createAutoClickEngine({
    detect: () => detectDownloadControl(root, pageUrl),
    claim: () => new Promise((resolve) => { resolveClaim = resolve; }),
    report: async () => {}
  });
  const attempt = engine.attempt();
  assert(engine.canAcceptQueuedGrant(), "Early grant could not be acknowledged");
  const resume = engine.resume();
  await Promise.resolve();
  resolveClaim({ queued: true, reason: "attempt-queued" });
  assert(await attempt === "attempt-queued", "Claim did not enter queue");
  assert(await resume === "clicked" && clicks === 1, "Early grant was lost or duplicated");
  root.remove();
});

await test("expired queued grant cannot click after the queue moves on", async () => {
  const root = await mountedFixture("observed-valid");
  let clicks = 0;
  const reports = [];
  root.querySelector("[hx-post]").addEventListener("click", () => { clicks += 1; });
  const engine = createAutoClickEngine({
    detect: () => detectDownloadControl(root, pageUrl),
    claim: async () => ({ queued: true }),
    report: async (result) => reports.push(result)
  });
  await engine.attempt();
  assert(await engine.resume(Date.now() - 1) === "grant-expired" && clicks === 0 &&
    reports[0] === "grant-expired", "Expired grant clicked the page");
  root.remove();
});

await test("missing, ambiguous, and unsupported pages never claim or click", async () => {
  for (const [name, url] of [["observed-missing", pageUrl],
    ["observed-ambiguous", pageUrl], ["observed-valid", "https://evil.invalid/abc123"]]) {
    const root = await mountedFixture(name);
    let claims = 0;
    let clicks = 0;
    root.addEventListener("click", () => { clicks += 1; });
    const engine = createAutoClickEngine({
      detect: () => detectDownloadControl(root, url),
      claim: async () => { claims += 1; return { allowed: true }; }, report: async () => {}
    });
    assert(await engine.attempt() === "no-candidate" && claims === 0 && clicks === 0,
      `${name} or unsupported host attempted a click`);
    root.remove();
  }
});

await test("second file queues while the first awaits confirmation, then starts", async () => {
  const shared = {};
  const grants = [];
  const storage = {
    async get(key) { return key === null ? structuredClone(shared) :
      Object.hasOwn(shared, key) ? { [key]: structuredClone(shared[key]) } : {}; },
    async set(values) { Object.assign(shared, structuredClone(values)); },
    async remove(key) { delete shared[key]; }
  };
  const controller = createDownloadController({ storage, getEnabled: async () => true,
    now: () => Date.parse("2026-01-01T00:00:00Z"), fingerprint: async (value) => value,
    sendToTab: async (tabId) => { grants.push(tabId); return true; } });
  const first = { tab: { id: 1 }, frameId: 0, documentId: "one", url: pageUrl };
  const second = { tab: { id: 2 }, frameId: 0, documentId: "two", url: "https://fuckingfast.co/other456" };
  for (const sender of [first, second]) {
    await controller.handleMessage({ type: "PAGE_STATUS", status: "candidate", valid: 1 }, sender);
  }
  assert((await controller.handleMessage({ type: "CLAIM_ATTEMPT" }, first)).allowed, "First claim denied");
  assert((await controller.handleMessage({ type: "CLAIM_ATTEMPT" }, first)).reason === "duplicate-attempt", "Duplicate claim accepted");
  const queued = await controller.handleMessage({ type: "CLAIM_ATTEMPT" }, second);
  assert(queued.queued && queued.reason === "attempt-queued", "Second tab was not queued");
  assert((await controller.handleMessage({ type: "GET_STATUS", tabId: 2 }, {})).attempt === "queued",
    "Queued status missing");
  const item = { id: 50, referrer: pageWithoutFragment,
    startTime: "2026-01-01T00:00:00.000Z", state: "in_progress" };
  assert(await controller.downloadCreated(item, "our-extension"), "First download not observed");
  assert(grants.join(",") === "2", "Second tab was not granted after download started");
  assert((await controller.handleMessage({ type: "GET_STATUS", tabId: 2 }, {})).download === "waiting",
    "Second tab was not promoted");
});

function queueHarness() {
  const grants = [];
  const mock = mockController({ sendToTab: async (tabId, documentId, message) => {
    grants.push({ tabId, documentId, type: message.type });
    return true;
  } });
  const first = mock.sender;
  const second = { tab: { id: 8 }, frameId: 0, documentId: "second", url: "https://fuckingfast.co/part02" };
  const third = { tab: { id: 9 }, frameId: 0, documentId: "third", url: "https://fuckingfast.co/part03" };
  const report = (sender) => mock.controller.handleMessage(
    { type: "PAGE_STATUS", status: "candidate", valid: 1, invalid: 0 }, sender);
  const claim = (sender) => mock.controller.handleMessage({ type: "CLAIM_ATTEMPT" }, sender);
  const observe = (id, url, controller = mock.controller) => controller.downloadCreated({
    id, referrer: url, startTime: new Date(mock.now()).toISOString(), state: "in_progress"
  }, "our-extension");
  return { mock, first, second, third, grants, report, claim, observe };
}

await test("matched download releases the next page in the same event turn", async () => {
  const q = queueHarness();
  await q.report(q.first);
  await q.report(q.second);
  await q.claim(q.first);
  await q.claim(q.second);
  await q.mock.controller.handleMessage({ type: "ATTEMPT_RESULT", result: "clicked" }, q.first);
  q.mock.advance(1200);
  assert(await q.observe(101, pageWithoutFragment), "Matching download was missed");
  assert(q.grants.length === 1 && q.grants[0].tabId === 8,
    "Next page was not released before the download event resolved");
  const matched = q.mock.eventDetails.find((event) => event.event === "download-matched");
  const released = q.mock.eventDetails.find((event) => event.event === "next-attempt-released");
  assert(matched.sinceClaimMs === 1200 && matched.sinceClickMs === 1200 &&
    released.queueWaitMs === 1200,
    "Confirmation or queue duration was measured incorrectly");
  assert(q.mock.events.indexOf("download-matched") < q.mock.events.indexOf("next-attempt-released"),
    "Queue advanced before download correlation");
});

await test("slow host response is measured without premature queue release", async () => {
  const q = queueHarness();
  await q.report(q.first);
  await q.report(q.second);
  await q.claim(q.first);
  await q.claim(q.second);
  q.mock.advance(9000);
  assert(q.grants.length === 0, "Queue advanced before a download event");
  assert(await q.observe(102, pageWithoutFragment), "Slow response failed correlation");
  const received = q.mock.eventDetails.find((event) => event.event === "download-event-received");
  assert(received.sinceClaimMs === 9000 && q.grants.length === 1,
    "Host delay was not distinguished from queue-release delay");
});

await test("unmatched event reports a safe reason and preserves the timeout", async () => {
  const q = queueHarness();
  await q.report(q.first);
  await q.report(q.second);
  await q.claim(q.first);
  await q.claim(q.second);
  q.mock.advance(3000);
  assert(!(await q.mock.controller.downloadCreated({ id: 103, referrer: "",
    startTime: new Date(q.mock.now()).toISOString() }, "our-extension")),
  "Download without referrer was attributed");
  const unmatched = q.mock.eventDetails.find((event) => event.event === "download-unmatched");
  assert(unmatched.reason === "missing-referrer" && unmatched.sinceClaimMs === 3000,
    "Unmatched event omitted the sanitized reason or timing");
  assert(q.grants.length === 0, "Unmatched event advanced the queue");
  q.mock.advance(12000);
  await q.mock.controller.tick();
  const timedOut = q.mock.eventDetails.find((event) => event.event === "attempt-timed-out");
  assert(timedOut.sinceClaimMs === 15000 && q.grants.length === 1,
    "Timeout did not retain the original 15-second confirmation window");
});

await test("duplicate download event cannot release a second queued page", async () => {
  const q = queueHarness();
  for (const sender of [q.first, q.second, q.third]) await q.report(sender);
  for (const sender of [q.first, q.second, q.third]) await q.claim(sender);
  assert(await q.observe(104, pageWithoutFragment), "First event did not match");
  assert(!(await q.observe(104, pageWithoutFragment)), "Duplicate event matched again");
  assert(q.grants.length === 1 && q.grants[0].tabId === 8,
    "Duplicate event advanced a second queued page");
});

await test("restarted worker retains confirmation timing and releases once", async () => {
  const q = queueHarness();
  await q.report(q.first);
  await q.report(q.second);
  await q.claim(q.first);
  await q.claim(q.second);
  q.mock.advance(4000);
  const restarted = q.mock.restart();
  await restarted.recover();
  q.mock.advance(2000);
  assert(await q.observe(105, pageWithoutFragment, restarted), "Restarted worker missed event");
  const matched = q.mock.eventDetails.find((event) => event.event === "download-matched");
  assert(matched.sinceClaimMs === 6000 && q.grants.length === 1,
    "Restart lost persisted claim time or duplicated queue release");
});

await test("first, second, and third independent files start in FIFO order", async () => {
  const q = queueHarness();
  for (const sender of [q.first, q.second, q.third]) await q.report(sender);
  assert((await q.claim(q.first)).allowed, "First file did not start");
  assert((await q.claim(q.second)).queued, "Second file was not queued");
  assert((await q.claim(q.third)).queued, "Third file was not queued");
  assert(await q.observe(61, pageWithoutFragment), "First browser download not observed");
  assert(q.grants.map((grant) => grant.tabId).join(",") === "8", "Second file was not first in queue");
  assert(await q.observe(62, q.second.url), "Second browser download not observed");
  assert(q.grants.map((grant) => grant.tabId).join(",") === "8,9", "Third file was not next in queue");
  const firstStatus = await q.mock.controller.handleMessage({ type: "GET_STATUS", tabId: 7 }, {});
  assert(firstStatus.download === "started", "Queue waited for the first large download to finish");
});

await test("quickly opened tabs are queued and granted in arrival order", async () => {
  const q = queueHarness();
  await q.report(q.first);
  await q.claim(q.first);
  const pages = [q.second, q.third,
    { tab: { id: 10 }, frameId: 0, documentId: "fourth", url: "https://fuckingfast.co/part04" }];
  await Promise.all(pages.map(q.report));
  const claims = await Promise.all(pages.map(q.claim));
  assert(claims.every((claim) => claim.queued), "A quick tab was rejected instead of queued");
  await q.observe(63, pageWithoutFragment);
  await q.observe(64, q.second.url);
  await q.observe(65, q.third.url);
  assert(q.grants.map((grant) => grant.tabId).join(",") === "8,9,10", "Queue order changed");
});

await test("stale pending confirmation expires and starts the next file", async () => {
  const q = queueHarness();
  await q.report(q.first);
  await q.report(q.second);
  await q.claim(q.first);
  await q.claim(q.second);
  q.mock.advance(16000);
  await q.mock.controller.tick();
  const firstStatus = await q.mock.controller.handleMessage({ type: "GET_STATUS", tabId: 7 }, {});
  assert(firstStatus.download === "unconfirmed" && firstStatus.fallback, "Stale first attempt did not expire");
  assert(q.grants.map((grant) => grant.tabId).join(",") === "8", "Queued second file was not promoted");
  assert(q.mock.events.includes("attempt-timed-out"), "Expiry diagnostic missing");
});

await test("closed queued tab is skipped and a later file proceeds", async () => {
  const q = queueHarness();
  for (const sender of [q.first, q.second, q.third]) await q.report(sender);
  for (const sender of [q.first, q.second, q.third]) await q.claim(sender);
  await q.mock.controller.tabRemoved(8);
  await q.observe(66, pageWithoutFragment);
  assert(q.grants.map((grant) => grant.tabId).join(",") === "9", "Closed queued tab blocked the queue");
  const removed = await q.mock.controller.handleMessage({ type: "GET_STATUS", tabId: 8 }, {});
  assert(removed.attempt === "idle", "Closed tab kept queued state");
});

await test("closing the active tab releases the next queued file", async () => {
  const q = queueHarness();
  await q.report(q.first);
  await q.report(q.second);
  await q.claim(q.first);
  await q.claim(q.second);
  await q.mock.controller.tabRemoved(7);
  assert(q.grants.map((grant) => grant.tabId).join(",") === "8", "Closed active tab kept the queue blocked");
});

await test("queued navigation cancels that page without blocking later files", async () => {
  const q = queueHarness();
  for (const sender of [q.first, q.second, q.third]) await q.report(sender);
  for (const sender of [q.first, q.second, q.third]) await q.claim(sender);
  await q.mock.controller.tabLoading(8);
  await q.observe(67, pageWithoutFragment);
  assert(q.grants.map((grant) => grant.tabId).join(",") === "9", "Navigated queued tab was still granted");
  const status = await q.mock.controller.handleMessage({ type: "GET_STATUS", tabId: 8 }, {});
  assert(status.attempt === "failed" && status.fallback, "Navigated queue state not cleaned up");
});

await test("worker restart recovers a stored queue", async () => {
  const q = queueHarness();
  await q.report(q.first);
  await q.report(q.second);
  await q.claim(q.first);
  await q.claim(q.second);
  const restarted = q.mock.restart();
  await restarted.recover();
  assert(q.grants.length === 0, "Restart caused a duplicate click before confirmation");
  assert(await q.observe(68, pageWithoutFragment, restarted), "Restarted worker missed download event");
  assert(q.grants.map((grant) => grant.tabId).join(",") === "8", "Restarted worker did not drain queue");
});

await test("missing referrer leaves queue pending only until the deadline", async () => {
  const q = queueHarness();
  await q.report(q.first);
  await q.report(q.second);
  await q.claim(q.first);
  await q.claim(q.second);
  assert(!(await q.mock.controller.downloadCreated({ id: 69, referrer: "",
    startTime: new Date(q.mock.now()).toISOString() }, "our-extension")),
  "Uncertain download was attributed");
  assert(q.grants.length === 0, "Queue advanced on an uncorrelated download");
  q.mock.advance(16000);
  await q.mock.controller.tick();
  assert(q.grants.map((grant) => grant.tabId).join(",") === "8", "Queue did not recover after uncertainty timeout");
});

await test("turning Auto Download OFF cancels queued pages", async () => {
  const q = queueHarness();
  await q.report(q.first);
  await q.report(q.second);
  await q.claim(q.first);
  await q.claim(q.second);
  q.mock.setEnabled(false);
  await q.mock.controller.enabledChanged(false);
  await q.observe(70, pageWithoutFragment);
  assert(q.grants.length === 0, "Disabled automation granted a queued page");
  const status = await q.mock.controller.handleMessage({ type: "GET_STATUS", tabId: 8 }, {});
  assert(status.attempt === "failed" && status.fallback, "Queued page did not show manual fallback");
});

await test("duplicate file in another tab is not queued for a second download", async () => {
  const q = queueHarness();
  const duplicate = { tab: { id: 8 }, frameId: 0, documentId: "duplicate",
    url: `${pageWithoutFragment}?copy=1` };
  await q.report(q.first);
  await q.report(duplicate);
  await q.claim(q.first);
  assert((await q.claim(duplicate)).reason === "duplicate-attempt", "Duplicate file was queued");
});

await test("queue capacity is bounded and reports a manual fallback", async () => {
  const q = queueHarness();
  await q.report(q.first);
  await q.claim(q.first);
  for (let index = 0; index < 16; index += 1) {
    const sender = { tab: { id: 20 + index }, frameId: 0, documentId: `doc-${index}`,
      url: `https://fuckingfast.co/file${index}` };
    await q.report(sender);
    assert((await q.claim(sender)).queued, `Queue slot ${index} rejected`);
  }
  const overflow = { tab: { id: 40 }, frameId: 0, documentId: "overflow",
    url: "https://fuckingfast.co/overflow" };
  await q.report(overflow);
  assert((await q.claim(overflow)).reason === "queue-full", "Queue accepted an unbounded request");
  const status = await q.mock.controller.handleMessage({ type: "GET_STATUS", tabId: 40 }, {});
  assert(status.fallback && status.error, "Queue overflow was silent");
});

await test("old queued pages expire after a delayed worker recovery", async () => {
  const q = queueHarness();
  await q.report(q.first);
  await q.report(q.second);
  await q.claim(q.first);
  await q.claim(q.second);
  q.mock.advance(301000);
  await q.mock.restart().recover();
  const status = await q.mock.controller.handleMessage({ type: "GET_STATUS", tabId: 8 }, {});
  assert(status.attempt === "failed" && status.fallback && q.grants.length === 0,
    "Expired queued page was clicked after long downtime");
});

await test("same-file reload preserves the one-click latch", async () => {
  const mock = mockController();
  await reportCandidate(mock);
  assert((await mock.controller.handleMessage({ type: "CLAIM_ATTEMPT" }, mock.sender)).allowed,
    "First claim denied");
  const reloaded = { ...mock.sender, documentId: "new-document", url: pageWithoutFragment };
  await mock.controller.handleMessage({ type: "PAGE_STATUS", status: "candidate", valid: 1 }, reloaded);
  assert((await mock.controller.handleMessage({ type: "CLAIM_ATTEMPT" }, reloaded)).reason === "duplicate-attempt",
    "Reloaded same file was clicked again");
});

await test("worker claims supported URLs with fragments or optional queries", async () => {
  for (const url of [pageWithoutFragment, `${pageWithoutFragment}?source=test`,
    `${pageWithoutFragment}?source=test#example.rar`]) {
    const mock = mockController();
    const sender = { ...mock.sender, url };
    await mock.controller.handleMessage({ type: "PAGE_STATUS", status: "candidate", valid: 1 }, sender);
    assert((await mock.controller.handleMessage({ type: "CLAIM_ATTEMPT" }, sender)).allowed,
      `Worker rejected supported URL: ${url}`);
  }
});

await test("worker rejects spoofed hosts and multiple candidates", async () => {
  const mock = mockController();
  const spoofed = { ...mock.sender, url: "https://fuckingfast.co.evil.invalid/abc123" };
  assert(!(await mock.controller.handleMessage({ type: "PAGE_STATUS", status: "candidate", valid: 1 }, spoofed)).accepted,
    "Worker accepted spoofed host status");
  assert((await mock.controller.handleMessage({ type: "CLAIM_ATTEMPT" }, spoofed)).reason === "unsupported-page",
    "Worker allowed spoofed host claim");
  await mock.controller.handleMessage({ type: "PAGE_STATUS", status: "ambiguous", valid: 2 }, mock.sender);
  assert((await mock.controller.handleMessage({ type: "CLAIM_ATTEMPT" }, mock.sender)).reason === "no-candidate",
    "Worker allowed ambiguous controls");
});

await test("tab navigation clears stale detection but keeps pending correlation", async () => {
  const mock = mockController();
  await reportCandidate(mock);
  await mock.controller.handleMessage({ type: "CLAIM_ATTEMPT" }, mock.sender);
  await mock.controller.tabLoading(7);
  const status = await mock.controller.handleMessage({ type: "GET_STATUS", tabId: 7 }, {});
  assert(status.detection === "unknown" && status.download === "waiting", "Navigation left stale detection or lost pending attempt");
});

await test("closing a tab clears its session attempt", async () => {
  const mock = mockController();
  await reportCandidate(mock);
  await mock.controller.handleMessage({ type: "CLAIM_ATTEMPT" }, mock.sender);
  await mock.controller.tabRemoved(7);
  const status = await mock.controller.handleMessage({ type: "GET_STATUS", tabId: 7 }, {});
  assert(status.attempt === "idle" && status.detection === "unknown", "Closed tab retained attempt state");
});

await test("changed control before click causes a safe stop", async () => {
  const root = await mountedFixture("observed-valid");
  let clicks = 0;
  root.addEventListener("click", () => { clicks += 1; });
  const control = root.querySelector("[hx-post]");
  const reports = [];
  const engine = createAutoClickEngine({
    detect: () => detectDownloadControl(root, pageUrl),
    claim: async () => { control.setAttribute("hx-post", "/f/other456/go"); return { allowed: true }; },
    report: async (result) => reports.push(result)
  });
  assert(await engine.attempt() === "invalidated" && clicks === 0 && reports[0] === "invalidated",
    "Changed control was clicked");
  root.remove();
});

await test("delayed control insertion results in only one click", async () => {
  const root = await mountedFixture("observed-dynamic");
  let clicks = 0;
  const engine = createAutoClickEngine({
    detect: () => detectDownloadControl(root, pageUrl),
    claim: async () => ({ allowed: true }), report: async () => {}
  });
  const disconnect = watchForCandidate(root, () => detectDownloadControl(root, pageUrl),
    (result) => { if (result.status === "candidate") engine.attempt(); },
    { debounceMs: 10, timeoutMs: 150, stopOnCandidate: false });
  const control = document.createElement("a");
  control.className = "link-button text-5xl gay-button";
  control.setAttribute("hx-post", "/f/abc123/go");
  control.setAttribute("hx-swap", "none");
  control.setAttribute("rel", "noopener");
  control.textContent = "DOWNLOAD";
  control.addEventListener("click", () => { clicks += 1; });
  root.querySelector("#observed-slot").append(control);
  await delay(40);
  control.setAttribute("class", control.className);
  await delay(40);
  assert(clicks === 1, `Expected one delayed click, got ${clicks}`);
  disconnect();
  root.remove();
});

await test("matching browser download starts and completes", async () => {
  const mock = mockController();
  await reportCandidate(mock);
  await mock.controller.handleMessage({ type: "CLAIM_ATTEMPT" }, mock.sender);
  await mock.controller.handleMessage({ type: "ATTEMPT_RESULT", result: "clicked" }, mock.sender);
  const item = { id: 41, referrer: pageWithoutFragment, startTime: new Date(mock.now()).toISOString(), state: "in_progress" };
  assert(await mock.controller.downloadCreated(item, "our-extension"), "Matching download ignored");
  let status = await mock.controller.handleMessage({ type: "GET_STATUS", tabId: 7 }, {});
  assert(status.download === "started" && !status.fallback, "Started download not reported");
  await mock.controller.downloadChanged({ id: 41, state: { current: "complete" } });
  status = await mock.controller.handleMessage({ type: "GET_STATUS", tabId: 7 }, {});
  assert(status.download === "complete", "Completed download not reported");
});

await test("unrelated download events never confirm an attempt", async () => {
  const mock = mockController();
  await reportCandidate(mock);
  await mock.controller.handleMessage({ type: "CLAIM_ATTEMPT" }, mock.sender);
  const started = new Date(mock.now()).toISOString();
  for (const item of [
    { id: 1, referrer: "https://other.invalid/abc123", startTime: started },
    { id: 2, referrer: "https://fuckingfast.co/other456", startTime: started },
    { id: 3, referrer: pageWithoutFragment, startTime: started, byExtensionId: "another-extension" },
    { id: 4, referrer: "", startTime: started },
    { id: 5, referrer: pageWithoutFragment, startTime: new Date(mock.now() - 1).toISOString() }
  ]) assert(!(await mock.controller.downloadCreated(item, "our-extension")), "Unrelated download matched");
  const status = await mock.controller.handleMessage({ type: "GET_STATUS", tabId: 7 }, {});
  assert(status.download === "waiting", "Unrelated event changed status");
});

await test("interrupted browser download shows failure and manual fallback", async () => {
  const mock = mockController();
  await reportCandidate(mock);
  await mock.controller.handleMessage({ type: "CLAIM_ATTEMPT" }, mock.sender);
  const item = { id: 42, referrer: pageWithoutFragment, startTime: new Date(mock.now()).toISOString(), state: "in_progress" };
  await mock.controller.downloadCreated(item, "our-extension");
  await mock.controller.downloadChanged({ id: 42, state: { current: "interrupted" } });
  const status = await mock.controller.handleMessage({ type: "GET_STATUS", tabId: 7 }, {});
  assert(status.download === "interrupted" && status.fallback && status.error, "Failure not reported");
});

await test("no download after one click becomes unconfirmed with fallback", async () => {
  const mock = mockController();
  await reportCandidate(mock);
  await mock.controller.handleMessage({ type: "CLAIM_ATTEMPT" }, mock.sender);
  await mock.controller.handleMessage({ type: "ATTEMPT_RESULT", result: "clicked" }, mock.sender);
  mock.advance(16000);
  const status = await mock.controller.handleMessage({ type: "GET_STATUS", tabId: 7 }, {});
  assert(status.download === "unconfirmed" && status.fallback && status.error, "No-download fallback missing");
  assert((await mock.controller.handleMessage({ type: "CLAIM_ATTEMPT" }, mock.sender)).reason === "duplicate-attempt",
    "Timed-out page clicked again");
});

await test("supported host with an unsupported route reports status but cannot claim", async () => {
  const mock = mockController();
  const sender = { ...mock.sender, url: "https://fuckingfast.co/" };
  const report = await mock.controller.handleMessage({ type: "PAGE_STATUS", status: "unsupported-page", valid: 0 }, sender);
  assert(report.accepted, "Unsupported route status was dropped");
  const status = await mock.controller.handleMessage({ type: "GET_STATUS", tabId: 7 }, {});
  assert(status.detection === "unsupported-page", "Popup state did not show unsupported route");
  assert((await mock.controller.handleMessage({ type: "CLAIM_ATTEMPT" }, sender)).reason === "unsupported-page",
    "Unsupported route was allowed to click");
});

await test("popup shows download status, fallback, and persists the toggle", async () => {
  const [htmlResponse, scriptResponse] = await Promise.all([
    fetch("../../src/popup/popup.html"), fetch("../../src/popup/popup.js")
  ]);
  assert(htmlResponse.ok && scriptResponse.ok, "Popup assets unavailable");
  const html = (await htmlResponse.text())
    .replace('<link rel="stylesheet" href="popup.css">', "")
    .replace('<script src="popup.js"></script>', "");
  const script = await scriptResponse.text();
  const frame = document.createElement("iframe");
  frame.srcdoc = html;
  const loaded = new Promise((resolveLoad) => frame.addEventListener("load", resolveLoad, { once: true }));
  document.body.append(frame);
  await loaded;
  const settings = { autoEnabled: false };
  const current = { detection: "candidate", attempt: "clicked", download: "started",
    fallback: false, error: null };
  frame.contentWindow.chrome = {
    runtime: {
      getManifest: () => ({ version: "0.1.0" }),
      sendMessage: async () => ({ ...current, enabled: settings.autoEnabled })
    },
    tabs: { query: async () => [{ id: 7 }] },
    storage: {
      local: { set: async (values) => Object.assign(settings, values) },
      onChanged: { addListener: () => {} }
    }
  };
  const injected = frame.contentDocument.createElement("script");
  injected.textContent = script;
  frame.contentDocument.body.append(injected);
  await delay(10);
  assert(frame.contentDocument.getElementById("download").textContent === "Matching download started",
    "Popup did not show download start");
  const toggle = frame.contentDocument.getElementById("auto-enabled");
  assert(!toggle.checked, "Auto Download did not default OFF");
  toggle.checked = true;
  toggle.dispatchEvent(new Event("change"));
  await delay(10);
  assert(settings.autoEnabled, "Popup did not persist ON preference");
  current.attempt = "queued";
  current.download = "none";
  await frame.contentWindow.refresh();
  assert(frame.contentDocument.getElementById("attempt").textContent === "Waiting in queue",
    "Popup did not show queued attempt");
  current.download = "unconfirmed";
  current.fallback = true;
  current.error = "No matching browser download was observed after one click.";
  await frame.contentWindow.refresh();
  assert(!frame.contentDocument.getElementById("fallback").hidden &&
    frame.contentDocument.getElementById("error").textContent.includes("No matching"),
  "Popup did not show manual fallback");
  frame.remove();
});

document.getElementById("results").textContent = JSON.stringify({ passed, failures });
