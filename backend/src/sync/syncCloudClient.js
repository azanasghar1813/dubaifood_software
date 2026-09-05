/**
 * Dual-host cloud sync HTTP client.
 *
 * Vercel (primary) and Render (fallback) are interchangeable doors to the
 * same Supabase store. One host per request. Never push a batch to both
 * in parallel. Checkout uses mode "fast" so a sleeping Render cannot stall POS.
 */

export const SYNC_TIMEOUTS = Object.freeze({
  PRIMARY_MS: 12_000,
  FALLBACK_WAKE_MS: 90_000,
  FALLBACK_WARM_MS: 20_000,
  HEALTH_PROBE_MS: 8_000,
  FAST_MS: 1_500,
});

export const FAILOVER_COOLDOWN_MS = 8 * 60 * 1000;
export const FALLBACK_IDLE_DELAY_MS = 5 * 60 * 1000;

export class CloudSyncError extends Error {
  constructor(message, { code, status, host } = {}) {
    super(message);
    this.name = 'CloudSyncError';
    this.code = code || 'CLOUD_ERROR';
    this.status = status || 0;
    this.host = host || '';
  }
}

export function normalizeSyncBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

export function hostLabel(url) {
  try {
    return new URL(normalizeSyncBaseUrl(url)).host;
  } catch {
    return normalizeSyncBaseUrl(url) || 'unknown';
  }
}

export function classifyCloudFailure({ status, contentType, bodyText, networkError } = {}) {
  if (networkError) {
    const msg = String(networkError.message || networkError.code || networkError);
    const name = String(networkError.name || '');
    if (name === 'AbortError' || /aborted|timeout|TimeoutError/i.test(msg)) return 'FAILOVER';
    if (/ECONNRESET|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|fetch failed|network/i.test(msg)) {
      return 'FAILOVER';
    }
    return 'FAILOVER';
  }

  const code = Number(status) || 0;
  if (code === 401 || code === 403) return 'AUTH';
  if (code === 409) return 'CONFLICT';
  if (code === 429 || code === 502 || code === 503 || code === 504) return 'FAILOVER';

  const text = String(bodyText || '');
  const lower = text.toLowerCase();
  if (/usage.?limit|has been paused|exceeded your usage|functional cpu|out of usage/i.test(lower)) {
    return 'FAILOVER';
  }

  const html = contentType && /text\/html/i.test(contentType);
  if (code >= 500 && (!text.trim() || html)) return 'FAILOVER';
  if (code >= 400 && code < 500) return 'CLIENT';
  if (code >= 500) return 'FAILOVER';
  return 'OK';
}

export function timeoutFor(state, { mode } = {}) {
  if (mode === 'fast') return SYNC_TIMEOUTS.FAST_MS;
  if (mode === 'health') return SYNC_TIMEOUTS.HEALTH_PROBE_MS;
  if (state?.activeHost === 'fallback') {
    return state.fallbackWarm ? SYNC_TIMEOUTS.FALLBACK_WARM_MS : SYNC_TIMEOUTS.FALLBACK_WAKE_MS;
  }
  return SYNC_TIMEOUTS.PRIMARY_MS;
}

function isHealthyHealthPayload(status, json) {
  if (status !== 200 || !json || typeof json !== 'object') return false;
  const s = String(json.status || '').toLowerCase();
  return s === 'ok' || s === 'healthy';
}

async function readResponse(response) {
  const contentType = response.headers?.get?.('content-type') || '';
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return {
    ok: response.ok,
    status: response.status,
    contentType,
    text,
    json,
  };
}

