"use strict";

const FFAD_TIMEOUT_MS = 15000;
const FFAD_MATCH_WINDOW_MS = FFAD_TIMEOUT_MS;
const FFAD_STATE_PREFIX = "ffad:tab:";
const FFAD_QUEUE_SEQUENCE_KEY = "ffad:queue-sequence";
const FFAD_MAX_QUEUE = 16;
const FFAD_QUEUE_MAX_AGE_MS = 300000;

async function ffadFingerprint(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createDownloadController({ storage, getEnabled, now = Date.now, fingerprint = ffadFingerprint,
  sendToTab = async () => false, scheduleDeadline = async () => {}, clearDeadline = async () => {},
  onEvent = () => {} }) {
  const host = globalThis.FFAD.fuckingFast;
  const workerStartedAt = now();
  const elapsed = (since) => Math.max(0, Math.round(now() - since));
  const emit = (code, details = {}) => onEvent(code, { tMs: elapsed(workerStartedAt), ...details });
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
      attemptedAt: 0, clickedAt: 0, fingerprint: null, downloadId: null, queuedAt: 0, queueOrder: 0 };
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
      emit("attempt-timed-out", { sinceClaimMs: elapsed(record.attemptedAt) });
    }
    return record;
  }

  function tabEntries(all) {
    return Object.entries(all).filter(([key, record]) =>
      key.startsWith(FFAD_STATE_PREFIX) && record && Number.isInteger(Number(key.slice(FFAD_STATE_PREFIX.length))));
  }

  async function reconcile() {
    const all = await storage.get(null);
    for (const [key, record] of tabEntries(all)) {
      const tabId = Number(key.slice(FFAD_STATE_PREFIX.length));
      if (record.download === "waiting") await expire(tabId, record);
      if (record.attempt === "queued" && now() - record.queuedAt >= FFAD_QUEUE_MAX_AGE_MS) {
        const queueWaitMs = elapsed(record.queuedAt);
        record.attempt = "failed";
        record.fallback = true;
        record.error = "Queued attempt expired. Click manually if needed.";
        record.queuedAt = 0;
        record.queueOrder = 0;
        await putRecord(tabId, record);
        emit("queue-expired", { queueWaitMs });
      }
    }
  }

  async function updateAlarm() {
    const all = await storage.get(null);
    const deadlines = tabEntries(all).flatMap(([, record]) => {
      if (record.download === "waiting") return [record.attemptedAt + FFAD_TIMEOUT_MS];
      if (record.attempt === "queued") return [record.queuedAt + FFAD_QUEUE_MAX_AGE_MS];
      return [];
    });
    if (deadlines.length) await scheduleDeadline(Math.max(now() + 1000, Math.min(...deadlines)));
    else await clearDeadline();
  }

  async function promoteNext() {
    await reconcile();
    const all = await storage.get(null);
    if (tabEntries(all).some(([, record]) => record.download === "waiting")) {
      await updateAlarm();
      return;
    }
    const queued = tabEntries(all)
      .filter(([, record]) => record.attempt === "queued")
      .sort((a, b) => a[1].queueOrder - b[1].queueOrder);
    if (!(await getEnabled())) {
      for (const [key, record] of queued) {
        record.attempt = "failed";
        record.fallback = true;
        record.error = "Auto Download was turned off while queued.";
        record.queuedAt = 0;
        record.queueOrder = 0;
        await storage.set({ [key]: record });
      }
      if (queued.length) emit("automation-disabled");
      await updateAlarm();
      return;
    }
    for (const [key, record] of queued) {
      const tabId = Number(key.slice(FFAD_STATE_PREFIX.length));
      const queueWaitMs = elapsed(record.queuedAt);
      record.attempt = "claimed";
      record.download = "waiting";
      record.attemptedAt = now();
      record.queuedAt = 0;
      record.queueOrder = 0;
      await putRecord(tabId, record);
      await updateAlarm();
      emit("attempt-claimed", { sinceClaimMs: elapsed(record.attemptedAt) });
      let acknowledged = false;
      try {
        acknowledged = await sendToTab(tabId, record.documentId, {
          type: "FFAD_QUEUE_GRANTED", expiresAt: record.attemptedAt + FFAD_TIMEOUT_MS
        });
      } catch {
        // Delivery may be uncertain. Wait for a matching download or timeout
        // instead of risking a second simultaneous click.
        emit("waiting-for-confirmation", { sinceClaimMs: elapsed(record.attemptedAt) });
        return;
      }
      if (acknowledged) {
        emit("next-attempt-released", { queueWaitMs, sinceClaimMs: elapsed(record.attemptedAt) });
        return;
      }
      record.attempt = "failed";
      record.download = "unconfirmed";
      record.fallback = true;
      record.error = "Queued page is no longer available. Click manually if needed.";
      await putRecord(tabId, record);
      emit("queue-delivery-rejected", { sinceClaimMs: elapsed(record.attemptedAt) });
    }
    await updateAlarm();
  }

  async function reportPage(message, sender) {
    const page = pageFromSender(sender, false);
    if (!page) return { accepted: false };
    const allowed = new Set(["candidate", "missing", "invalid", "ambiguous", "unsupported-page", "error"]);
    if (!allowed.has(message.status)) return { accepted: false };
    const existing = await getRecord(page.tabId);
    const sameAttemptedPage = existing && existing.attemptedAt > 0 && existing.fingerprint ===
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
    if (!(await getEnabled())) return { allowed: false, reason: "automation-disabled" };
    const existing = await getRecord(page.tabId);
    if (!existing || existing.documentId !== page.documentId ||
        existing.detection !== "candidate" || existing.valid !== 1) {
      return { allowed: false, reason: "no-candidate" };
    }
    if (existing.attempt !== "idle") return { allowed: false, reason: "duplicate-attempt" };

    await reconcile();
    let all = await storage.get(null);
    if (!tabEntries(all).some(([, record]) => record.download === "waiting") &&
        tabEntries(all).some(([, record]) => record.attempt === "queued")) {
      await promoteNext();
      all = await storage.get(null);
    }
    const pageFingerprint = await fingerprint(page.fingerprintInput);
    const activeOrQueued = tabEntries(all).filter(([, record]) =>
      record.download === "waiting" || record.attempt === "queued");
    if (activeOrQueued.some(([, record]) => record.fingerprint === pageFingerprint)) {
      return { allowed: false, reason: "duplicate-attempt" };
    }
    if (activeOrQueued.length) {
      const queuedCount = activeOrQueued.filter(([, record]) => record.attempt === "queued").length;
      if (!sender.documentId || queuedCount >= FFAD_MAX_QUEUE) {
        existing.attempt = "failed";
        existing.fallback = true;
        existing.error = !sender.documentId ? "This Chrome version cannot safely queue the page." :
          "Automation queue is full. Click manually if needed.";
        await putRecord(page.tabId, existing);
        return { allowed: false, reason: !sender.documentId ? "queue-unavailable" : "queue-full" };
      }
      const sequence = ((await storage.get(FFAD_QUEUE_SEQUENCE_KEY))[FFAD_QUEUE_SEQUENCE_KEY] || 0) + 1;
      await storage.set({ [FFAD_QUEUE_SEQUENCE_KEY]: sequence });
      existing.attempt = "queued";
      existing.fingerprint = pageFingerprint;
      existing.queuedAt = now();
      existing.queueOrder = sequence;
      await putRecord(page.tabId, existing);
      await updateAlarm();
      emit("attempt-queued", { queueDepth: queuedCount + 1 });
      return { allowed: false, queued: true, reason: "attempt-queued" };
    }

    existing.attempt = "claimed";
    existing.download = "waiting";
    existing.attemptedAt = now();
    existing.fingerprint = pageFingerprint;
    await putRecord(page.tabId, existing);
    await updateAlarm();
    emit("attempt-claimed", { sinceClaimMs: elapsed(existing.attemptedAt) });
    return { allowed: true, reason: "attempt-started" };
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
      record.clickedAt = now();
      emit("click-reported", { sinceClaimMs: elapsed(record.attemptedAt) });
    } else if (["invalidated", "click-error", "disabled-after-claim", "grant-expired"].includes(message.result)) {
      record.attempt = "failed";
      record.download = "unconfirmed";
      record.fallback = true;
      record.error = message.result === "click-error" ? "Automatic click failed." :
        message.result === "disabled-after-claim" ? "Auto Download was turned off before clicking." :
          message.result === "grant-expired" ? "Queued grant expired before clicking." :
            "Control changed before clicking.";
    } else return { accepted: false };
    await putRecord(page.tabId, record);
    if (record.attempt === "failed") await promoteNext();
    return { accepted: true };
  }

  async function status(tabId) {
    await promoteNext();
    const enabled = await getEnabled();
    if (!Number.isInteger(tabId)) return { enabled, ...publicState(null) };
    const record = await getRecord(tabId);
    return { enabled, ...publicState(record) };
  }

  async function downloadCreated(item, extensionId) {
    const pending = tabEntries(await storage.get(null))
      .filter(([, record]) => record.download === "waiting");
    if (!pending.length) return false;
    emit("download-event-received", { sinceClaimMs: elapsed(pending[0][1].attemptedAt) });
    const unmatched = (reason) => {
      emit("download-unmatched", { reason, sinceClaimMs: elapsed(pending[0][1].attemptedAt) });
      return false;
    };
    if (!Number.isInteger(item?.id)) return unmatched("missing-download-id");
    if (item.byExtensionId && item.byExtensionId !== extensionId) return unmatched("other-extension");
    if (!item.referrer) return unmatched("missing-referrer");
    let referrer;
    try {
      if (!host.isSupportedUrl(item.referrer)) return unmatched("unsupported-referrer");
      const url = new URL(item.referrer);
      if (!/^\/[A-Za-z0-9_-]+$/.test(url.pathname)) return unmatched("invalid-referrer-path");
      referrer = await fingerprint(`${url.origin}${url.pathname}`);
    } catch { return unmatched("invalid-referrer"); }
    const startedAt = Date.parse(item.startTime);
    if (!Number.isFinite(startedAt)) return unmatched("invalid-start-time");

    const all = await storage.get(null);
    const matches = tabEntries(all).filter(([, record]) =>
      record.download === "waiting" &&
      record.fingerprint === referrer && startedAt >= record.attemptedAt &&
      startedAt <= record.attemptedAt + FFAD_MATCH_WINDOW_MS &&
      now() - record.attemptedAt <= FFAD_MATCH_WINDOW_MS);
    if (matches.length !== 1) {
      const sameFile = pending.some(([, record]) => record.fingerprint === referrer);
      return unmatched(matches.length > 1 ? "ambiguous-attempt" :
        sameFile ? "outside-confirmation-window" : "referrer-mismatch");
    }
    const [key, record] = matches[0];
    emit("download-matched", { sinceClaimMs: elapsed(record.attemptedAt),
      sinceClickMs: record.clickedAt ? elapsed(record.clickedAt) : null });
    record.download = item.state === "interrupted" ? "interrupted" : "started";
    record.downloadId = item.id;
    record.fallback = item.state === "interrupted";
    record.error = item.state === "interrupted" ? "Browser download was interrupted." : null;
    await storage.set({ [key]: record });
    emit(item.state === "interrupted" ? "download-unconfirmed" : "attempt-confirmed",
      { sinceClaimMs: elapsed(record.attemptedAt) });
    await promoteNext();
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
    await promoteNext();
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
    if (record.attempt === "queued") {
      record.attempt = "failed";
      record.queuedAt = 0;
      record.queueOrder = 0;
      record.fallback = true;
      record.error = "Page navigated before its queued attempt.";
      emit("tab-navigated");
    }
    await putRecord(tabId, record);
    await promoteNext();
  }

  async function tabRemoved(tabId) {
    if (Number.isInteger(tabId)) {
      await storage.remove(keyFor(tabId));
      emit("tab-closed");
      await promoteNext();
    }
  }

  async function enabledChanged(enabled) {
    if (enabled) {
      await promoteNext();
      return;
    }
    const all = await storage.get(null);
    for (const [key, record] of tabEntries(all)) {
      if (record.attempt !== "queued") continue;
      record.attempt = "failed";
      record.queuedAt = 0;
      record.queueOrder = 0;
      record.fallback = true;
      record.error = "Auto Download was turned off while queued.";
      await storage.set({ [key]: record });
    }
    await updateAlarm();
    emit("automation-disabled");
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
      await promoteNext();
      return { accepted: true };
    });
    return { error: "unknown-message" };
  }

  return Object.freeze({ handleMessage,
    downloadCreated: (item, extensionId) => locked(() => downloadCreated(item, extensionId)),
    downloadChanged: (delta) => locked(() => downloadChanged(delta)),
    tabLoading: (tabId) => locked(() => tabLoading(tabId)),
    tabRemoved: (tabId) => locked(() => tabRemoved(tabId)),
    enabledChanged: (enabled) => locked(() => enabledChanged(enabled)),
    recover: () => locked(() => promoteNext()),
    tick: () => locked(() => promoteNext()) });
}

globalThis.FFAD = globalThis.FFAD || {};
globalThis.FFAD.createDownloadController = createDownloadController;
