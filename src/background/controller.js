"use strict";

const FFAD_TIMEOUT_MS = 15000;
const FFAD_STATE_PREFIX = "ffad:tab:";

async function ffadFingerprint(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createDownloadController({ storage, getEnabled, now = Date.now, fingerprint = ffadFingerprint,
  scheduleDeadline = async () => {}, clearDeadline = async () => {},
  lookupDownload = async () => null, onEvent = () => {} }) {
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
  const pageFromSender = (sender, requireFilePage = true) => {
    if (!Number.isInteger(sender?.tab?.id) || sender.frameId !== 0 ||
        !host.isSupportedUrl(sender.url)) return null;
    const url = new URL(sender.url);
    if (requireFilePage && !/^\/[A-Za-z0-9_-]+$/.test(url.pathname)) return null;
    return { tabId: sender.tab.id, documentId: sender.documentId || `tab-${sender.tab.id}`,
      fingerprintInput: `${url.origin}${url.pathname}` };
  };
  const fresh = (documentId) => ({
    documentId, detection: "unknown", valid: 0, invalid: 0, reason: null,
    attempt: "idle", download: "none", fallback: false, error: null,
    attemptedAt: 0, clickedAt: 0, fingerprint: null, expectedFilenameHash: null,
    downloadId: null, metadataCandidates: [], metadataDetails: [], metadataAmbiguous: false
  });
  const publicState = (record) => {
    if (!record) return { detection: "unknown", valid: 0, invalid: 0, reason: null,
      attempt: "idle", download: "none", fallback: false, error: null };
    const { detection, valid, invalid, reason, attempt, download, fallback, error } = record;
    return { detection, valid, invalid, reason, attempt, download, fallback, error };
  };
  const getRecord = async (tabId) => (await storage.get(keyFor(tabId)))[keyFor(tabId)];
  const putRecord = (tabId, record) => storage.set({ [keyFor(tabId)]: record });
  const entries = (all) => Object.entries(all).filter(([key, record]) =>
    key.startsWith(FFAD_STATE_PREFIX) && record && Number.isInteger(Number(key.slice(FFAD_STATE_PREFIX.length))));

  async function expire(tabId, record) {
    if (record?.download === "waiting" && now() - record.attemptedAt >= FFAD_TIMEOUT_MS) {
      record.download = "unconfirmed";
      record.fallback = true;
      record.error = "No matching browser download was observed after one click.";
      await putRecord(tabId, record);
      emit("attempt-timed-out", { sinceClaimMs: elapsed(record.attemptedAt) });
      return true;
    }
    return false;
  }

  async function updateAlarm() {
    const all = await storage.get(null);
    const deadlines = entries(all)
      .filter(([, record]) => record.download === "waiting")
      .map(([, record]) => record.attemptedAt + FFAD_TIMEOUT_MS);
    if (deadlines.length) await scheduleDeadline(Math.max(now() + 1000, Math.min(...deadlines)));
    else await clearDeadline();
  }

  async function reconcile() {
    const all = await storage.get(null);
    for (const [key, record] of entries(all)) await expire(Number(key.slice(FFAD_STATE_PREFIX.length)), record);
    await updateAlarm();
  }

  async function reportPage(message, sender) {
    const page = pageFromSender(sender, false);
    if (!page) return { accepted: false };
    const allowed = new Set(["candidate", "missing", "invalid", "ambiguous", "unsupported-page", "error"]);
    if (!allowed.has(message.status)) return { accepted: false };
    const existing = await getRecord(page.tabId);
    const sameDocument = existing?.documentId === page.documentId;
    const record = sameDocument ? existing : fresh(page.documentId);
    record.documentId = page.documentId;
    record.detection = message.status;
    record.valid = Number.isInteger(message.valid) ? Math.max(0, Math.min(message.valid, 99)) : 0;
    record.invalid = Number.isInteger(message.invalid) ? Math.max(0, Math.min(message.invalid, 99)) : 0;
    record.reason = typeof message.reason === "string" && /^[a-z-]{1,40}$/.test(message.reason) ? message.reason : null;
    if (record.attempt === "idle" && message.status === "candidate") {
      const name = host.normalizeFilename(message.expectedFilename);
      record.expectedFilenameHash = name ? await fingerprint(`filename:${name}`) : null;
    }
    await putRecord(page.tabId, record);
    return { accepted: true };
  }

  async function claim(sender) {
    const page = pageFromSender(sender);
    if (!page) return { allowed: false, reason: "unsupported-page" };
    if (!(await getEnabled())) return { allowed: false, reason: "automation-disabled" };
    const record = await getRecord(page.tabId);
    if (!record || record.documentId !== page.documentId ||
        record.detection !== "candidate" || record.valid !== 1) {
      return { allowed: false, reason: "no-candidate" };
    }
    if (record.attempt !== "idle") return { allowed: false, reason: "already-attempted" };
    record.attempt = "claimed";
    record.download = "waiting";
    record.attemptedAt = now();
    record.fingerprint = await fingerprint(page.fingerprintInput);
    await putRecord(page.tabId, record);
    await updateAlarm();
    emit("attempt-claimed", { sinceClaimMs: 0 });
    return { allowed: true, reason: "attempt-started" };
  }

  async function confirmDownload(key, record, id, state, method) {
    record.download = state === "interrupted" ? "interrupted" : "started";
    record.downloadId = id;
    record.metadataCandidates = [];
    record.metadataDetails = [];
    record.metadataAmbiguous = false;
    record.fallback = state === "interrupted";
    record.error = state === "interrupted" ? "Browser download was interrupted." : null;
    await storage.set({ [key]: record });
    emit(`download-matched-${method}`, { sinceClaimMs: elapsed(record.attemptedAt),
      sinceClickMs: record.clickedAt ? elapsed(record.clickedAt) : null });
    emit(state === "interrupted" ? "download-unconfirmed" : "attempt-confirmed",
      { sinceClaimMs: elapsed(record.attemptedAt) });
    await updateAlarm();
    return true;
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
      record.clickedAt = Number.isFinite(message.clickedAt) &&
        message.clickedAt >= record.attemptedAt && message.clickedAt <= now() ? message.clickedAt : now();
      emit("click-reported", { sinceClaimMs: elapsed(record.attemptedAt) });
      const candidate = record.metadataDetails?.find((detail) =>
        Number.isInteger(detail.id) && detail.startedAt >= record.clickedAt &&
        detail.startedAt <= record.clickedAt + FFAD_TIMEOUT_MS &&
        (!detail.referrerHash || detail.referrerHash === record.fingerprint ||
          detail.filenameHash === record.expectedFilenameHash));
      if (candidate) {
        await confirmDownload(`${FFAD_STATE_PREFIX}${page.tabId}`, record, candidate.id,
          candidate.state, candidate.referrerHash ? "referrer" : "filename");
        return { accepted: true };
      }
    } else if (["invalidated", "click-error", "disabled-after-claim", "grant-expired"].includes(message.result)) {
      record.attempt = "failed";
      record.download = "unconfirmed";
      record.fallback = true;
      record.error = message.result === "click-error" ? "Automatic click failed." :
        message.result === "disabled-after-claim" ? "Auto Download was turned off before clicking." :
          message.result === "grant-expired" ? "Click grant expired." : "Control changed before clicking.";
    } else return { accepted: false };
    await putRecord(page.tabId, record);
    return { accepted: true };
  }

  async function matchFilename(key, record, id, path, state) {
    const name = host.normalizeFilename(path, true);
    if (!name || !record.expectedFilenameHash || !record.clickedAt) return false;
    const hash = await fingerprint(`filename:${name}`);
    const detail = record.metadataDetails?.find((candidate) => candidate.id === id);
    const startedAt = detail?.startedAt;
    if (hash !== record.expectedFilenameHash || !detail || !Number.isFinite(startedAt) ||
        startedAt < record.clickedAt || startedAt - record.clickedAt > FFAD_TIMEOUT_MS ||
        now() - record.clickedAt > FFAD_TIMEOUT_MS) return false;
    return confirmDownload(key, record, id, state, "filename");
  }

  async function downloadCreated(item, extensionId) {
    if (!Number.isInteger(item?.id) || (item.byExtensionId && item.byExtensionId !== extensionId)) return false;
    const startedAt = Date.parse(item.startTime);
    if (!Number.isFinite(startedAt)) return false;
    const all = await storage.get(null);
    const pending = entries(all).filter(([, record]) =>
      record.download === "waiting" && record.attemptedAt <= startedAt &&
      startedAt <= record.attemptedAt + FFAD_TIMEOUT_MS && now() - record.attemptedAt <= FFAD_TIMEOUT_MS);
    if (!pending.length || entries(all).some(([, record]) => record.downloadId === item.id)) return false;
    let matches = [];
    if (item.referrer && host.isSupportedUrl(item.referrer)) {
      const referrer = new URL(item.referrer);
      const hash = await fingerprint(`${referrer.origin}${referrer.pathname}`);
      matches = pending.filter(([, record]) => record.fingerprint === hash);
    }
    const hasExplicitReferrer = typeof item.referrer === "string" && item.referrer.length > 0;
    if (!hasExplicitReferrer && matches.length !== 1 && item.filename) {
      const nameHash = await fingerprint(`filename:${host.normalizeFilename(item.filename, true) || ""}`);
      matches = pending.filter(([, record]) => record.expectedFilenameHash === nameHash &&
        record.attempt === "clicked" && startedAt >= record.clickedAt);
    }
    if (matches.length !== 1) {
      if (!hasExplicitReferrer && !item.filename && pending.length === 1) {
        const [key, record] = pending[0];
        record.metadataCandidates = [item.id];
        record.metadataDetails = [{ id: item.id, startedAt, filenameHash: null, referrerHash: null, state: item.state }];
        await storage.set({ [key]: record });
      }
      return false;
    }
    const [key, record] = matches[0];
    if (record.attempt === "claimed") {
      record.metadataCandidates = [item.id];
      record.metadataDetails = [{ id: item.id, startedAt,
        filenameHash: item.filename ? await fingerprint(`filename:${host.normalizeFilename(item.filename, true) || ""}`) : null,
        referrerHash: item.referrer && host.isSupportedUrl(item.referrer) ?
          await fingerprint(`${new URL(item.referrer).origin}${new URL(item.referrer).pathname}`) : null,
        state: item.state }];
      await storage.set({ [key]: record });
      return false;
    }
    return confirmDownload(key, record, item.id, item.state, item.referrer ? "referrer" : "filename");
  }

  async function downloadChanged(delta) {
    if (!Number.isInteger(delta?.id)) return false;
    const all = await storage.get(null);
    const match = entries(all).find(([key, record]) => record.download === "waiting" &&
      record.metadataCandidates?.includes(delta.id));
    if (match && !delta.filename?.current) {
      const metadata = await lookupDownload(delta.id);
      if (metadata) {
        if (metadata.filename) delta.filename = { current: metadata.filename };
        if (metadata.state) delta.state = { current: metadata.state };
      }
    }
    if (match && delta.filename?.current) {
      const [key, record] = match;
      return matchFilename(key, record, delta.id, delta.filename.current, delta.state?.current);
    }
    if (!["complete", "interrupted"].includes(delta?.state?.current)) return false;
    const completed = entries(all).find(([, record]) => record.downloadId === delta.id);
    if (!completed) return false;
    const [key, record] = completed;
    record.download = delta.state.current;
    record.fallback = delta.state.current === "interrupted";
    record.error = record.fallback ? "Browser download was interrupted." : null;
    await storage.set({ [key]: record });
    return true;
  }

  async function status(tabId) {
    await reconcile();
    const enabled = await getEnabled();
    return { enabled, ...publicState(Number.isInteger(tabId) ? await getRecord(tabId) : null) };
  }

  async function tabLoading(tabId) {
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
    await updateAlarm();
  }

  async function enabledChanged() {
    await updateAlarm();
  }

  async function tick() {
    await reconcile();
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
      await updateAlarm();
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
    recover: () => locked(() => reconcile()),
    tick: () => locked(() => tick()) });
}

globalThis.FFAD = globalThis.FFAD || {};
globalThis.FFAD.createDownloadController = createDownloadController;
