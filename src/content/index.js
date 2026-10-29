"use strict";

// Phase 2 only observes the page. Production button selectors are unverified.
const host = globalThis.FFAD.fuckingFast;
if (host.isSupportedUrl(location.href)) {
  const detection = host.detectCandidate(document);
  console.info(`[FFAD] Supported host; download control ${detection.status}. No action taken.`);
} else {
  console.info("[FFAD] Unsupported host. No action taken.");
}
