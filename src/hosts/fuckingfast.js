"use strict";

// This hostname comes from the Phase 1 manifest. No other host is assumed.
const FUCKINGFAST_HOSTNAMES = Object.freeze(["fuckingfast.co"]);

function isSupportedUrl(input) {
  try {
    const url = new URL(input);
    return url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.port === "" &&
      FUCKINGFAST_HOSTNAMES.includes(url.hostname);
  } catch {
    return false;
  }
}

// Pure DOM selection. A selector must be supplied by the caller. There is no
// production selector yet, so the extension always receives "unverified".
function detectCandidate(root, selector = null) {
  if (!selector) {
    return { status: "unverified", count: 0, element: null };
  }

  const matches = Array.from(root.querySelectorAll(selector)).filter((element) => {
    const tag = element.tagName;
    return (tag === "A" || tag === "BUTTON") &&
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-disabled") !== "true";
  });

  if (matches.length === 0) {
    return { status: "missing", count: 0, element: null };
  }
  if (matches.length > 1) {
    return { status: "ambiguous", count: matches.length, element: null };
  }
  return { status: "candidate", count: 1, element: matches[0] };
}

globalThis.FFAD = globalThis.FFAD || {};
globalThis.FFAD.fuckingFast = Object.freeze({
  supportedHostnames: FUCKINGFAST_HOSTNAMES,
  isSupportedUrl,
  detectCandidate
});
