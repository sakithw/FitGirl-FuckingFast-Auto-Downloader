const { isSupportedUrl, detectDownloadControl } = globalThis.FFAD.fuckingFast;
const { createAutoClickEngine } = globalThis.FFAD;
const { createDownloadController } = globalThis.FFAD;
const { createPopupController } = globalThis.FFAD;
const failures = [];
const cases = [];
const names = new Set();
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitFor(check) {
  for (let count = 0; count < 40; count += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Popup operation did not settle");
}

function test(name, run) {
  if (names.has(name)) throw new Error(`Duplicate test name: ${name}`);
  names.add(name);
  cases.push({ name, run });
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

async function popupRoot() {
  const response = await fetch("../../src/popup/popup.html");
  assert(response.ok, "Cannot load popup markup");
  const template = document.createElement("template");
  template.innerHTML = await response.text();
  const root = document.createElement("section");
  root.append(template.content);
  return root;
}

async function popupHarness(initial = false) {
  const root = await popupRoot();
  const storage = { autoEnabled: initial, listener: null };
  const api = {
    tabs: { query: async () => [{ id: 1 }] },
    runtime: { getManifest: () => ({ version: "0.1.0" }), sendMessage: async () => ({
      enabled: storage.autoEnabled, detection: "unsupported-page", attempt: "idle",
      download: "none", fallback: false, error: null
    }) },
    storage: {
      local: {
        get: async () => ({ autoEnabled: storage.autoEnabled }),
        set: async (value) => { storage.autoEnabled = value.autoEnabled; }
      },
      onChanged: { addListener: (listener) => { storage.listener = listener; } }
    }
  };
  return { root, api, storage };
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

await test("popup loads with the Minimal One-Click controls", async () => {
  const root = await popupRoot();
  assert(root.querySelector("#automation-action")?.tagName === "BUTTON", "Action is not a button");
  assert(root.querySelector("#automation-card"), "Automation card is missing");
  assert(root.querySelector("#page-status"), "Supported-site status is missing");
  assert(root.querySelector("#automation-icon") && root.querySelector("#automation-details"),
    "Compact status icon and text layout are missing");
  assert(root.querySelector("#action-power")?.tagName.toLowerCase() === "svg", "Power icon is missing");
  assert(root.querySelector("#auto-enabled") === null, "Legacy checkbox remains");
});

await test("popup enable and disable persist the existing setting", async () => {
  const h = await popupHarness(false);
  const controller = createPopupController(h.api, h.root);
  controller.render({ enabled: false, detection: "unsupported-page", attempt: "idle",
    download: "none", fallback: false, error: null });
  assert(h.root.querySelector("#action-label").textContent === "Enable Auto Download",
    "Enable label missing");
  h.root.querySelector("#automation-action").click();
  await waitFor(() => !h.root.querySelector("#automation-action").disabled);
  assert(h.storage.autoEnabled === true, "Enable did not persist");
  controller.render({ enabled: true, detection: "unsupported-page", attempt: "idle",
    download: "none", fallback: false, error: null });
  assert(h.root.querySelector("#action-label").textContent === "Disable Auto Download",
    "Disable label missing");
  h.root.querySelector("#automation-action").click();
  await waitFor(() => !h.root.querySelector("#automation-action").disabled);
  assert(h.storage.autoEnabled === false, "Disable did not persist");
});

await test("popup keeps download confirmation separate from automation state", async () => {
  const h = await popupHarness(true);
  const controller = createPopupController(h.api, h.root);
  controller.render({ enabled: true, detection: "candidate", attempt: "clicked",
    download: "unconfirmed", fallback: true, error: null });
  assert(h.root.querySelector("#automation-title").textContent === "Automation Enabled",
    "Enabled state was not shown");
  assert(h.root.querySelector("#activity-state").textContent === "Download not confirmed",
    "Unconfirmed download was not shown");
  assert(!h.root.querySelector("#fallback").hidden, "Manual fallback was hidden");
});

await test("popup reopening restores the saved setting and neutral unsupported-page status", async () => {
  const h = await popupHarness(true);
  const root = await popupRoot();
  const controller = createPopupController(h.api, root);
  await controller.refresh();
  assert(root.querySelector("#automation-title").textContent === "Automation Enabled",
    "Saved setting did not survive popup reopening");
  assert(root.querySelector("#page-status").hidden,
    "Unsupported page was not shown neutrally");
  assert(root.querySelector("#activity-state").hidden,
    "Enabled automation was presented as a download result");
  assert(root.querySelector("#page-instruction").textContent === "Open a file link to begin",
    "Unsupported page has no helpful instruction");
});

await test("rejected page status terminates while the saved toggle remains usable", async () => {
  const h = await popupHarness(false);
  h.api.runtime.sendMessage = async () => { throw new Error("worker unavailable"); };
  const controller = createPopupController(h.api, h.root);
  await controller.refresh();
  assert(!h.root.querySelector("#automation-action").disabled, "Saved toggle was blocked by page status");
  assert(h.root.querySelector("#page-status").textContent === "Page details are not available.", "Failure did not terminate neutrally");
});

await test("unanswered page request has a bounded terminal state", async () => {
  const h = await popupHarness(true);
  h.api.runtime.sendMessage = () => new Promise(() => {});
  const controller = createPopupController(h.api, h.root, { requestTimeoutMs: 20 });
  await controller.refresh();
  assert(h.root.querySelector("#page-status").textContent === "Page details are not available.", "Unanswered request stayed pending");
  assert(h.root.querySelector("#automation-title").textContent === "Automation Enabled", "Saved setting was lost");
  assert(!h.root.textContent.includes("Checking page"), "Stuck checking message remains");
});

await test("known unrelated tabs hide the page row without waiting for a worker", async () => {
  const h = await popupHarness(false);
  h.api.tabs.query = async () => [{ id: 1, url: "https://example.invalid/" }];
  h.api.runtime.sendMessage = () => { throw new Error("Unrelated page should not need a status request"); };
  const controller = createPopupController(h.api, h.root);
  await controller.refresh();
  assert(h.root.querySelector("#page-status").hidden, "Unrelated tab produced an unresolved page row");
  assert(h.root.querySelector("#automation-title").textContent === "Automation Paused", "Default OFF state was lost");
  assert(h.root.querySelector("#page-instruction").textContent === "Open a file link to begin",
    "Unrelated page has no helpful footer");
});

await test("Chrome internal pages are neutral non-file contexts", async () => {
  const h = await popupHarness(true);
  h.api.tabs.query = async () => [{ id: 1, url: "chrome://extensions/" }];
  let requests = 0;
  h.api.runtime.sendMessage = async () => { requests += 1; throw new Error("restricted context"); };
  const controller = createPopupController(h.api, h.root);
  await controller.refresh();
  assert(requests === 0, "Chrome internal page triggered an unnecessary status request");
  assert(h.root.querySelector("#page-status").hidden && h.root.querySelector("#error").hidden,
    "Chrome internal page was displayed as an error");
  assert(h.root.querySelector("#page-instruction").textContent === "Open a file link to begin",
    "Chrome internal page has no neutral instruction");
});

await test("unknown and malformed status cannot imply a download success", async () => {
  const h = await popupHarness(true);
  h.api.runtime.sendMessage = async () => ({ detection: "unknown", download: "none", attempt: "idle" });
  const controller = createPopupController(h.api, h.root);
  await controller.refresh();
  assert(h.root.querySelector("#page-status").hidden, "Unknown status was presented as an unsupported tab or an error");
  assert(h.root.querySelector("#page-instruction").textContent === "Open a file link to begin",
    "Unknown context lacks neutral guidance");
  assert(h.root.querySelector("#activity-state").hidden, "Idle state fabricated a result");
  h.api.runtime.sendMessage = async () => undefined;
  await controller.refresh();
  assert(h.root.querySelector("#page-status").textContent === "Page details are not available.", "Empty response did not terminate");
});

await test("known supported page unknown state remains explicitly unknown", async () => {
  const h = await popupHarness(true);
  h.api.tabs.query = async () => [{ id: 1, url: "https://fuckingfast.co/abc123" }];
  h.api.runtime.sendMessage = async () => ({ detection: "unknown", attempt: "idle", download: "none" });
  const controller = createPopupController(h.api, h.root);
  await controller.refresh();
  assert(h.root.querySelector("#page-status").textContent === "Page detection not available yet.",
    "Known supported page was mislabeled unsupported");
  assert(h.root.querySelector("#activity-state").hidden, "Unknown detection fabricated download activity");
});

await test("genuine supported-page status request failure stays visible", async () => {
  const h = await popupHarness(true);
  h.api.tabs.query = async () => [{ id: 1, url: "https://fuckingfast.co/abc123" }];
  h.api.runtime.sendMessage = async () => { throw new Error("permission failure"); };
  const controller = createPopupController(h.api, h.root);
  await controller.refresh();
  assert(!h.root.querySelector("#page-status").hidden &&
    h.root.querySelector("#page-status").textContent.includes("Could not read this file page"),
  "Supported-page request failure was hidden behind generic guidance");
  assert(!h.root.querySelector("#automation-action").disabled, "Page status failure blocked the saved toggle");
});

await test("a valid supported-page status preserves its genuine error message", async () => {
  const h = await popupHarness(true);
  h.api.runtime.sendMessage = async () => ({
    detection: "candidate", attempt: "clicked", download: "unconfirmed", fallback: true,
    error: "No matching browser download was observed after one click."
  });
  const controller = createPopupController(h.api, h.root);
  await controller.refresh();
  assert(h.root.querySelector("#page-status").textContent === "Supported file page",
    "Valid status was rejected because it contained an error");
  assert(!h.root.querySelector("#error").hidden &&
    h.root.querySelector("#error").textContent.includes("No matching browser download"),
  "Supported-page error was discarded");
  assert(!h.root.querySelector("#fallback").hidden, "Valid status lost its manual fallback");
});

await test("supported detection states expose the actual control result", async () => {
  const h = await popupHarness(true);
  const controller = createPopupController(h.api, h.root);
  const messages = {
    missing: "Download control not found",
    invalid: "Download control needs manual review",
    ambiguous: "Multiple download controls found"
  };
  for (const [detection, expected] of Object.entries(messages)) {
    controller.render({ enabled: true, detection, attempt: "idle", download: "none" });
    const message = h.root.querySelector("#page-status").textContent;
    assert(!h.root.querySelector("#page-status").hidden && message === expected,
      `${detection} detection was hidden or called ready`);
  }
});

await test("error-only protocol reply remains a visible supported-page request failure", async () => {
  const h = await popupHarness(true);
  h.api.tabs.query = async () => [{ id: 1, url: "https://fuckingfast.co/abc123" }];
  h.api.runtime.sendMessage = async () => ({ error: "worker-error" });
  const controller = createPopupController(h.api, h.root);
  await controller.refresh();
  assert(!h.root.querySelector("#page-status").hidden &&
    h.root.querySelector("#page-status").textContent.includes("Could not read this file page"),
  "Error-only protocol response was accepted as a valid page status");
  assert(h.root.querySelector("#activity-state").hidden, "Protocol failure invented activity");
});

await test("a supported page and actual download observation remain separate", async () => {
  const h = await popupHarness(true);
  const controller = createPopupController(h.api, h.root);
  controller.render({ enabled: true, detection: "candidate", attempt: "idle", download: "none" });
  assert(h.root.querySelector("#page-status").textContent === "Supported file page", "Supported page was not shown");
  assert(h.root.querySelector("#activity-state").hidden, "Supported page implied a successful download");
  controller.render({ enabled: true, detection: "candidate", attempt: "clicked", download: "started" });
  assert(h.root.querySelector("#activity-state").textContent === "Download observed", "Confirmed event was not shown");
});

await test("missing saved setting terminates loading and reports an error", async () => {
  const h = await popupHarness(false);
  h.api.storage.local.get = () => new Promise(() => {});
  const controller = createPopupController(h.api, h.root, { requestTimeoutMs: 20 });
  await controller.refresh();
  assert(h.root.querySelector("#automation-title").textContent === "Setting unavailable", "Setting read stayed loading");
  assert(h.root.querySelector("#automation-action").disabled && !h.root.querySelector("#error").hidden,
    "Unavailable preference was treated as a valid setting");
});

await test("unanswered active-tab query terminates with usable saved settings", async () => {
  const h = await popupHarness(true);
  h.api.tabs.query = () => new Promise(() => {});
  const controller = createPopupController(h.api, h.root, { requestTimeoutMs: 20 });
  await controller.refresh();
  assert(h.root.querySelector("#page-status").textContent === "Page details are not available.", "Tab query stayed pending");
  assert(!h.root.querySelector("#automation-action").disabled, "Tab query blocked saved setting");
});

await test("late status responses cannot overwrite the latest popup state", async () => {
  const h = await popupHarness(true);
  let release;
  let requests = 0;
  h.api.runtime.sendMessage = () => {
    requests += 1;
    return requests === 1 ? new Promise((resolve) => { release = resolve; }) :
      Promise.resolve({ detection: "candidate", download: "none", attempt: "idle" });
  };
  const controller = createPopupController(h.api, h.root);
  const old = controller.refresh();
  await waitFor(() => Boolean(release));
  await controller.refresh();
  release({ detection: "unknown", download: "started" });
  await old;
  assert(h.root.querySelector("#page-status").textContent === "Supported file page", "Old response replaced latest detection");
  assert(h.root.querySelector("#activity-state").hidden, "Old response displayed a stale download result");
});

await test("a failed preference write keeps the saved setting and restores the button", async () => {
  const h = await popupHarness(false);
  h.api.storage.local.set = async () => { throw new Error("write failed"); };
  const controller = createPopupController(h.api, h.root);
  await controller.refresh();
  h.root.querySelector("#automation-action").click();
  await waitFor(() => !h.root.querySelector("#automation-action").disabled);
  assert(h.storage.autoEnabled === false, "Failed write changed the stored setting");
  assert(!h.root.querySelector("#error").hidden, "Failed write did not display an error");
});

await test("compact popup has no overflow in idle and error states", async () => {
  const frame = document.createElement("iframe");
  frame.style.cssText = "width:340px;height:600px;border:0";
  const loaded = new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
  frame.src = "../../src/popup/popup.html";
  document.body.append(frame);
  await loaded;
  const h = await popupHarness(true);
  const doc = frame.contentDocument;
  const controller = createPopupController(h.api, doc);
  controller.render({ enabled: true, detection: "unsupported-page", attempt: "idle", download: "none" });
  assert(doc.body.getBoundingClientRect().width === 340, "Popup width differs from 340px");
  assert(doc.body.getBoundingClientRect().height < 310, "Idle popup has excess vertical space");
  assert(doc.documentElement.scrollWidth <= 340, "Idle popup overflows horizontally");
  const action = doc.querySelector("#automation-action");
  const buttonStyle = frame.contentWindow.getComputedStyle(action);
  const cardStyle = frame.contentWindow.getComputedStyle(doc.querySelector("#automation-card"));
  const buttonBounds = action.getBoundingClientRect();
  assert(parseFloat(buttonStyle.fontSize) >= 14 && Number(buttonStyle.fontWeight) >= 600,
    "Main button typography is too small or light");
  assert(buttonBounds.height >= 44 && buttonBounds.height <= 48, "Main button height is not 44–48px");
  assert(buttonBounds.width === doc.querySelector(".popup").getBoundingClientRect().width,
    "Main button is not full width");
  assert(cardStyle.display === "flex" && cardStyle.alignItems === "center",
    "Status card is not a compact aligned horizontal layout");
  assert(cardStyle.minHeight === "auto" || parseFloat(cardStyle.minHeight) === 0,
    "Status card has an unnecessary minimum height");
  assert(doc.querySelector("#automation-card").getBoundingClientRect().height <= 64,
    "Idle status card is unnecessarily tall");
  controller.render({ enabled: false, detection: "unknown", fallback: true, error: "x".repeat(200) });
  assert(doc.documentElement.scrollWidth <= 340, "Error state overflows horizontally");
  assert(!doc.querySelector("#automation-state"), "Duplicate automation row remains");
  frame.remove();
});

await test("footer displays the actual manifest version", async () => {
  const h = await popupHarness(false);
  h.api.runtime.getManifest = () => ({ version: "9.8.7" });
  createPopupController(h.api, h.root);
  assert(h.root.querySelector("#version").textContent === "v9.8.7", "Footer version was hardcoded or missing");
  assert(h.root.querySelector("#page-instruction"), "Helpful footer instruction is missing");
});

for (const size of [16, 32, 48, 128, 512]) {
  await test(`${size}px icon is RGBA with transparent corners and visible artwork`, async () => {
    const path = `../../assets/icons/icon-${size}.png`;
    const response = await fetch(path);
    assert(response.ok, "Icon file is missing");
    const bytes = new Uint8Array(await response.arrayBuffer());
    const header = new DataView(bytes.buffer);
    assert(header.getUint32(16) === size && header.getUint32(20) === size, "PNG dimensions differ");
    assert(bytes[24] === 8 && bytes[25] === 6, "PNG does not have an 8-bit RGBA channel layout");
    const image = new Image();
    const loaded = new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
    image.src = path;
    await loaded;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, size, size).data;
    for (const index of [0, size - 1, size * (size - 1), size * size - 1]) {
      assert(pixels[index * 4 + 3] === 0, "A corner pixel is not fully transparent");
    }
    let visible = 0;
    let cyan = 0;
    let antialiased = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3];
      if (alpha > 200) visible += 1;
      if (alpha > 100 && pixels[index + 1] > 100 && pixels[index + 2] > 100 &&
          pixels[index + 2] > pixels[index] * 1.2) cyan += 1;
      if (alpha > 0 && alpha < 255) antialiased += 1;
    }
    assert(visible > size * size * .4 && cyan > size * size * .1, "Icon artwork is not visible");
    assert(antialiased > 0, "Icon has no smoothly blended alpha edge");
  });
}

