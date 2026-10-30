"use strict";

// Confirmed by the supplied saved-page evidence. No other host is assumed.
const FUCKINGFAST_HOSTNAMES = Object.freeze(["fuckingfast.co"]);
const FILE_ID_PATTERN = "[A-Za-z0-9_-]+";
const FILE_PAGE_PATTERN = new RegExp(`^/(${FILE_ID_PATTERN})$`);
const POST_PATH_PATTERN = new RegExp(`^/f/(${FILE_ID_PATTERN})/go$`);
const REQUIRED_CLASSES = Object.freeze(["link-button", "text-5xl", "gay-button"]);

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

// Retained for synthetic fixture tests. Production detection uses the stricter
// evidence-based method below and never passes a fixture selector.
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

function parseFilePageUrl(input) {
  if (!isSupportedUrl(input)) return null;
  const url = new URL(input);
  // The file ID belongs to the path. A filename fragment and query are optional.
  const match = FILE_PAGE_PATTERN.exec(url.pathname);
  if (!match) return null;
  return { url, fileId: match[1] };
}

function isVisible(element) {
  if (!element.isConnected || element.getClientRects().length === 0) return false;
  const view = element.ownerDocument.defaultView;
  if (!view) return false;
  for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
    if (node.hasAttribute("hidden") || node.hasAttribute("inert") ||
        node.getAttribute("aria-hidden") === "true") return false;
    const style = view.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" ||
        style.visibility === "collapse" || Number(style.opacity) === 0) return false;
  }
  return true;
}

function validateControl(element, page) {
  if (element.tagName !== "A") return "wrong-element-type";
  if (!REQUIRED_CLASSES.every((name) => element.classList.contains(name))) return "wrong-attributes";
  if (element.getAttribute("hx-swap") !== "none" ||
      !element.relList.contains("noopener") || element.hasAttribute("href")) return "wrong-attributes";
  if (element.textContent.replace(/\s+/g, " ").trim() !== "DOWNLOAD") return "wrong-text";
  if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") return "disabled";
  if (!isVisible(element)) return "hidden";

  const post = element.getAttribute("hx-post");
  const match = POST_PATH_PATTERN.exec(post);
  if (!match) return "invalid-post-path";
  const destination = new URL(post, page.url);
  if (destination.origin !== page.url.origin || destination.pathname !== post ||
      destination.search || destination.hash) return "cross-origin-post";
  if (match[1] !== page.fileId) return "wrong-file-id";
  return null;
}

// Pure detection. The returned element must be revalidated immediately before use.
function detectDownloadControl(root, pageUrl) {
  if (!isSupportedUrl(pageUrl)) {
    return { status: "unsupported-host", count: 0, invalidCount: 0, reason: null, element: null };
  }
  const page = parseFilePageUrl(pageUrl);
  if (!page) {
    return { status: "unsupported-page", count: 0, invalidCount: 0, reason: null, element: null };
  }

  const controls = Array.from(root.querySelectorAll("[hx-post]"));
  const valid = [];
  const invalid = [];
  for (const element of controls) {
    const reason = validateControl(element, page);
    if (reason) invalid.push(reason);
    else valid.push(element);
  }

  if (valid.length > 1) {
    return { status: "ambiguous", count: valid.length, invalidCount: invalid.length,
      reason: null, element: null };
  }
  if (valid.length === 1) {
    return { status: "candidate", count: 1, invalidCount: invalid.length,
      reason: null, element: valid[0] };
  }
  if (invalid.length) {
    return { status: "invalid", count: 0, invalidCount: invalid.length,
      reason: invalid[0], element: null };
  }
  return { status: "missing", count: 0, invalidCount: 0, reason: null, element: null };
}

function normalizeFilename(value, fromDownloadPath = false) {
  if (typeof value !== "string") return null;
  const name = fromDownloadPath ? value.split(/[\\/]/).pop() : value;
  if (!name || name.length > 255 || /[\\/\u0000-\u001f\u007f]/.test(name)) return null;
  const normalized = (fromDownloadPath ? name : name.trim()).normalize("NFC");
  if (!normalized || normalized === "." || normalized === "..") return null;
  return normalized;
}

// The supplied saved page shows one filename heading above the verified control.
// Do not require a particular wrapper around that heading.
function expectedFilename(root, pageUrl) {
  const page = parseFilePageUrl(pageUrl);
  if (!page) return null;
  const control = detectDownloadControl(root, pageUrl);
  if (control.status !== "candidate") return null;
  const headings = Array.from(root.querySelectorAll("h1"));
  if (headings.length !== 1 || !isVisible(headings[0]) ||
      !(headings[0].compareDocumentPosition(control.element) & Node.DOCUMENT_POSITION_FOLLOWING)) return null;
  const title = normalizeFilename(headings[0].textContent);
  if (!title) return null;
  if (page.url.hash) {
    let fragment;
    try { fragment = normalizeFilename(decodeURIComponent(page.url.hash.slice(1))); }
    catch { return null; }
    if (!fragment || fragment !== title) return null;
  }
  return title;
}

globalThis.FFAD = globalThis.FFAD || {};
globalThis.FFAD.fuckingFast = Object.freeze({
  supportedHostnames: FUCKINGFAST_HOSTNAMES,
  isSupportedUrl,
  parseFilePageUrl,
  normalizeFilename,
  expectedFilename,
  detectCandidate,
  detectDownloadControl
});
