"use strict";

// Read-only helper for later verified selectors and fixture tests. Every watch
// has a finite lifetime, and disconnect() clears both pending timers.
function watchForCandidate(root, selector, onResult, options = {}) {
  const debounceMs = options.debounceMs ?? 50;
  const timeoutMs = options.timeoutMs ?? 5000;
  if (!selector || !Number.isFinite(debounceMs) || debounceMs < 0 ||
      !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("A selector and finite, nonnegative timing are required");
  }

  let active = true;
  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(check, debounceMs);
  });

  function disconnect() {
    if (!active) return;
    active = false;
    observer.disconnect();
    clearTimeout(debounceTimer);
    clearTimeout(deadlineTimer);
  }

  function check() {
    debounceTimer = null;
    if (!active) return;
    const result = globalThis.FFAD.fuckingFast.detectCandidate(root, selector);
    onResult(result);
    if (result.status === "candidate" || result.status === "ambiguous") disconnect();
  }

  const deadlineTimer = setTimeout(disconnect, timeoutMs);
  observer.observe(root, { childList: true, subtree: true });
  check();
  return disconnect;
}

globalThis.FFAD = globalThis.FFAD || {};
globalThis.FFAD.watchForCandidate = watchForCandidate;
