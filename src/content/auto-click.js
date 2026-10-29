"use strict";

// One attempt per content-script document. A claim is recorded in the worker
// before invoking the page control, and the DOM is revalidated after the claim.
function createAutoClickEngine({ detect, claim, report, isEnabled = async () => true,
  onEvent = () => {} }) {
  let state = "idle";
  let claimSettled = Promise.resolve();

  async function clickVerified(first, expiresAt = Infinity) {
    let stillEnabled = false;
    try { stillEnabled = await isEnabled(); } catch { /* fail closed */ }
    if (!stillEnabled) {
      try { await report("disabled-after-claim"); } catch { /* claim remains recorded */ }
      return "disabled";
    }

    const current = detect();
    if (current.status !== "candidate" || current.count !== 1 ||
        current.element !== first.element || !current.element.isConnected) {
      try { await report("invalidated"); } catch { /* claim remains recorded */ }
      return "invalidated";
    }

    if (Date.now() >= expiresAt) {
      try { await report("grant-expired"); } catch { /* claim remains recorded */ }
      return "grant-expired";
    }

    try {
      onEvent("click-attempted");
      current.element.click();
    } catch {
      try { await report("click-error"); } catch { /* claim remains recorded */ }
      return "click-error";
    }
    try { await report("clicked"); } catch { /* claim remains recorded */ }
    return "clicked";
  }

  async function attempt() {
    if (state !== "idle") return "duplicate-attempt";
    const first = detect();
    if (first.status !== "candidate" || first.count !== 1 || !first.element) return "no-candidate";
    state = "requesting";

    let grant;
    try {
      claimSettled = Promise.resolve().then(claim);
      grant = await claimSettled;
    } catch {
      state = "used";
      return "claim-error";
    }
    if (grant?.queued) {
      state = "queued";
      return "attempt-queued";
    }
    state = "used";
    if (!grant?.allowed) return grant?.reason || "not-allowed";
    return clickVerified(first);
  }

  async function resume(expiresAt = Infinity) {
    if (state === "requesting") {
      await claimSettled;
      await Promise.resolve();
    }
    if (state !== "queued") return "duplicate-attempt";
    state = "used";
    const first = detect();
    if (first.status !== "candidate" || first.count !== 1 || !first.element) {
      try { await report("invalidated"); } catch { /* claim remains recorded */ }
      return "invalidated";
    }
    return clickVerified(first, expiresAt);
  }

  return Object.freeze({ attempt, resume,
    canAcceptQueuedGrant: () => state === "requesting" || state === "queued" });
}

globalThis.FFAD = globalThis.FFAD || {};
globalThis.FFAD.createAutoClickEngine = createAutoClickEngine;
