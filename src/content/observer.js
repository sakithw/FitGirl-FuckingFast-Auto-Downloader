"use strict";

// Read-only helper for later verified selectors and fixture tests. Every watch
// has a finite lifetime, and disconnect() clears both pending timers.
function watchForCandidate(root, detectorOrSelector, onResult, options = {}) {
  const debounceMs = options.debounceMs ?? 50;
  const timeoutMs = options.timeoutMs ?? 5000;
  const onActivity = options.onActivity || (() => {});
  const detector = typeof detectorOrSelector === "function" ? detectorOrSelector :
    (scope) => globalThis.FFAD.fuckingFast.detectCandidate(scope, detectorOrSelector);
  if (!detectorOrSelector || !Number.isFinite(debounceMs) || debounceMs < 0 ||
      !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("A detector or selector and finite, nonnegative timing are required");
  }

  let active = true;
  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => check(true), debounceMs);
  });

  function disconnect(reason = "manual") {
    if (!active) return;
    active = false;
    observer.disconnect();
    clearTimeout(debounceTimer);
    clearTimeout(deadlineTimer);
    onActivity(reason);
  }

  function check(fromMutation = false) {
    debounceTimer = null;
    if (!active) return;
    if (fromMutation) onActivity("recheck");
    const result = detector(root);
    onResult(result);
    if (options.stopOnCandidate !== false &&
        (result.status === "candidate" || result.status === "ambiguous")) disconnect("resolved");
  }

  const deadlineTimer = setTimeout(() => disconnect("timeout"), timeoutMs);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
    attributeFilter: ["class", "hx-post", "hx-swap", "rel", "href", "hidden", "inert", "style", "aria-hidden", "aria-disabled", "disabled"]
  });
  onActivity("started");
  check();
  return () => disconnect("manual");
}

globalThis.FFAD = globalThis.FFAD || {};
globalThis.FFAD.watchForCandidate = watchForCandidate;
