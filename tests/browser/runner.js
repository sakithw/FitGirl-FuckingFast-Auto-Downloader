const { isSupportedUrl, detectDownloadControl } = globalThis.FFAD.fuckingFast;
const { createAutoClickEngine } = globalThis.FFAD;
const { createDownloadController } = globalThis.FFAD;
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
  const root = document.createElement("section");
  root.append(template.content);
  return root;
}

await test("host scope remains exact", () => {
  assert(isSupportedUrl("https://fuckingfast.co/abc123"), "Supported host rejected");
  assert(!isSupportedUrl("https://www.fuckingfast.co/abc123"), "Spoofed host accepted");
  assert(!isSupportedUrl("http://fuckingfast.co/abc123"), "Insecure scheme accepted");
});

await test("production detector remains read-only and evidence based", async () => {
  const root = await fixture("observed-valid");
  document.body.append(root);
  const result = detectDownloadControl(root, "https://fuckingfast.co/abc123#example.rar");
  assert(result.status === "candidate" && result.count === 1, "Verified fixture was not detected");
  let clicked = false;
  root.addEventListener("click", () => { clicked = true; });
  assert(!clicked, "Detection activated a control");
  root.remove();
});

await test("duplicate document attempts return already-attempted", async () => {
  let calls = 0;
  const element = { isConnected: true, click: () => { calls += 1; } };
  const engine = createAutoClickEngine({
    detect: () => ({ status: "candidate", count: 1, element }),
    claim: async () => ({ allowed: true }),
    report: async () => {},
    isEnabled: async () => true
  });
  assert(await engine.attempt() === "clicked", "First document did not click");
  assert(await engine.attempt() === "duplicate-attempt", "Duplicate document was not rejected locally");
  assert(calls === 1, "Document received more than one click");
});

function harness() {
  const data = {};
  let now = Date.parse("2026-01-01T00:00:00Z");
  const storage = {
    async get(key) {
      if (key === null) return structuredClone(data);
      if (typeof key === "string") return data[key] ? { [key]: structuredClone(data[key]) } : {};
      return {};
    },
    async set(values) { Object.assign(data, structuredClone(values)); },
    async remove(key) { delete data[key]; }
  };
  const controller = createDownloadController({
    storage,
    getEnabled: async () => true,
    now: () => now,
    fingerprint: async (value) => value,
    scheduleDeadline: async () => {},
    clearDeadline: async () => {}
  });
  const sender = (tabId) => ({
    tab: { id: tabId }, frameId: 0, documentId: `document-${tabId}`,
    url: `https://fuckingfast.co/file-${tabId}`
  });
  const report = (tabId) => controller.handleMessage({
    type: "PAGE_STATUS", status: "candidate", valid: 1, invalid: 0,
    expectedFilename: `file-${tabId}.rar`
  }, sender(tabId));
  const claim = (tabId) => controller.handleMessage({ type: "CLAIM_ATTEMPT" }, sender(tabId));
  const clicked = (tabId) => controller.handleMessage({
    type: "ATTEMPT_RESULT", result: "clicked", clickedAt: now
  }, sender(tabId));
  const event = (tabId, id) => controller.downloadCreated({
    id, referrer: "", filename: `C:\\Downloads\\file-${tabId}.rar`,
    startTime: new Date(now).toISOString(), state: "in_progress"
  }, "extension");
  return { controller, sender, report, claim, clicked, event, advance: (ms) => { now += ms; } };
}

for (const count of [3, 10, 16]) {
  await test(`${count} independent tabs claim despite pending or missing events`, async () => {
    const h = harness();
    for (let tabId = 1; tabId <= count; tabId += 1) await h.report(tabId);
    for (let tabId = 1; tabId <= count; tabId += 1) {
      const result = await h.claim(tabId);
      assert(result.allowed === true, `Tab ${tabId} was blocked by another tab`);
      await h.clicked(tabId);
    }
    const duplicate = await h.claim(1);
    assert(duplicate.reason === "already-attempted", "Duplicate request did not return already-attempted");
    const missing = await h.controller.handleMessage({ type: "GET_STATUS", tabId: count }, {});
    assert(missing.download === "waiting", "Missing event changed the independent tab state");
  });
}

await test("one tab's missing event does not block another tab's matching event", async () => {
  const h = harness();
  await h.report(1); await h.report(2);
  assert((await h.claim(1)).allowed && (await h.claim(2)).allowed, "Independent claims were blocked");
  await h.clicked(1); await h.clicked(2);
  h.advance(500);
  assert(await h.event(2, 200), "Tab B event was not matched");
  const first = await h.controller.handleMessage({ type: "GET_STATUS", tabId: 1 }, {});
  const second = await h.controller.handleMessage({ type: "GET_STATUS", tabId: 2 }, {});
  assert(first.download === "waiting" && second.download === "started",
    "Tab A missing confirmation affected Tab B");
});

await test("a timed-out tab does not block a later independent claim", async () => {
  const h = harness();
  await h.report(1); assert((await h.claim(1)).allowed, "First claim denied");
  h.advance(16000);
  await h.controller.tick();
  await h.report(2);
  assert((await h.claim(2)).allowed, "Timed-out Tab A blocked Tab B");
});

const result = { passed, failures };
document.getElementById("results").textContent = JSON.stringify(result);
