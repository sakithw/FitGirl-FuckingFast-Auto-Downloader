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

function mockController({ enabled = true, tabId = 7, documentId = "test-document" } = {}) {
  const data = {};
  let currentTime = Date.parse("2026-01-01T00:00:00.000Z");
  let autoEnabled = enabled;
  const storage = {
    async get(key) {
      if (key === null) return structuredClone(data);
      return Object.hasOwn(data, key) ? { [key]: structuredClone(data[key]) } : {};
    },
    async set(values) { Object.assign(data, structuredClone(values)); },
    async remove(key) { delete data[key]; }
  };
  const controller = createDownloadController({
    storage, getEnabled: async () => autoEnabled, now: () => currentTime,
    fingerprint: async (value) => value
  });
  const sender = { tab: { id: tabId }, frameId: 0, documentId, url: pageUrl };
  return { controller, sender, setEnabled: (value) => { autoEnabled = value; },
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
  root.querySelector("[hx-post]").addEventListener("click", () => { clicks += 1; });
  const engine = createAutoClickEngine({
    detect: () => detectDownloadControl(root, pageUrl),
    claim: () => mock.controller.handleMessage({ type: "CLAIM_ATTEMPT" }, mock.sender),
    report: (result) => mock.controller.handleMessage({ type: "ATTEMPT_RESULT", result }, mock.sender)
  });
  assert(await engine.attempt() === "clicked" && clicks === 1, "Expected exactly one click");
  assert(await engine.attempt() === "duplicate" && clicks === 1, "Duplicate click occurred");
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
  assert(await engine.attempt() === "disabled" && clicks === 0, "Disabled automation clicked");
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

await test("global pending claim blocks a second tab without queuing", async () => {
  const shared = {};
  const storage = {
    async get(key) { return key === null ? structuredClone(shared) :
      Object.hasOwn(shared, key) ? { [key]: structuredClone(shared[key]) } : {}; },
    async set(values) { Object.assign(shared, structuredClone(values)); },
    async remove(key) { delete shared[key]; }
  };
  const controller = createDownloadController({ storage, getEnabled: async () => true,
    now: () => Date.parse("2026-01-01T00:00:00Z"), fingerprint: async (value) => value });
  const first = { tab: { id: 1 }, frameId: 0, documentId: "one", url: pageUrl };
  const second = { tab: { id: 2 }, frameId: 0, documentId: "two", url: "https://fuckingfast.co/other456" };
  for (const sender of [first, second]) {
    await controller.handleMessage({ type: "PAGE_STATUS", status: "candidate", valid: 1 }, sender);
  }
  assert((await controller.handleMessage({ type: "CLAIM_ATTEMPT" }, first)).allowed, "First claim denied");
  assert((await controller.handleMessage({ type: "CLAIM_ATTEMPT" }, first)).reason === "duplicate", "Duplicate claim accepted");
  assert((await controller.handleMessage({ type: "CLAIM_ATTEMPT" }, second)).reason === "busy", "Second tab was not blocked");
});

await test("same-file reload preserves the one-click latch", async () => {
  const mock = mockController();
  await reportCandidate(mock);
  assert((await mock.controller.handleMessage({ type: "CLAIM_ATTEMPT" }, mock.sender)).allowed,
    "First claim denied");
  const reloaded = { ...mock.sender, documentId: "new-document", url: pageWithoutFragment };
  await mock.controller.handleMessage({ type: "PAGE_STATUS", status: "candidate", valid: 1 }, reloaded);
  assert((await mock.controller.handleMessage({ type: "CLAIM_ATTEMPT" }, reloaded)).reason === "duplicate",
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
  assert((await mock.controller.handleMessage({ type: "CLAIM_ATTEMPT" }, mock.sender)).reason === "duplicate",
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
