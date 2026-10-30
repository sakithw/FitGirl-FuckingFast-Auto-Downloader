export async function runControllerTests({ test, assert }) {
  const { createDownloadController, createAutoClickEngine } = globalThis.FFAD;
  const baseTime = Date.parse("2026-01-01T00:00:00.000Z");

  function harness({ enabled = true, realHash = false } = {}) {
    const data = {};
    const events = [];
    const deadlines = [];
    const lookups = [];
    const metadata = new Map();
    let currentTime = baseTime;
    let autoEnabled = enabled;
    const storage = {
      async get(key) {
        if (key === null) return structuredClone(data);
        return Object.hasOwn(data, key) ? { [key]: structuredClone(data[key]) } : {};
      },
      async set(values) { Object.assign(data, structuredClone(values)); },
      async remove(key) { delete data[key]; }
    };
    const create = () => createDownloadController({
      storage, getEnabled: async () => autoEnabled, now: () => currentTime,
      ...(realHash ? {} : { fingerprint: async (value) => `hash:${value}` }),
      scheduleDeadline: async (when) => { deadlines.push(when); },
      clearDeadline: async () => { deadlines.push(null); },
      lookupDownload: async (id) => { lookups.push(id); return metadata.get(id) || null; },
      onEvent: (code, details) => { events.push({ code, ...details }); }
    });
    let controller = create();
    const sender = (tabId = 1, documentId = `document-${tabId}`, url = `https://fuckingfast.co/file-${tabId}`) => ({
      tab: { id: tabId }, frameId: 0, documentId, url
    });
    const report = (tabId = 1, extra = {}, documentId) => controller.handleMessage({
      type: "PAGE_STATUS", status: "candidate", valid: 1, invalid: 0,
      expectedFilename: `file-${tabId}.rar`, ...extra
    }, sender(tabId, documentId));
    const claim = (tabId = 1, documentId) => controller.handleMessage({ type: "CLAIM_ATTEMPT" }, sender(tabId, documentId));
    const click = (tabId = 1, clickedAt = currentTime, documentId) => controller.handleMessage({
      type: "ATTEMPT_RESULT", result: "clicked", clickedAt
    }, sender(tabId, documentId));
    const status = (tabId = 1) => controller.handleMessage({ type: "GET_STATUS", tabId }, {});
    const download = (id = 100, extra = {}) => controller.downloadCreated({
      id, referrer: "", filename: "C:\\Downloads\\file-1.rar",
      startTime: new Date(currentTime).toISOString(), state: "in_progress", ...extra
    }, "our-extension");
    return { data, events, deadlines, metadata, lookups, sender, report, claim, click, status, download,
      get controller() { return controller; },
      now: () => currentTime,
      advance: (ms) => { currentTime += ms; },
      setEnabled: (value) => { autoEnabled = value; },
      restart: () => { controller = create(); return controller; }
    };
  }

  await test("controller denies a claim until one verified candidate is reported", async () => {
    const h = harness();
    assert((await h.claim()).reason === "no-candidate", "Unreported page received a claim");
    await h.report(1, { status: "ambiguous", valid: 2 });
    assert((await h.claim()).reason === "no-candidate", "Ambiguous controls received a claim");
    await h.report();
    assert((await h.claim()).allowed, "Single verified candidate was denied");
  });

  await test("controller respects OFF and allows a newly eligible page after ON", async () => {
    const h = harness({ enabled: false });
    await h.report();
    assert((await h.claim()).reason === "automation-disabled", "OFF preference allowed a claim");
    h.setEnabled(true);
    assert((await h.claim()).allowed, "ON preference did not allow an eligible claim");
  });

  await test("claim is persisted before the content script can trigger a download", async () => {
    const h = harness();
    await h.report();
    await h.claim();
    const record = h.data["ffad:tab:1"];
    assert(record.attempt === "claimed" && record.download === "waiting" && record.attemptedAt === h.now(),
      "Claim was not durable before grant response");
  });

  await test("repeated observations preserve the one-attempt document latch", async () => {
    const h = harness();
    await h.report(); await h.claim(); await h.click();
    await h.report(); await h.report();
    assert((await h.claim()).reason === "already-attempted", "Repeated observation reset attempt state");
  });

  await test("controller rejects spoofed hosts and non-top-frame messages", async () => {
    const h = harness();
    for (const sender of [
      h.sender(1, "spoof", "https://fuckingfast.co.evil.invalid/file-1"),
      { ...h.sender(), frameId: 2 }
    ]) {
      assert(!(await h.controller.handleMessage({ type: "PAGE_STATUS", status: "candidate", valid: 1 }, sender)).accepted,
        "Unsafe sender supplied detection state");
      assert((await h.controller.handleMessage({ type: "CLAIM_ATTEMPT" }, sender)).reason === "unsupported-page",
        "Unsafe sender obtained a claim");
    }
  });

  await test("navigation resets detection and a new document gets its own attempt", async () => {
    const h = harness();
    await h.report(); await h.claim(); await h.click();
    await h.controller.tabLoading(1);
    assert((await h.status()).detection === "unknown", "Navigation left stale detection");
    await h.report(1, {}, "next-document");
    assert((await h.claim(1, "next-document")).allowed, "New document was blocked by old document state");
    assert(!(await h.controller.handleMessage({ type: "ATTEMPT_RESULT", result: "clicked" }, h.sender())).accepted,
      "Old document overwrote the navigated page's attempt");
  });

  await test("tab closure removes its session record without blocking another tab", async () => {
    const h = harness();
    await h.report(); await h.claim();
    await h.controller.tabRemoved(1);
    assert(!Object.hasOwn(h.data, "ffad:tab:1"), "Closed tab retained session state");
    await h.report(2);
    assert((await h.claim(2)).allowed, "Closed tab blocked a later independent page");
  });

  await test("worker restart preserves pending attempts and duplicate protection", async () => {
    const h = harness();
    await h.report(); await h.claim(); await h.click();
    h.restart(); await h.controller.recover();
    assert((await h.claim()).reason === "already-attempted", "Restart reset the document latch");
    assert((await h.status()).download === "waiting", "Restart lost pending confirmation");
    h.advance(16000); await h.controller.tick();
    assert((await h.status()).download === "unconfirmed", "Restarted worker did not expire pending state");
  });

  await test("exact referrer confirms only its pending file page", async () => {
    const h = harness();
    await h.report(); await h.claim(); await h.click();
    assert(!(await h.download(101, { referrer: "https://fuckingfast.co/other-file", filename: "other.rar" })),
      "Different referrer was attributed");
    assert(await h.download(102, { referrer: "https://fuckingfast.co/file-1?source=test#file-1.rar", filename: "" }),
      "Matching referrer was not recognized");
    assert(h.events.some((event) => event.code === "download-matched-referrer"), "Referrer match method was not reported");
  });

  await test("missing referrer can match exact filename without blocking an active download", async () => {
    const h = harness();
    await h.report(); await h.claim(); await h.click();
    h.advance(500);
    assert(await h.download(), "Exact Windows basename was not matched");
    assert((await h.status()).download === "started", "Started download was not recorded");
    await h.report(2);
    assert((await h.claim(2)).allowed, "An active large download blocked the next page");
  });

  await test("wrong filenames, duplicate suffixes, and other-extension downloads stay unrelated", async () => {
    const h = harness();
    await h.report(); await h.claim(); await h.click();
    for (const [index, extra] of [
      { filename: "C:\\Downloads\\unrelated.rar" },
      { filename: "C:\\Downloads\\file-1 (1).rar" },
      { byExtensionId: "another-extension" }
    ].entries()) assert(!(await h.download(110 + index, extra)), "Unrelated download was attributed");
    assert((await h.status()).download === "waiting", "Unrelated event changed confirmation");
  });

  await test("missing referrer and filename stay unconfirmed until timeout", async () => {
    const h = harness();
    await h.report(); await h.claim(); await h.click();
    assert(!(await h.download(120, { filename: "" })), "Metadata-free event was treated as proof");
    h.advance(16000); await h.controller.tick();
    const status = await h.status();
    assert(status.download === "unconfirmed" && status.fallback, "Insufficient evidence did not reach manual fallback");
  });

  await test("same expected filename in two pending tabs is not uniquely attributed", async () => {
    const h = harness();
    await h.report(1, { expectedFilename: "shared.rar" });
    await h.report(2, { expectedFilename: "shared.rar" });
    await h.claim(1); await h.claim(2); await h.click(1); await h.click(2);
    assert(!(await h.download(121, { filename: "C:\\Downloads\\shared.rar" })), "Ambiguous same-name download was attributed");
    assert((await h.status(1)).download === "waiting" && (await h.status(2)).download === "waiting",
      "Ambiguous metadata changed an independent attempt");
  });

  await test("one download ID cannot confirm two attempts or be counted twice", async () => {
    const h = harness();
    await h.report(); await h.claim(); await h.click();
    assert(await h.download(122), "First event did not confirm");
    await h.report(2); await h.claim(2); await h.click(2);
    assert(!(await h.download(122, { filename: "file-2.rar" })), "Known download ID confirmed a second attempt");
    assert((await h.status(2)).download === "waiting", "Duplicate download changed second tab state");
  });

  await test("complete and interrupted events update only a previously matched download", async () => {
    const h = harness();
    await h.report(); await h.claim(); await h.click(); await h.download(123);
    assert(!(await h.controller.downloadChanged({ id: 999, state: { current: "complete" } })),
      "Unrelated completion was attributed");
    assert(await h.controller.downloadChanged({ id: 123, state: { current: "interrupted" } }),
      "Matched interruption was missed");
    assert((await h.status()).fallback, "Interruption did not offer manual fallback");
  });

  await test("OFF after a click prevents new claims without altering an existing download", async () => {
    const h = harness();
    await h.report(); await h.claim(); await h.click();
    h.setEnabled(false); await h.controller.enabledChanged(false);
    assert(await h.download(124), "Existing download could not be observed after OFF");
    await h.report(2);
    assert((await h.claim(2)).reason === "automation-disabled", "OFF allowed a new automatic attempt");
  });

  await test("a changed control or disabled setting stops before a DOM click", async () => {
    for (const disabled of [true, false]) {
      let clicks = 0;
      const control = { isConnected: true, click: () => { clicks += 1; } };
      const reports = [];
      let changed = false;
      const engine = createAutoClickEngine({
        detect: () => changed ? { status: "missing", count: 0, element: null } : { status: "candidate", count: 1, element: control },
        claim: async () => { if (!disabled) changed = true; return { allowed: true }; },
        isEnabled: async () => !disabled,
        report: async (result) => reports.push(result)
      });
      assert(await engine.attempt() === (disabled ? "disabled" : "invalidated"), "Engine did not stop safely");
      assert(clicks === 0 && reports.length === 1, "Engine activated an invalid or disabled page");
    }
  });

  await test("early referrer event is reconciled after the click report", async () => {
    const h = harness();
    await h.report(); await h.claim();
    const clickedAt = h.now();
    h.advance(10);
    assert(!(await h.download(130, { referrer: "https://fuckingfast.co/file-1", filename: "" })),
      "Early event confirmed before click evidence");
    await h.click(1, clickedAt);
    assert((await h.status()).download === "started", "Early referrer metadata was never reconciled");
  });

  await test("a uniquely pending metadata-free event can match a later filename", async () => {
    const h = harness();
    await h.report(); await h.claim(); await h.click();
    await h.download(131, { filename: "" });
    assert(await h.controller.downloadChanged({ id: 131, filename: { current: "C:\\Downloads\\file-1.rar" } }),
      "Delayed filename was ignored");
    assert((await h.status()).download === "started", "Delayed filename did not confirm");
  });

  await test("metadata-free events cannot choose between multiple pending file pages", async () => {
    const h = harness();
    await h.report(1); await h.report(2); await h.claim(1); await h.claim(2); await h.click(1); await h.click(2);
    await h.download(132, { filename: "" });
    assert(!(await h.controller.downloadChanged({ id: 132, filename: { current: "file-1.rar" } })),
      "Unassigned metadata event was retroactively attributed between multiple pages");
  });

  await test("a filename download that started before the click stays unrelated", async () => {
    const h = harness();
    await h.report(); await h.claim();
    h.advance(100); await h.click();
    assert(!(await h.download(133, { startTime: new Date(h.now() - 50).toISOString() })),
      "Pre-click browser download was attributed by filename");
  });

  await test("a conflicting explicit referrer cannot be relabeled a filename match", async () => {
    const h = harness();
    await h.report(); await h.claim(); await h.click();
    assert(!(await h.download(134, { referrer: "https://unrelated.invalid/download" })),
      "Conflicting referrer was overridden by a filename coincidence");
  });

  await test("missing filename candidate survives restart and uses a targeted metadata lookup", async () => {
    const h = harness();
    await h.report(); await h.claim(); await h.click();
    await h.download(135, { filename: "" });
    h.restart(); await h.controller.recover();
    h.metadata.set(135, { id: 135, filename: "C:\\Downloads\\file-1.rar", state: "in_progress" });
    assert(await h.controller.downloadChanged({ id: 135, paused: { current: false } }),
      "Restarted candidate did not use updated metadata");
    assert(h.lookups.join(",") === "135", "Metadata lookup queried an unrelated download ID");
  });

  await test("late metadata cannot confirm after the bounded attempt window", async () => {
    const h = harness();
    await h.report(); await h.claim(); await h.click();
    await h.download(136, { referrer: "https://fuckingfast.co/file-1", filename: "" });
    h.advance(16000); await h.controller.tick();
    assert(!(await h.controller.downloadChanged({ id: 136, filename: { current: "file-1.rar" } })),
      "Expired attempt accepted late metadata");
  });

  await test("session records and diagnostics store hashes without raw private paths", async () => {
    const h = harness({ realHash: true });
    await h.report(); await h.claim(); await h.click();
    const record = h.data["ffad:tab:1"];
    assert(/^[a-f0-9]{64}$/.test(record.fingerprint) && /^[a-f0-9]{64}$/.test(record.expectedFilenameHash),
      "Production fingerprint did not hash page path and expected filename");
    const stored = JSON.stringify(h.data);
    const logged = JSON.stringify(h.events);
    assert(!stored.includes("https://") && !stored.includes("file-1.rar") && !stored.includes("Downloads"),
      "Session records retained raw URLs or filenames");
    assert(!logged.includes("https://") && !logged.includes("file-1.rar") && !logged.includes("Downloads"),
      "Diagnostics exposed private values");
  });
}