function joinUrl(base, path) {
  const root = normalizeSyncBaseUrl(base);
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${root}${suffix}`;
}

export function createSyncCloudClient({
  primaryUrl,
  fallbackUrl,
  fetchImpl,
  now = () => Date.now(),
  log = () => {},
} = {}) {
  const primary = normalizeSyncBaseUrl(primaryUrl);
  const fallback = normalizeSyncBaseUrl(fallbackUrl);
  const fetchFn = fetchImpl || globalThis.fetch.bind(globalThis);

  const state = {
    activeHost: 'primary',
    fallbackWarm: false,
    primaryFailCount: 0,
    cooldownUntil: 0,
  };

  const urlFor = (which) => (which === 'fallback' ? fallback : primary);

  const snapshot = () => ({
    primaryUrl: primary,
    fallbackUrl: fallback || '',
    activeHost: state.activeHost,
    activeUrl: urlFor(state.activeHost),
    fallbackConfigured: Boolean(fallback),
    fallbackWarm: state.fallbackWarm,
    primaryFailCount: state.primaryFailCount,
    cooldownUntil: state.cooldownUntil,
  });

  async function rawFetch(url, init, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = now();
    try {
      const response = await fetchFn(url, {
        ...init,
        signal: controller.signal,
      });
      const parsed = await readResponse(response);
      return { ...parsed, durationMs: now() - started, url };
    } catch (error) {
      error.durationMs = now() - started;
      error.url = url;
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function throwFrom(parsed, hostUrl, networkError) {
    const kind = classifyCloudFailure({
      status: parsed?.status,
      contentType: parsed?.contentType,
      bodyText: parsed?.text,
      networkError,
    });
    const status = parsed?.status || 0;
    const host = hostLabel(hostUrl);
    const message = networkError
      ? (networkError.message || 'Network error')
      : `Cloud ${host} HTTP ${status}`;
    throw new CloudSyncError(message, { code: kind, status, host });
  }

  async function tryHost(which, path, init, timeoutMs) {
    const base = urlFor(which);
    if (!base) {
      throw new CloudSyncError('Sync host is not configured', { code: 'CLIENT', host: which });
    }
    const url = joinUrl(base, path);
    try {
      const parsed = await rawFetch(url, init, timeoutMs);
      const kind = classifyCloudFailure({
        status: parsed.status,
        contentType: parsed.contentType,
        bodyText: parsed.text,
      });
      if (parsed.ok && kind === 'OK') {
        return { ...parsed, host: which, hostUrl: base };
      }
      const error = new CloudSyncError(`Cloud ${hostLabel(base)} HTTP ${parsed.status}`, {
        code: kind === 'OK' ? 'CLIENT' : kind,
        status: parsed.status,
        host: hostLabel(base),
      });
      error.parsed = parsed;
      throw error;
    } catch (error) {
      if (error instanceof CloudSyncError) throw error;
      const wrapped = new CloudSyncError(error.message || 'Network error', {
        code: classifyCloudFailure({ networkError: error }),
        host: hostLabel(base),
      });
      wrapped.cause = error;
      throw wrapped;
    }
  }

  function failOverToFallback(reason) {
    state.activeHost = 'fallback';
    state.fallbackWarm = true;
    state.cooldownUntil = now() + FAILOVER_COOLDOWN_MS;
    log(`Failover → ${hostLabel(fallback)} (${reason}). Probe primary after ${Math.round(FAILOVER_COOLDOWN_MS / 60000)} min.`);
  }

  async function request(path, init = {}, options = {}) {
    const mode = options.mode || 'sync';
    const overrideTimeout = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : null;

    if (mode === 'fast') {
      const which = state.activeHost;
      const timeoutMs = overrideTimeout || SYNC_TIMEOUTS.FAST_MS;
      return tryHost(which, path, init, timeoutMs);
    }

    const active = state.activeHost;
    const timeoutMs = overrideTimeout || timeoutFor(state, { mode });
    try {
      const result = await tryHost(active, path, init, timeoutMs);
      if (active === 'fallback') state.fallbackWarm = true;
      if (active === 'primary') state.primaryFailCount = 0;
      return result;
    } catch (error) {
      const canHop = error.code === 'FAILOVER'
        && active === 'primary'
        && Boolean(fallback)
        && mode === 'sync';

      if (!canHop) {
        if (error.code === 'FAILOVER' && active === 'primary') {
          state.primaryFailCount += 1;
        }
        throw error;
      }

      state.primaryFailCount += 1;
      const reason = `${error.message || error.code}`;
      log(`Primary ${hostLabel(primary)} failed (${reason}). Waking fallback ${hostLabel(fallback)} (up to ${SYNC_TIMEOUTS.FALLBACK_WAKE_MS / 1000}s)...`);

      const wakeStarted = now();
      try {
        const result = await tryHost('fallback', path, init, SYNC_TIMEOUTS.FALLBACK_WAKE_MS);
        const wakeMs = now() - wakeStarted;
        log(`Fallback ${hostLabel(fallback)} ok after ${wakeMs}ms wake/request.`);
        failOverToFallback(reason);
        return result;
      } catch (fallbackError) {
        log(`Fallback ${hostLabel(fallback)} failed: ${fallbackError.message}. Queue stays pending.`);
        throw fallbackError;
      }
    }
  }

  async function maybeFailBack() {
    if (state.activeHost !== 'fallback' || !primary) return snapshot();
    if (now() < state.cooldownUntil) return snapshot();

    log(`Cooldown elapsed. Probing primary ${hostLabel(primary)}...`);
    try {
      const probed = await tryHost('primary', '/health', { method: 'GET' }, SYNC_TIMEOUTS.HEALTH_PROBE_MS);
      if (isHealthyHealthPayload(probed.status, probed.json)) {
        state.activeHost = 'primary';
        state.primaryFailCount = 0;
        log(`Fail-back → ${hostLabel(primary)}.`);
        return snapshot();
      }
    } catch (error) {
      log(`Primary still unhealthy (${error.message}). Staying on ${hostLabel(fallback)}.`);
    }
    state.cooldownUntil = now() + FAILOVER_COOLDOWN_MS;
    return snapshot();
  }

  return {
    request,
    maybeFailBack,
    getState: snapshot,
    timeoutFor: (mode) => timeoutFor(state, { mode }),
    reset() {
      state.activeHost = 'primary';
      state.fallbackWarm = false;
      state.primaryFailCount = 0;
      state.cooldownUntil = 0;
    },
  };
}

let singleton = null;

export function getSyncCloudClient(config) {
  if (!singleton) {
    singleton = createSyncCloudClient({
      primaryUrl: config?.sync?.apiUrl,
      fallbackUrl: config?.sync?.fallbackApiUrl,
      log: (message) => console.log(`[SyncCloud] ${message}`),
    });
  }
  return singleton;
}

export function resetSyncCloudClientForTests() {
  singleton = null;
}
