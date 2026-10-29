"use strict";

const FFAD_TIMEOUT_MS = 15000;
const FFAD_MATCH_WINDOW_MS = FFAD_TIMEOUT_MS;
const FFAD_STATE_PREFIX = "ffad:tab:";

async function ffadFingerprint(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createDownloadController({ storage, getEnabled, now = Date.now, fingerprint = ffadFingerprint }) {
  const host = globalThis.FFAD.fuckingFast;
  let serial = Promise.resolve();
  const locked = (work) => {
    const next = serial.then(work, work);
    serial = next.catch(() => {});
    return next;
  };
  const keyFor = (tabId) => `${FFAD_STATE_PREFIX}${tabId}`;

  function pageFromSender(sender, requireFilePage = true) {
    if (!Number.isInteger(sender?.tab?.id) || sender.frameId !== 0 ||
        !host.isSupportedUrl(sender.url)) return null;
    const url = new URL(sender.url);
    if (requireFilePage && !/^\/[A-Za-z0-9_-]+$/.test(url.pathname)) return null;
    return { tabId: sender.tab.id, documentId: sender.documentId || `tab-${sender.tab.id}`,
      fingerprintInput: `${url.origin}${url.pathname}` };
  }

  function fresh(documentId) {
    return { documentId, detection: "unknown", valid: 0, invalid: 0, reason: null,
      attempt: "idle", download: "none", fallback: false, error: null,
      attemptedAt: 0, fingerprint: null, downloadId: null };
  }

  function publicState(record) {
    if (!record) return { detection: "unknown", valid: 0, invalid: 0, reason: null,
      attempt: "idle", download: "none", fallback: false, error: null };
    const { detection, valid, invalid, reason, attempt, download, fallback, error } = record;
    return { detection, valid, invalid, reason, attempt, download, fallback, error };
  }

  async function getRecord(tabId) {
    const key = keyFor(tabId);
    return (await storage.get(key))[key];
  }

  async function putRecord(tabId, record) {
    await storage.set({ [keyFor(tabId)]: record });
  }

  async function expire(tabId, record) {
    if (record?.download === "waiting" && now() - record.attemptedAt >= FFAD_TIMEOUT_MS) {
      record.download = "unconfirmed";
      record.fallback = true;
      record.error = "No matching browser download was observed after one click.";
      await putRecord(tabId, record);
    }
    return record;
  }

  async function reportPage(message, sender) {
    const page = pageFromSender(sender, false);
    if (!page) return { accepted: false };
    const allowed = new Set(["candidate", "missing", "invalid", "ambiguous", "unsupported-page", "error"]);
    if (!allowed.has(message.status)) return { accepted: false };
    const existing = await getRecord(page.tabId);
    const sameAttemptedPage = existing && existing.attempt !== "idle" && existing.fingerprint ===
      await fingerprint(page.fingerprintInput);
    const record = existing?.documentId === page.documentId || sameAttemptedPage ?
      existing : fresh(page.documentId);
    record.documentId = page.documentId;
    record.detection = message.status;
    record.valid = Number.isInteger(message.valid) ? Math.max(0, Math.min(message.valid, 99)) : 0;
    record.invalid = Number.isInteger(message.invalid) ? Math.max(0, Math.min(message.invalid, 99)) : 0;
    record.reason = typeof message.reason === "string" && /^[a-z-]{1,40}$/.test(message.reason) ? message.reason : null;
    await putRecord(page.tabId, record);
    return { accepted: true };
  }

  async function claim(sender) {
    const page = pageFromSender(sender);
    if (!page) return { allowed: false, reason: "unsupported-page" };
    if (!(await getEnabled())) return { allowed: false, reason: "disabled" };
    const existing = await getRecord(page.tabId);
    if (!existing || existing.documentId !== page.documentId ||
        existing.detection !== "candidate" || existing.valid !== 1) {
      return { allowed: false, reason: "no-candidate" };
    }
    if (existing.attempt !== "idle") return { allowed: false, reason: "duplicate" };

    const all = await storage.get(null);
    for (const [key, record] of Object.entries(all)) {
      if (!key.startsWith(FFAD_STATE_PREFIX) || !record || record.download !== "waiting") continue;
      const otherTabId = Number(key.slice(FFAD_STATE_PREFIX.length));
      await expire(otherTabId, record);
      if (record.download === "waiting") return { allowed: false, reason: "busy" };
    }

    existing.attempt = "claimed";
    existing.download = "waiting";
    existing.attemptedAt = now();
    existing.fingerprint = await fingerprint(page.fingerprintInput);
    await putRecord(page.tabId, existing);
    return { allowed: true };
  }

  async function reportAttempt(message, sender) {
    const page = pageFromSender(sender);
    if (!page) return { accepted: false };
    const record = await getRecord(page.tabId);
    if (!record || record.documentId !== page.documentId || record.attempt !== "claimed") {
      return { accepted: false };
    }
    if (message.result === "clicked") {
      record.attempt = "clicked";
    } else if (["invalidated", "click-error", "disabled-after-claim"].includes(message.result)) {
      record.attempt = "failed";
      record.download = "unconfirmed";
      record.fallback = true;
      record.error = message.result === "click-error" ? "Automatic click failed." :
        message.result === "disabled-after-claim" ? "Auto Download was turned off before clicking." :
          "Control changed before clicking.";
    } else return { accepted: false };
    await putRecord(page.tabId, record);
    return { accepted: true };
  }

  async function status(tabId) {
    const enabled = await getEnabled();
    if (!Number.isInteger(tabId)) return { enabled, ...publicState(null) };
    const record = await expire(tabId, await getRecord(tabId));
    return { enabled, ...publicState(record) };
  }

  async function downloadCreated(item, extensionId) {
    if (!item?.referrer || !Number.isInteger(item.id) ||
        (item.byExtensionId && item.byExtensionId !== extensionId)) return false;
    let referrer;
    try {
      if (!host.isSupportedUrl(item.referrer)) return false;
      const url = new URL(item.referrer);
      if (!/^\/[A-Za-z0-9_-]+$/.test(url.pathname)) return false;
      referrer = await fingerprint(`${url.origin}${url.pathname}`);
    } catch { return false; }
    const startedAt = Date.parse(item.startTime);
    if (!Number.isFinite(startedAt)) return false;

    const all = await storage.get(null);
    const matches = Object.entries(all).filter(([key, record]) =>
      key.startsWith(FFAD_STATE_PREFIX) && record?.download === "waiting" &&
      record.fingerprint === referrer && startedAt >= record.attemptedAt &&
      startedAt <= record.attemptedAt + FFAD_MATCH_WINDOW_MS &&
      now() - record.attemptedAt <= FFAD_MATCH_WINDOW_MS);
    if (matches.length !== 1) return false;
    const [key, record] = matches[0];
    record.download = item.state === "interrupted" ? "interrupted" : "started";
    record.downloadId = item.id;
    record.fallback = item.state === "interrupted";
    record.error = item.state === "interrupted" ? "Browser download was interrupted." : null;
    await storage.set({ [key]: record });
    return true;
  }

  async function downloadChanged(delta) {
    const state = delta?.state?.current;
    if (!Number.isInteger(delta?.id) || (state !== "complete" && state !== "interrupted")) return false;
    const all = await storage.get(null);
    const match = Object.entries(all).find(([key, record]) =>
      key.startsWith(FFAD_STATE_PREFIX) && record?.downloadId === delta.id);
    if (!match) return false;
    const [key, record] = match;
    record.download = state;
    record.fallback = state === "interrupted";
    record.error = state === "interrupted" ? "Browser download was interrupted." : null;
    await storage.set({ [key]: record });
    return true;
  }

  async function tabLoading(tabId) {
    if (!Number.isInteger(tabId)) return;
    const record = await getRecord(tabId);
    if (!record) return;
    record.detection = "unknown";
    record.valid = 0;
    record.invalid = 0;
    record.reason = null;
    await putRecord(tabId, record);
  }

  async function tabRemoved(tabId) {
    if (Number.isInteger(tabId)) await storage.remove(keyFor(tabId));
  }

  async function handleMessage(message, sender) {
    if (!message || typeof message.type !== "string") return { error: "invalid-message" };
    if (message.type === "GET_STATUS") return locked(() => status(message.tabId));
    if (message.type === "PAGE_STATUS") return locked(() => reportPage(message, sender));
    if (message.type === "CLAIM_ATTEMPT") return locked(() => claim(sender));
    if (message.type === "ATTEMPT_RESULT") return locked(() => reportAttempt(message, sender));
    if (message.type === "NO_DOWNLOAD") return locked(async () => {
      const page = pageFromSender(sender);
      if (!page) return { accepted: false };
      const record = await getRecord(page.tabId);
      if (!record || record.documentId !== page.documentId) return { accepted: false };
      await expire(page.tabId, record);
      return { accepted: true };
    });
    return { error: "unknown-message" };
  }

  return Object.freeze({ handleMessage,
    downloadCreated: (item, extensionId) => locked(() => downloadCreated(item, extensionId)),
    downloadChanged: (delta) => locked(() => downloadChanged(delta)),
    tabLoading: (tabId) => locked(() => tabLoading(tabId)),
    tabRemoved: (tabId) => locked(() => tabRemoved(tabId)) });
}

globalThis.FFAD = globalThis.FFAD || {};
globalThis.FFAD.createDownloadController = createDownloadController;
