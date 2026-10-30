"use strict";

function createPopupController(api, root, { requestTimeoutMs = 2000 } = {}) {
  const get = (id) => root.getElementById ? root.getElementById(id) : root.querySelector(`#${id}`);
  const action = get("automation-action");
  const label = get("action-label");
  const card = get("automation-card");
  const title = get("automation-title");
  const description = get("automation-description");
  const check = get("status-check");
  const pause = get("status-pause");
  const page = get("page-status");
  const instruction = get("page-instruction");
  const activity = get("activity-state");
  const fallback = get("fallback");
  const error = get("error");
  let refreshId = 0;
  let saving = false;
  let settingKnown = false;
  const detections = new Set(["unknown", "candidate", "missing", "invalid", "ambiguous",
    "error", "unsupported-page", "unsupported-host"]);
  get("version").textContent = `v${api.runtime.getManifest().version}`;

  function pageContext(tab) {
    if (typeof tab?.url !== "string") return "unknown";
    try {
      const url = new URL(tab.url);
      if (["chrome:", "chrome-extension:", "chrome-search:", "edge:", "about:"].includes(url.protocol)) return "restricted";
      return url.protocol === "https:" && url.hostname === "fuckingfast.co" && url.port === "" &&
        !url.username && !url.password && /^\/[A-Za-z0-9_-]+$/.test(url.pathname) ? "supported" : "unrelated";
    } catch { return "unknown"; }
  }

  async function bounded(work) {
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(work),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("request-timeout")), requestTimeoutMs); })
      ]);
    } finally { clearTimeout(timer); }
  }

  function showError(message) {
    error.hidden = !message;
    error.textContent = message || "";
  }

  function render(state) {
    settingKnown = typeof state.enabled === "boolean";
    const enabled = state.enabled === true;
    card.classList.remove("is-loading", "is-enabled", "is-disabled");
    card.classList.add(enabled ? "is-enabled" : "is-disabled");
    title.textContent = settingKnown ? enabled ? "Automation Enabled" : "Automation Paused" : "Setting unavailable";
    description.textContent = settingKnown ? enabled ? "Ready for supported links" :
      "Enable to automate downloads" : "Reload the extension to try again.";
    check.toggleAttribute("hidden", !settingKnown || !enabled);
    pause.toggleAttribute("hidden", settingKnown && enabled);
    label.textContent = enabled ? "Disable Auto Download" : "Enable Auto Download";
    action.classList.toggle("is-enabled", enabled);
    action.disabled = saving || !settingKnown;

    const nonFile = ["restricted", "unrelated"].includes(state.pageContext) ||
      ["unsupported-page", "unsupported-host"].includes(state.detection);
    const detectionLabels = { candidate: "Supported file page", missing: "Download control not found",
      invalid: "Download control needs manual review", ambiguous: "Multiple download controls found",
      error: "Could not inspect this file page." };
    const supported = !nonFile && (state.pageContext === "supported" || Boolean(detectionLabels[state.detection]));
    page.hidden = nonFile || (!supported && !state.statusFailure);
    page.textContent = state.statusFailure ? supported ? "Could not read this file page's status." :
      "Page details are not available." : detectionLabels[state.detection] ||
        (supported ? "Page detection not available yet." : "");
    instruction.textContent = supported ? "" : "Open a file link to begin";

    const downloads = { started: "Download observed", complete: "Download complete",
      interrupted: "Download interrupted", unconfirmed: "Download not confirmed", waiting: "Waiting for download confirmation" };
    const attempts = { claimed: "Automatic click pending", clicked: "Automatic click attempted", failed: "Manual action required" };
    activity.textContent = downloads[state.download] || attempts[state.attempt] || "";
    activity.hidden = !activity.textContent;
    fallback.hidden = !state.fallback;
    showError(state.error);
  }

  async function refresh() {
    const id = ++refreshId;
    const [saved, tabs] = await Promise.allSettled([
      bounded(() => api.storage.local.get({ autoEnabled: false })),
      bounded(() => api.tabs.query({ active: true, currentWindow: true }))
    ]);
    if (id !== refreshId) return;
    const settingAvailable = saved.status === "fulfilled" && saved.value && typeof saved.value === "object";
    const enabled = settingAvailable ? saved.value.autoEnabled === true : undefined;
    // Resolve the setting before asking the worker so an unanswered page check
    // cannot keep the primary control stuck in its loading state.
    render({ enabled, detection: "unknown" });
    const tab = tabs.status === "fulfilled" ? tabs.value?.[0] : null;
    const context = pageContext(tab);
    let state = { detection: "unknown" };
    if (!["restricted", "unrelated"].includes(context) && Number.isInteger(tab?.id)) {
      try {
        const response = await bounded(() => api.runtime.sendMessage({ type: "GET_STATUS", tabId: tab.id }));
        // A valid status may include a real page/download error. An error-only
        // protocol response has no detection state and is handled separately.
        state = response && typeof response === "object" && detections.has(response.detection) ?
          response : { detection: "unknown", statusFailure: "invalid-response" };
      } catch { state.statusFailure = "request-failed"; }
    } else if (tabs.status === "rejected") {
      state.statusFailure = "tab-query-failed";
    }
    if (id !== refreshId) return;
    render({ ...state, enabled, pageContext: context });
    if (!settingAvailable) showError("Could not read Auto Download setting. Reload the extension.");
  }

  async function changeSetting() {
    if (saving || !settingKnown) return;
    saving = true;
    action.disabled = true;
    showError("");
    try {
      const current = (await bounded(() => api.storage.local.get({ autoEnabled: false }))).autoEnabled === true;
      await bounded(() => api.storage.local.set({ autoEnabled: !current }));
      await refresh();
    } catch { showError("Could not save Auto Download preference."); }
    finally { saving = false; action.disabled = !settingKnown; }
  }

  action.addEventListener("click", changeSetting);
  api.storage.onChanged.addListener((changes, area) => {
    if (area === "session" || (area === "local" && changes.autoEnabled)) refresh();
  });
  return Object.freeze({ refresh, render });
}

if (typeof chrome !== "undefined" && chrome.runtime?.getManifest && document.getElementById("version")) {
  createPopupController(chrome, document).refresh();
}

globalThis.FFAD = globalThis.FFAD || {};
globalThis.FFAD.createPopupController = createPopupController;
