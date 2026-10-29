"use strict";

// One attempt per content-script document. A claim is recorded in the worker
// before invoking the page control, and the DOM is revalidated after the claim.
function createAutoClickEngine({ detect, claim, report, isEnabled = async () => true }) {
  let used = false;

  async function attempt() {
    if (used) return "duplicate";
    const first = detect();
    if (first.status !== "candidate" || first.count !== 1 || !first.element) return "no-candidate";
    used = true;

    let grant;
    try {
      grant = await claim();
    } catch {
      return "claim-error";
    }
    if (!grant?.allowed) return grant?.reason || "not-allowed";

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

    try {
      current.element.click();
    } catch {
      try { await report("click-error"); } catch { /* claim remains recorded */ }
      return "click-error";
    }
    try { await report("clicked"); } catch { /* claim remains recorded */ }
    return "clicked";
  }

  return Object.freeze({ attempt });
}

globalThis.FFAD = globalThis.FFAD || {};
globalThis.FFAD.createAutoClickEngine = createAutoClickEngine;
