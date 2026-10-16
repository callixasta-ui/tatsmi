// Core Gemini proxy logic for the Amy chat widget (used by pages/api/chat.js).
// This is what keeps your GEMINI_API_KEY on the server and out of the browser.
//
// MODEL POOL
// ----------
// Instead of calling a single model, we keep an ordered pool. If a model is
// rate-limited (429), overloaded (5xx), times out, returns nothing, or has been
// retired (404), we move to the next model in the pool within the same request,
// so the user just sees an answer. A model that fails is put on a short
// cooldown so the next requests skip it instead of waiting on it again.
//
// Configure with env vars (comma-separated, first = preferred):
//   GEMINI_MODELS=gemini-3.1-flash-lite,gemini-3.5-flash
// (the old single GEMINI_MODEL still works: it becomes the first choice and
// the defaults below are appended as backups.)
//
// Cooldowns are kept in memory, so on serverless they are per warm instance.
// That's fine -- worst case one extra failed attempt after a cold start.

// Keep IDs in sync with https://ai.google.dev/gemini-api/docs/deprecations --
// Google retires model IDs regularly (all gemini-2.5-* shut down 2026-10-16).
export const DEFAULT_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash'];
export const DEFAULT_MODEL = DEFAULT_MODELS[0];

const ATTEMPT_TIMEOUT_MS = 9000;   // give up on one model after this long
const TOTAL_BUDGET_MS = 24000;     // stop trying further models after this long
const MAX_OUTPUT_TOKENS_CAP = 2048;

// model -> timestamp (ms) until which we try it last
const cooldowns = new Map();
export function _resetCooldowns() { cooldowns.clear(); }

export function resolveModelPool({ models, model } = {}) {
  const list = [];
  const add = (m) => {
    const id = String(m || '').trim();
    if (id && !list.includes(id)) list.push(id);
  };
  if (models && String(models).trim()) {
    String(models).split(',').forEach(add);
  } else {
    if (model) add(model);
    DEFAULT_MODELS.forEach(add);
  }
  return list;
}

// Only forward what the widget actually needs, and cap output size, so the
// endpoint can't be used as a free general-purpose Gemini proxy.
function buildRequestBody(body) {
  const b = body && typeof body === 'object' ? body : {};
  if (!Array.isArray(b.contents) || b.contents.length === 0) return null;
  const gc = Object.assign({}, b.generationConfig);
  gc.maxOutputTokens = Math.min(Number(gc.maxOutputTokens) || 1024, MAX_OUTPUT_TOKENS_CAP);
  return { contents: b.contents, generationConfig: gc };
}

function retryDelaySeconds(data) {
  const details = data && data.error && data.error.details;
  if (Array.isArray(details)) {
    for (const d of details) {
      if (d && typeof d.retryDelay === 'string') {
        const s = parseFloat(d.retryDelay);
        if (Number.isFinite(s)) return s;
      }
    }
  }
  return null;
}

function hasText(data) {
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content
    && data.candidates[0].content.parts;
  return Array.isArray(parts) && parts.some((p) => p && typeof p.text === 'string' && p.text.trim());
}

// Returns { ok:true, data } or { ok:false, status, message, cooldownMs, fatal }.
// fatal = the request itself is the problem (bad key / bad payload / blocked),
// so trying another model would not help.
async function tryModel(model, payload, apiKey, fetchImpl, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      }
    );
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const status = res.status;
      const message = (data && data.error && data.error.message) || 'Gemini error';
      if (status === 429) {
        const wait = retryDelaySeconds(data);
        const secs = Math.min(Math.max(wait == null ? 60 : wait, 5), 300);
        return { ok: false, status, message, cooldownMs: secs * 1000 };
      }
      if (status === 404) return { ok: false, status, message, cooldownMs: 60 * 60 * 1000 }; // retired / wrong ID
      if (status === 408) return { ok: false, status, message, cooldownMs: 15000 };
      if (status >= 500) return { ok: false, status, message, cooldownMs: 30000 };
      return { ok: false, status, message, fatal: true };
    }

    if (data && data.promptFeedback && data.promptFeedback.blockReason && !hasText(data)) {
      return { ok: false, status: 422, message: "That message was blocked by the AI's safety filter.", fatal: true };
    }
    // 200 but nothing usable (e.g. all tokens spent "thinking"): try the next model,
    // but don't cool this one down -- it is probably just this prompt.
    if (!hasText(data)) return { ok: false, status: 502, message: 'Empty reply from model', cooldownMs: 0 };

    return { ok: true, data };
  } catch (err) {
    const timedOut = err && err.name === 'AbortError';
    return {
      ok: false,
      status: timedOut ? 504 : 502,
      message: timedOut ? 'Model timed out' : 'Network error: ' + (err && err.message),
      cooldownMs: 20000,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function handleChatRequest(body, opts = {}) {
  const { apiKey, model, models, fetchImpl = fetch, now = Date.now } = opts;

  if (!apiKey) return { status: 500, json: { error: 'API key not configured' } };

  const payload = buildRequestBody(body);
  if (!payload) return { status: 400, json: { error: 'Bad request' } };

  const pool = resolveModelPool({ models, model });
  const start = now();
  const ready = pool.filter((m) => (cooldowns.get(m) || 0) <= start);
  const cooling = pool
    .filter((m) => !ready.includes(m))
    .sort((a, b) => cooldowns.get(a) - cooldowns.get(b));
  const order = [...ready, ...cooling]; // healthy models first, cooling ones as a last resort

  const failures = [];
  for (const m of order) {
    const remaining = TOTAL_BUDGET_MS - (now() - start);
    if (failures.length > 0 && remaining < 2000) break;

    const r = await tryModel(m, payload, apiKey, fetchImpl, Math.min(ATTEMPT_TIMEOUT_MS, Math.max(remaining, 2000)));
    if (r.ok) {
      cooldowns.delete(m);
      r.data.modelUsed = m;
      return { status: 200, json: r.data };
    }
    if (r.fatal) return { status: r.status, json: { error: r.message } };

    if (r.cooldownMs > 0) cooldowns.set(m, now() + r.cooldownMs);
    failures.push({ model: m, status: r.status, message: r.message });
    console.warn(`[chat] ${m} failed (${r.status}): ${r.message} -> trying next model`);
  }

  const allRateLimited = failures.length > 0 && failures.every((f) => f.status === 429);
  return {
    status: allRateLimited ? 429 : 503,
    json: {
      error: allRateLimited
        ? '429 Too Many Requests'
        : 'Amy is really busy right now. Please try again in a few seconds.',
    },
  };
}
