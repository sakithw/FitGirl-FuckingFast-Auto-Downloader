"use strict";

importScripts("../hosts/fuckingfast.js", "controller.js");

const controller = globalThis.FFAD.createDownloadController({
  storage: chrome.storage.session,
  getEnabled: async () => (await chrome.storage.local.get({ autoEnabled: false })).autoEnabled === true,
  sendToTab: async (tabId, documentId, message) => {
    const response = await chrome.tabs.sendMessage(tabId, message, { documentId });
    return response?.accepted === true;
  },
  scheduleDeadline: (when) => chrome.alarms.create("ffad-deadline", { when }),
  clearDeadline: () => chrome.alarms.clear("ffad-deadline"),
  lookupDownload: async (id) => (await chrome.downloads.search({ id }))[0] || null,
  onEvent: (code, details) => {
    const fields = ["tMs", "sinceClaimMs", "sinceClickMs", "pendingCount", "value", "reason"]
      .filter((key) => details[key] !== null && details[key] !== undefined)
      .map((key) => `${key}=${details[key]}`);
    console.info(`[FFAD] ${code}; ${fields.join("; ")}.`);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.info("[FFAD] Extension installed. Auto Download defaults to OFF.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  controller.handleMessage(message, sender)
    .then(sendResponse)
    .catch(() => sendResponse({ error: "worker-error" }));
  return true;
});

chrome.downloads.onCreated.addListener((item) => {
  controller.downloadCreated(item, chrome.runtime.id).catch(() => {
    console.error("[FFAD] Download event could not be processed.");
  });
});

chrome.downloads.onChanged.addListener((delta) => {
  controller.downloadChanged(delta).catch(() => {
    console.error("[FFAD] Download status could not be processed.");
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  controller.tabRemoved(tabId).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") controller.tabLoading(tabId).catch(() => {});
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "ffad-deadline") controller.tick().catch(() => {
    console.error("[FFAD] Queue deadline could not be processed.");
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.autoEnabled) {
    controller.enabledChanged(changes.autoEnabled.newValue === true).catch(() => {});
  }
});

controller.recover().catch(() => {
  console.error("[FFAD] Queue recovery failed.");
});
