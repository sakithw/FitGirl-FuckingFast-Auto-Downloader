"use strict";

importScripts("../hosts/fuckingfast.js", "controller.js");

const controller = globalThis.FFAD.createDownloadController({
  storage: chrome.storage.session,
  getEnabled: async () => (await chrome.storage.local.get({ autoEnabled: false })).autoEnabled === true
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
