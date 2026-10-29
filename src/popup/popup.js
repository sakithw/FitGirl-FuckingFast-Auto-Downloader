"use strict";

const version = chrome.runtime.getManifest().version;
document.getElementById("version").textContent = `Version ${version}`;

const toggle = document.getElementById("auto-enabled");
const detection = document.getElementById("detection");
const attempt = document.getElementById("attempt");
const download = document.getElementById("download");
const fallback = document.getElementById("fallback");
const error = document.getElementById("error");

const labels = {
  candidate: "Verified candidate",
  missing: "Control missing",
  invalid: "Invalid control",
  ambiguous: "Ambiguous controls",
  "unsupported-page": "Unsupported page",
  "unsupported-host": "Unsupported host",
  unknown: "No page status",
  idle: "None",
  claimed: "Claimed",
  queued: "Waiting in queue",
  clicked: "Clicked once",
  failed: "Failed",
  none: "Not confirmed",
  waiting: "Waiting for event",
  started: "Matching download started",
  complete: "Download complete",
  interrupted: "Download interrupted",
  unconfirmed: "No matching download"
};

async function refresh() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const state = await chrome.runtime.sendMessage({ type: "GET_STATUS", tabId: tab?.id });
    toggle.checked = state.enabled === true;
    detection.textContent = labels[state.detection] || state.detection;
    attempt.textContent = labels[state.attempt] || state.attempt;
    download.textContent = labels[state.download] || state.download;
    fallback.hidden = !state.fallback;
    error.hidden = !state.error;
    error.textContent = state.error || "";
  } catch {
    detection.textContent = "Status unavailable";
    error.hidden = false;
    error.textContent = "Could not read extension status. Reload the extension.";
  }
}

toggle.addEventListener("change", async () => {
  toggle.disabled = true;
  try {
    await chrome.storage.local.set({ autoEnabled: toggle.checked });
    await refresh();
  } catch {
    toggle.checked = !toggle.checked;
    error.hidden = false;
    error.textContent = "Could not save Auto Download preference.";
  } finally {
    toggle.disabled = false;
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" || (area === "local" && changes.autoEnabled)) refresh();
});

refresh();
