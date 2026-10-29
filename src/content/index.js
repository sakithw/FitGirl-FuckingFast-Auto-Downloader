"use strict";

// A single verified-control click is allowed only after the user enables it.
const host = globalThis.FFAD.fuckingFast;
if (host.isSupportedUrl(location.href)) {
  console.info("[FFAD] Supported host detected.");
  const contentStartedAt = performance.now();
  const elapsed = () => Math.max(0, Math.round(performance.now() - contentStartedAt));
  let previous = "";
  let recheckLogged = false;
  let attemptStarted = false;
  let previousFilenameEvidence = null;
  const enabledAtLoad = chrome.storage.local.get({ autoEnabled: false })
    .then((settings) => settings.autoEnabled === true)
    .catch(() => false);
  const send = (type, extra = {}) => chrome.runtime.sendMessage({ type, ...extra }).catch(() => null);
  const detect = () => {
    try {
      return host.detectDownloadControl(document, location.href);
    } catch {
      return { status: "error", count: 0, invalidCount: 0, reason: "dom-detection-failed", element: null };
    }
  };
  const engine = globalThis.FFAD.createAutoClickEngine({
    detect,
    claim: () => send("CLAIM_ATTEMPT"),
    report: (result, clickedAt) => send("ATTEMPT_RESULT", { result, clickedAt }),
    isEnabled: async () => (await chrome.storage.local.get({ autoEnabled: false })).autoEnabled === true,
    onEvent: (code) => console.info(`[FFAD] ${code}; page t+${elapsed()}ms.`)
  });

  const reportOutcome = (outcome) => {
    console.info(`[FFAD] Automatic attempt: ${outcome}; page t+${elapsed()}ms.`);
    if (outcome === "clicked") setTimeout(() => { send("NO_DOWNLOAD"); }, 16000);
  };

  const disconnect = globalThis.FFAD.watchForCandidate(document, detect,
    async (result) => {
      const key = `${result.status}:${result.reason || ""}:${result.count}:${result.invalidCount}`;
      if (key !== previous) {
        previous = key;
        const message = `[FFAD] Detection: ${result.status}; valid=${result.count}; invalid=${result.invalidCount}; reason=${result.reason || "none"}.`;
        if (result.status === "error") console.error(message);
        else console.info(message);
      }
      let expectedFilename = null;
      if (result.status === "candidate") {
        try { expectedFilename = host.expectedFilename(document, location.href); }
        catch { console.info("[FFAD] Filename evidence unavailable."); }
        const present = expectedFilename !== null;
        if (present !== previousFilenameEvidence) {
          previousFilenameEvidence = present;
          console.info(`[FFAD] page-filename-evidence-present=${present}.`);
        }
      }
      const reported = send("PAGE_STATUS", {
        status: result.status, valid: result.count, invalid: result.invalidCount,
        reason: result.reason, expectedFilename
      });
      if (result.status !== "candidate" || attemptStarted) return;
      attemptStarted = true;
      if (!(await enabledAtLoad)) return;
      await reported;
      const outcome = await engine.attempt();
      reportOutcome(outcome);
    },
    {
      debounceMs: 100,
      timeoutMs: 10000,
      stopOnCandidate: false,
      onActivity: (activity) => {
        if (activity === "started") console.info("[FFAD] Observer active for up to 10 seconds.");
        else if (activity === "recheck" && !recheckLogged) {
          recheckLogged = true;
          console.info("[FFAD] DOM changed; detection rechecked.");
        } else if (activity === "timeout") console.info("[FFAD] Observer finished; final detection state shown above.");
      }
    });
  addEventListener("pagehide", disconnect, { once: true });
} else {
  console.info("[FFAD] Unsupported host. No action taken.");
}