await test("manifest and popup use the exported transparent artwork", async () => {
  const manifest = await (await fetch("../../manifest.json")).json();
  for (const size of [16, 32, 48, 128]) {
    assert(manifest.icons[String(size)] === `assets/icons/icon-${size}.png`, "Extension icon reference differs");
  }
  for (const size of [16, 32]) {
    assert(manifest.action.default_icon[String(size)] === `assets/icons/icon-${size}.png`, "Toolbar icon reference differs");
  }
  const root = await popupRoot();
  assert(root.querySelector(".brand-mark").getAttribute("src") === "../../assets/icons/icon-128.png",
    "Popup does not use the same exported artwork");
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

await runDetectionTests({ test, assert, fixture });
await runControllerTests({ test, assert });
let executed = 0;
for (const { name, run } of cases) {
  let timer;
  executed += 1;
  try {
    await Promise.race([Promise.resolve().then(run), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Test exceeded 2 seconds")), 2000);
    })]);
    passed += 1;
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  } finally { clearTimeout(timer); }
}
const result = { registered: cases.length, executed, passed, failed: failures.length, skipped: 0, failures };
document.getElementById("results").textContent = JSON.stringify(result);
import { runDetectionTests } from "./detection-tests.js";
import { runControllerTests } from "./controller-tests.js";
