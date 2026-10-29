"use strict";

// A single verified-control click is allowed only after the user enables it.
const host = globalThis.FFAD.fuckingFast;
if (host.isSupportedUrl(location.href)) {
  console.info("[FFAD] Supported host detected.");
  const originalPagePath = new URL(location.href).pathname;
  const contentStartedAt = performance.now();
  const elapsed = () => Math.max(0, Math.round(performance.now() - contentStartedAt));
  let previous = "";
  let recheckLogged = false;
  let attemptStarted = false;
  let queuedAtPageMs = null;
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
    report: (result) => send("ATTEMPT_RESULT", { result }),
    isEnabled: async () => (await chrome.storage.local.get({ autoEnabled: false })).autoEnabled === true,
    onEvent: (code) => console.info(`[FFAD] ${code}; page t+${elapsed()}ms.`)
  });

  const reportOutcome = (outcome) => {
    if (outcome === "attempt-queued") queuedAtPageMs = elapsed();
    console.info(`[FFAD] Automatic attempt: ${outcome}; page t+${elapsed()}ms.`);
    if (outcome === "clicked") setTimeout(() => { send("NO_DOWNLOAD"); }, 16000);
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "FFAD_QUEUE_GRANTED") return;
    if (!engine.canAcceptQueuedGrant() || !host.isSupportedUrl(location.href) ||
        new URL(location.href).pathname !== originalPagePath) {
      sendResponse({ accepted: false });
      return;
    }
    console.info(`[FFAD] queue-grant-received; page t+${elapsed()}ms; queueWaitMs=${
      queuedAtPageMs === null ? "unknown" : elapsed() - queuedAtPageMs}.`);
    sendResponse({ accepted: true });
    engine.resume(message.expiresAt).then(reportOutcome).catch(() => {
      send("ATTEMPT_RESULT", { result: "click-error" });
      console.error("[FFAD] Automatic attempt: click-error.");
    });
  });

  const disconnect = globalThis.FFAD.watchForCandidate(document, detect,
    async (result) => {
      const key = `${result.status}:${result.reason || ""}:${result.count}:${result.invalidCount}`;
      if (key !== previous) {
        previous = key;
        const message = `[FFAD] Detection: ${result.status}; valid=${result.count}; invalid=${result.invalidCount}; reason=${result.reason || "none"}.`;
        if (result.status === "error") console.error(message);
        else console.info(message);
      }
      const reported = send("PAGE_STATUS", {
        status: result.status, valid: result.count, invalid: result.invalidCount,
        reason: result.reason
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
