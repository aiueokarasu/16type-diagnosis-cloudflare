import { normalizeAnalyticsPayload } from "./analytics-core.js";

const encoder = new TextEncoder();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/analytics") return handleAnalytics(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
};

async function handleAnalytics(request, env, ctx) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!env.ANALYTICS_DB || !env.ANALYTICS_PEPPER) return new Response(null, { status: 204 });

  const url = new URL(request.url);
  const allowedHosts = String(env.ANALYTICS_HOSTS || "16type-diagnosis.type-navi-jp.workers.dev")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
  if (!allowedHosts.includes(url.hostname) || request.headers.get("Origin") !== url.origin) {
    return json({ error: "Forbidden" }, 403);
  }

  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 4096) return json({ error: "Payload too large" }, 413);

  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const payload = normalizeAnalyticsPayload(input);
  if (!payload) return json({ error: "Invalid analytics event" }, 400);

  ctx.waitUntil(recordAnalyticsEvent(env, payload).catch((error) => {
    console.error(JSON.stringify({ event: "analytics_write_failed", message: error.message }));
  }));
  return json({ accepted: true }, 202);
}

async function recordAnalyticsEvent(env, payload) {
  const now = new Date().toISOString();
  const [sessionId, visitorId] = await Promise.all([
    hmacIdentifier(env.ANALYTICS_PEPPER, payload.sessionId),
    hmacIdentifier(env.ANALYTICS_PEPPER, payload.visitorId),
  ]);

  await env.ANALYTICS_DB.prepare(`
    INSERT INTO analytics_sessions (session_id, visitor_id, started_at, last_seen_at, entry_path)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET last_seen_at = excluded.last_seen_at
  `).bind(sessionId, visitorId, now, now, payload.page).run();

  if (payload.event === "heartbeat") {
    await env.ANALYTICS_DB.prepare(`
      UPDATE analytics_sessions
      SET active_seconds = MAX(active_seconds, ?), last_seen_at = ?
      WHERE session_id = ?
    `).bind(payload.activeSeconds, now, sessionId).run();
  } else if (payload.event === "answer") {
    await env.ANALYTICS_DB.prepare(`
      UPDATE analytics_sessions
      SET answers_count = MAX(answers_count, ?),
          answer_started_at = COALESCE(answer_started_at, ?),
          last_seen_at = ?
      WHERE session_id = ?
    `).bind(payload.answeredCount, now, now, sessionId).run();
  } else if (payload.event === "complete") {
    await env.ANALYTICS_DB.prepare(`
      UPDATE analytics_sessions
      SET completed_at = COALESCE(completed_at, ?),
          result_type = COALESCE(result_type, ?),
          last_seen_at = ?
      WHERE session_id = ?
    `).bind(now, payload.type, now, sessionId).run();
  } else if (payload.event === "result_view") {
    await env.ANALYTICS_DB.prepare(`
      UPDATE analytics_sessions
      SET result_viewed_at = COALESCE(result_viewed_at, ?),
          result_type = COALESCE(result_type, ?),
          last_seen_at = ?
      WHERE session_id = ?
    `).bind(now, payload.type, now, sessionId).run();
  } else if (payload.event === "note_click") {
    await env.ANALYTICS_DB.prepare(`
      UPDATE analytics_sessions
      SET note_clicked_at = COALESCE(note_clicked_at, ?),
          note_type = COALESCE(note_type, ?),
          last_seen_at = ?
      WHERE session_id = ?
    `).bind(now, payload.type, now, sessionId).run();
  }
}

async function hmacIdentifier(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toHex(new Uint8Array(signature));
}

function toHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
