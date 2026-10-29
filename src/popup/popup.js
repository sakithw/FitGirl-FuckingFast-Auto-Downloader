"use strict";

const version = chrome.runtime.getManifest().version;
document.getElementById("version").textContent = `Version ${version}`;
