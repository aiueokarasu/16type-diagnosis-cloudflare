
import { dashboardPage, loginPage, setupPage } from "./admin/pages.js";
import {
  createAdminSession,
  createPasswordRecord,
  csrfMatches,
  deleteAdminSession,
  getAdminSession,
  normalizeUsername,
  performDummyPasswordCheck,
  sameOrigin,
  setupTokenMatches,
  validPassword,
  verifyPassword,
} from "./admin/security.js";
import { japanDateBounds, normalizeDateRange, TYPE_CODES } from "./analytics-core.js";

const LOCK_MINUTES = 15;
const MAX_LOGIN_FAILURES = 5;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/robots.txt") {
      return secureText("User-agent: *\nDisallow: /\n", "text/plain; charset=utf-8");
    }

    const basePath = adminBasePath(env.ADMIN_PATH);
    if (!basePath || (url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`))) {
      return secureText("Not Found", "text/plain; charset=utf-8", 404);
    }

    try {
      if (url.pathname.startsWith(`${basePath}/api/`)) return await handleApi(request, env, basePath);
      if (request.method !== "GET") return secureJson({ message: "Method not allowed" }, 405);

      const nonce = randomNonce();
      if (url.pathname === `${basePath}/setup`) {
        const count = await env.ANALYTICS_DB.prepare("SELECT COUNT(*) AS count FROM admin_users").first();
        if (Number(count?.count || 0) > 0) return secureText("Not Found", "text/plain; charset=utf-8", 404);
        return secureHtml(setupPage(nonce), nonce);
      }
      if (url.pathname !== basePath && url.pathname !== `${basePath}/`) {
        return secureText("Not Found", "text/plain; charset=utf-8", 404);
      }
      const session = await getAdminSession(request, env);
      return secureHtml(session ? dashboardPage(nonce) : loginPage(nonce), nonce);
    } catch (error) {
      console.error(JSON.stringify({ event: "admin_request_failed", message: error.message }));
      return secureJson({ message: "管理画面を処理できませんでした。" }, 500);
    }
  },

  async scheduled(_controller, env, ctx) {
    const cutoff = detailCutoffIso();
    const now = new Date().toISOString();
    ctx.waitUntil(env.ANALYTICS_DB.batch(archiveStatements(env, cutoff, now)));
  },
};

export function archiveStatements(env, cutoff, now) {
  return [
    env.ANALYTICS_DB.prepare(`
      INSERT INTO analytics_daily (day, visitors, visits, active_seconds_total, active_sessions, answers)
      SELECT date(started_at, '+9 hours'), COUNT(DISTINCT visitor_id), COUNT(*),
        COALESCE(SUM(active_seconds), 0), SUM(CASE WHEN active_seconds > 0 THEN 1 ELSE 0 END),
        COALESCE(SUM(answers_count), 0)
      FROM analytics_sessions WHERE started_at < ? GROUP BY date(started_at, '+9 hours')
      ON CONFLICT(day) DO UPDATE SET
        visitors = analytics_daily.visitors + excluded.visitors,
        visits = analytics_daily.visits + excluded.visits,
        active_seconds_total = analytics_daily.active_seconds_total + excluded.active_seconds_total,
        active_sessions = analytics_daily.active_sessions + excluded.active_sessions,
        answers = analytics_daily.answers + excluded.answers
    `).bind(cutoff),
    env.ANALYTICS_DB.prepare(`
      INSERT INTO analytics_daily (day, started)
      SELECT date(answer_started_at, '+9 hours'), COUNT(DISTINCT visitor_id)
      FROM analytics_sessions WHERE started_at < ? AND answer_started_at IS NOT NULL
      GROUP BY date(answer_started_at, '+9 hours')
      ON CONFLICT(day) DO UPDATE SET started = analytics_daily.started + excluded.started
    `).bind(cutoff),
    env.ANALYTICS_DB.prepare(`
      INSERT INTO analytics_daily (day, completed)
      SELECT date(completed_at, '+9 hours'), COUNT(DISTINCT visitor_id)
      FROM analytics_sessions WHERE started_at < ? AND completed_at IS NOT NULL
      GROUP BY date(completed_at, '+9 hours')
      ON CONFLICT(day) DO UPDATE SET completed = analytics_daily.completed + excluded.completed
    `).bind(cutoff),
    env.ANALYTICS_DB.prepare(`
      INSERT INTO analytics_daily (day, result_views)
      SELECT date(result_viewed_at, '+9 hours'), COUNT(DISTINCT visitor_id)
      FROM analytics_sessions WHERE started_at < ? AND result_viewed_at IS NOT NULL
      GROUP BY date(result_viewed_at, '+9 hours')
      ON CONFLICT(day) DO UPDATE SET result_views = analytics_daily.result_views + excluded.result_views
    `).bind(cutoff),
    env.ANALYTICS_DB.prepare(`
      INSERT INTO analytics_daily (day, note_clicks)
      SELECT date(note_clicked_at, '+9 hours'), COUNT(DISTINCT visitor_id)
      FROM analytics_sessions WHERE started_at < ? AND note_clicked_at IS NOT NULL
      GROUP BY date(note_clicked_at, '+9 hours')
      ON CONFLICT(day) DO UPDATE SET note_clicks = analytics_daily.note_clicks + excluded.note_clicks
    `).bind(cutoff),
    env.ANALYTICS_DB.prepare(`
      INSERT INTO analytics_daily_types (day, type, completed)
      SELECT date(completed_at, '+9 hours'), result_type, COUNT(*)
      FROM analytics_sessions
      WHERE started_at < ? AND completed_at IS NOT NULL AND result_type IS NOT NULL
      GROUP BY date(completed_at, '+9 hours'), result_type
      ON CONFLICT(day, type) DO UPDATE SET completed = analytics_daily_types.completed + excluded.completed
    `).bind(cutoff),
    env.ANALYTICS_DB.prepare(`
      INSERT INTO analytics_daily_types (day, type, note_clicks)
      SELECT date(note_clicked_at, '+9 hours'), note_type, COUNT(*)
      FROM analytics_sessions
      WHERE started_at < ? AND note_clicked_at IS NOT NULL AND note_type IS NOT NULL
      GROUP BY date(note_clicked_at, '+9 hours'), note_type
      ON CONFLICT(day, type) DO UPDATE SET note_clicks = analytics_daily_types.note_clicks + excluded.note_clicks
    `).bind(cutoff),
    env.ANALYTICS_DB.prepare("DELETE FROM analytics_sessions WHERE started_at < ?").bind(cutoff),
    env.ANALYTICS_DB.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").bind(now),
  ];
}

export function detailCutoffIso(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 89);
  return new Date(`${cutoff.toISOString().slice(0, 10)}T00:00:00+09:00`).toISOString();
}

async function handleApi(request, env, basePath) {
  const url = new URL(request.url);
  const route = url.pathname.slice(`${basePath}/api/`.length);
  if (route === "login" && request.method === "POST") return login(request, env);
  if (route === "setup" && request.method === "POST") return setup(request, env);

  const session = await getAdminSession(request, env);
  if (!session) return secureJson({ message: "ログインが必要です。" }, 401);

  if (route === "session" && request.method === "GET") {
    return secureJson({ csrfToken: session.csrf_token, user: { id: session.user_id, username: session.username } });
  }
  if (request.method !== "GET" && (!sameOrigin(request) || !csrfMatches(request, session))) {
    return secureJson({ message: "安全確認に失敗しました。画面を更新してください。" }, 403);
  }
  if (route === "logout" && request.method === "POST") {
    const cookie = await deleteAdminSession(request, env);
    return secureJson({ message: "ログアウトしました。" }, 200, { "Set-Cookie": cookie });
  }
  if (route === "metrics" && request.method === "GET") return metrics(url, env);
  if (route === "admins" && request.method === "GET") return admins(env);
  if (route === "admins/create" && request.method === "POST") return createAdmin(request, env);
  if (route === "admins/status" && request.method === "POST") return updateAdminStatus(request, env, session);
  if (route === "password" && request.method === "POST") return changePassword(request, env, session);
  return secureJson({ message: "Not found" }, 404);
}

async function login(request, env) {
  if (!sameOrigin(request)) return secureJson({ message: "ログインできませんでした。" }, 403);
  if (!env.AUTH_PEPPER) return secureJson({ message: "認証設定が完了していません。" }, 503);
  const body = await readJson(request);
  if (!body) return secureJson({ message: "入力内容を確認してください。" }, 400);

  const username = normalizeUsername(body.username);
  const user = username
    ? await env.ANALYTICS_DB.prepare("SELECT * FROM admin_users WHERE username = ?").bind(username).first()
    : null;
  if (!user) {
    await performDummyPasswordCheck(body.password, env.AUTH_PEPPER);
    return secureJson({ message: "管理者名またはパスワードが正しくありません。" }, 401);
  }

  const now = new Date();
  if (!user.active || (user.locked_until && new Date(user.locked_until) > now)) {
    await performDummyPasswordCheck(body.password, env.AUTH_PEPPER);
    return secureJson({ message: "ログインできません。しばらく待ってから再度お試しください。" }, 423);
  }

  const passwordValid = validPassword(body.password) && await verifyPassword(body.password, env.AUTH_PEPPER, user);
  if (!passwordValid) {
    const failures = Number(user.failed_attempts || 0) + 1;
    const lockedUntil = failures >= MAX_LOGIN_FAILURES
      ? new Date(now.getTime() + LOCK_MINUTES * 60 * 1000).toISOString()
      : null;
    await env.ANALYTICS_DB.prepare(`
      UPDATE admin_users SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?
    `).bind(failures, lockedUntil, now.toISOString(), user.id).run();
    return secureJson({ message: "管理者名またはパスワードが正しくありません。" }, 401);
  }

  await env.ANALYTICS_DB.prepare(`
    UPDATE admin_users SET failed_attempts = 0, locked_until = NULL, last_login_at = ?, updated_at = ? WHERE id = ?
  `).bind(now.toISOString(), now.toISOString(), user.id).run();
  const created = await createAdminSession(env, user.id);
  return secureJson({ message: "ログインしました。" }, 200, { "Set-Cookie": created.cookie });
}

async function setup(request, env) {
  if (!sameOrigin(request)) return secureJson({ message: "登録できませんでした。" }, 403);
  if (!env.AUTH_PEPPER || !env.ADMIN_SETUP_TOKEN) {
    return secureJson({ message: "Cloudflareの初期設定が完了していません。" }, 503);
  }
  const existing = await env.ANALYTICS_DB.prepare("SELECT COUNT(*) AS count FROM admin_users").first();
  if (Number(existing?.count || 0) > 0) return secureJson({ message: "初期登録は完了済みです。" }, 409);

  const body = await readJson(request);
  if (!body || !await setupTokenMatches(body.setupToken, env.ADMIN_SETUP_TOKEN)) {
    return secureJson({ message: "セットアップトークンが正しくありません。" }, 403);
  }
  const username = normalizeUsername(body.username);
  if (!username || !validPassword(body.password)) {
    return secureJson({ message: "管理者名と12文字以上のパスワードを入力してください。" }, 400);
  }

  const record = await createPasswordRecord(body.password, env.AUTH_PEPPER);
  const now = new Date().toISOString();
  await insertAdmin(env, username, record, now).run();
  return secureJson({ message: "最初の管理者を登録しました。ログイン後に2人目を追加してください。" });
}

function insertAdmin(env, username, record, now) {
  return env.ANALYTICS_DB.prepare(`
    INSERT INTO admin_users (username, password_salt, password_hash, password_iterations, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(username, record.salt, record.hash, record.iterations, now, now);
}

async function metrics(url, env) {
  let earliestDate = null;
  if (url.searchParams.get("range") === "all") {
    const earliest = await env.ANALYTICS_DB.prepare(`
      SELECT MIN(day) AS day FROM (
        SELECT day FROM analytics_daily
        UNION ALL
        SELECT date(started_at, '+9 hours') AS day FROM analytics_sessions
      )
    `).first();
    earliestDate = earliest?.day || null;
  }
  const range = normalizeDateRange(url.searchParams, new Date(), earliestDate);
  const { startIso, endIso } = japanDateBounds(range);
  const statements = [
    env.ANALYTICS_DB.prepare(`SELECT COUNT(DISTINCT visitor_id) AS visitors, COUNT(*) AS visits,
      COALESCE(SUM(active_seconds), 0) AS active_seconds_total,
      COUNT(CASE WHEN active_seconds > 0 THEN 1 END) AS active_sessions,
      COALESCE(SUM(answers_count), 0) AS answers
      FROM analytics_sessions WHERE started_at >= ? AND started_at < ?`).bind(startIso, endIso),
    env.ANALYTICS_DB.prepare(`SELECT
      COUNT(DISTINCT CASE WHEN answer_started_at >= ? AND answer_started_at < ? THEN visitor_id END) AS started,
      COUNT(DISTINCT CASE WHEN completed_at >= ? AND completed_at < ? THEN visitor_id END) AS completed,
      COUNT(DISTINCT CASE WHEN result_viewed_at >= ? AND result_viewed_at < ? THEN visitor_id END) AS result_views,
      COUNT(DISTINCT CASE WHEN note_clicked_at >= ? AND note_clicked_at < ? THEN visitor_id END) AS note_clicks
      FROM analytics_sessions`).bind(startIso, endIso, startIso, endIso, startIso, endIso, startIso, endIso),
    env.ANALYTICS_DB.prepare(`SELECT date(started_at, '+9 hours') AS day, COUNT(DISTINCT visitor_id) AS visitors,
      COUNT(*) AS visits, COALESCE(SUM(answers_count), 0) AS answers
      FROM analytics_sessions WHERE started_at >= ? AND started_at < ? GROUP BY day ORDER BY day`).bind(startIso, endIso),
    env.ANALYTICS_DB.prepare(`SELECT date(completed_at, '+9 hours') AS day, COUNT(DISTINCT visitor_id) AS completed
      FROM analytics_sessions WHERE completed_at >= ? AND completed_at < ? GROUP BY day ORDER BY day`).bind(startIso, endIso),
    env.ANALYTICS_DB.prepare(`SELECT date(note_clicked_at, '+9 hours') AS day, COUNT(DISTINCT visitor_id) AS note_clicks
      FROM analytics_sessions WHERE note_clicked_at >= ? AND note_clicked_at < ? GROUP BY day ORDER BY day`).bind(startIso, endIso),
    env.ANALYTICS_DB.prepare(`SELECT result_type AS type, COUNT(*) AS completed
      FROM analytics_sessions WHERE completed_at >= ? AND completed_at < ? AND result_type IS NOT NULL GROUP BY result_type`).bind(startIso, endIso),
    env.ANALYTICS_DB.prepare(`SELECT note_type AS type, COUNT(*) AS note_clicks
      FROM analytics_sessions WHERE note_clicked_at >= ? AND note_clicked_at < ? AND note_type IS NOT NULL GROUP BY note_type`).bind(startIso, endIso),
    env.ANALYTICS_DB.prepare(`SELECT day, visitors, visits, active_seconds_total, active_sessions,
      answers, started, completed, result_views, note_clicks
      FROM analytics_daily WHERE day >= ? AND day <= ? ORDER BY day`).bind(range.startDate, range.endDate),
    env.ANALYTICS_DB.prepare(`SELECT type, COALESCE(SUM(completed), 0) AS completed,
      COALESCE(SUM(note_clicks), 0) AS note_clicks
      FROM analytics_daily_types WHERE day >= ? AND day <= ? GROUP BY type`).bind(range.startDate, range.endDate),
  ];
  const results = await env.ANALYTICS_DB.batch(statements);
  const visits = results[0].results?.[0] || {};
  const funnel = results[1].results?.[0] || {};
  const archivedDaily = results[7].results || [];
  const archived = archivedDaily.reduce((total, row) => {
    for (const key of ["visitors", "visits", "active_seconds_total", "active_sessions", "answers", "started", "completed", "result_views", "note_clicks"]) {
      total[key] += Number(row[key] || 0);
    }
    return total;
  }, { visitors: 0, visits: 0, active_seconds_total: 0, active_sessions: 0, answers: 0, started: 0, completed: 0, result_views: 0, note_clicks: 0 });
  const activeSeconds = Number(visits.active_seconds_total || 0) + archived.active_seconds_total;
  const activeSessions = Number(visits.active_sessions || 0) + archived.active_sessions;
  const started = Number(funnel.started || 0) + archived.started;
  const completed = Number(funnel.completed || 0) + archived.completed;
  const resultViews = Number(funnel.result_views || 0) + archived.result_views;
  const noteClicks = Number(funnel.note_clicks || 0) + archived.note_clicks;
  const summary = {
    visitors: Number(visits.visitors || 0) + archived.visitors,
    visits: Number(visits.visits || 0) + archived.visits,
    averageSeconds: activeSessions ? Math.round(activeSeconds / activeSessions) : 0,
    answers: Number(visits.answers || 0) + archived.answers,
    started, completed, resultViews, noteClicks,
    completionRate: started ? roundPercent(completed / started) : 0,
    noteClickRate: resultViews ? roundPercent(noteClicks / resultViews) : 0,
  };
  return secureJson({
    range,
    summary,
    daily: mergeDaily(range, results[2].results || [], results[3].results || [], results[4].results || [], archivedDaily),
    types: mergeTypes(results[5].results || [], results[6].results || [], results[8].results || []),
    generatedAt: new Date().toISOString(),
  });
}

async function admins(env) {
  const result = await env.ANALYTICS_DB.prepare(`
    SELECT id, username, active, last_login_at FROM admin_users ORDER BY id
  `).all();
  return secureJson({ admins: (result.results || []).map((user) => ({
    id: user.id, username: user.username, active: Boolean(user.active), lastLoginAt: user.last_login_at,
  })) });
}

async function createAdmin(request, env) {
  const existing = await env.ANALYTICS_DB.prepare("SELECT COUNT(*) AS count FROM admin_users").first();
  if (Number(existing?.count || 0) >= 2) {
    return secureJson({ message: "管理者は2名までです。" }, 409);
  }

  const body = await readJson(request);
  const username = normalizeUsername(body?.username);
  if (!username || !validPassword(body?.password)) {
    return secureJson({ message: "管理者名と12文字以上のパスワードを入力してください。" }, 400);
  }

  const duplicate = await env.ANALYTICS_DB.prepare("SELECT id FROM admin_users WHERE username = ?").bind(username).first();
  if (duplicate) return secureJson({ message: "この管理者名はすでに使用されています。" }, 409);

  const record = await createPasswordRecord(body.password, env.AUTH_PEPPER);
  const now = new Date().toISOString();
  try {
    await insertAdmin(env, username, record, now).run();
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_create_failed", message: error.message }));
    return secureJson({ message: "管理者を追加できませんでした。登録人数と管理者名を確認してください。" }, 409);
  }
  return secureJson({ message: "2人目の管理者を追加しました。" }, 201);
}

async function updateAdminStatus(request, env, session) {
  const body = await readJson(request);
  const userId = Number(body?.userId);
  const active = Boolean(body?.active);
  if (!Number.isInteger(userId) || userId === Number(session.user_id)) {
    return secureJson({ message: "自分自身の状態は変更できません。" }, 400);
  }
  if (!active) {
    const count = await env.ANALYTICS_DB.prepare("SELECT COUNT(*) AS count FROM admin_users WHERE active = 1").first();
    if (Number(count?.count || 0) <= 1) return secureJson({ message: "有効な管理者を1名以上残してください。" }, 409);
  }
  const now = new Date().toISOString();
  await env.ANALYTICS_DB.batch([
    env.ANALYTICS_DB.prepare("UPDATE admin_users SET active = ?, updated_at = ? WHERE id = ?").bind(active ? 1 : 0, now, userId),
    env.ANALYTICS_DB.prepare("DELETE FROM admin_sessions WHERE user_id = ? AND ? = 0").bind(userId, active ? 1 : 0),
  ]);
  return secureJson({ message: active ? "アカウントを有効にしました。" : "アカウントを停止しました。" });
}

async function changePassword(request, env, session) {
  const body = await readJson(request);
  if (!validPassword(body?.newPassword)) return secureJson({ message: "新しいパスワードは12文字以上にしてください。" }, 400);
  const user = await env.ANALYTICS_DB.prepare("SELECT * FROM admin_users WHERE id = ?").bind(session.user_id).first();
  if (!user || !validPassword(body.currentPassword) || !await verifyPassword(body.currentPassword, env.AUTH_PEPPER, user)) {
    return secureJson({ message: "現在のパスワードが正しくありません。" }, 401);
  }
  const record = await createPasswordRecord(body.newPassword, env.AUTH_PEPPER);
  const now = new Date().toISOString();
  await env.ANALYTICS_DB.batch([
    env.ANALYTICS_DB.prepare(`UPDATE admin_users SET password_salt = ?, password_hash = ?, password_iterations = ?, updated_at = ? WHERE id = ?`)
      .bind(record.salt, record.hash, record.iterations, now, session.user_id),
    env.ANALYTICS_DB.prepare("DELETE FROM admin_sessions WHERE user_id = ? AND token_hash <> ?").bind(session.user_id, session.token_hash),
  ]);
  return secureJson({ message: "パスワードを変更しました。" });
}

function mergeDaily(range, visits, completions, notes, archivedRows) {
  const byDay = new Map();
  for (const day of enumerateDays(range.startDate, range.endDate, 20_000)) {
    byDay.set(day, { day, visitors: 0, visits: 0, answers: 0, completed: 0, noteClicks: 0 });
  }
  for (const row of archivedRows) if (byDay.has(row.day)) Object.assign(byDay.get(row.day), {
    visitors: Number(row.visitors || 0), visits: Number(row.visits || 0), answers: Number(row.answers || 0),
    completed: Number(row.completed || 0), noteClicks: Number(row.note_clicks || 0),
  });
  for (const row of visits) if (byDay.has(row.day)) {
    byDay.get(row.day).visitors += Number(row.visitors || 0);
    byDay.get(row.day).visits += Number(row.visits || 0);
    byDay.get(row.day).answers += Number(row.answers || 0);
  }
  for (const row of completions) if (byDay.has(row.day)) byDay.get(row.day).completed += Number(row.completed || 0);
  for (const row of notes) if (byDay.has(row.day)) byDay.get(row.day).noteClicks += Number(row.note_clicks || 0);
  return [...byDay.values()];
}

function mergeTypes(completedRows, noteRows, archivedRows) {
  const map = new Map([...TYPE_CODES].sort().map((type) => [type, { type, completed: 0, noteClicks: 0 }]));
  for (const row of archivedRows) if (map.has(row.type)) {
    map.get(row.type).completed = Number(row.completed || 0);
    map.get(row.type).noteClicks = Number(row.note_clicks || 0);
  }
  for (const row of completedRows) if (map.has(row.type)) map.get(row.type).completed += Number(row.completed || 0);
  for (const row of noteRows) if (map.has(row.type)) map.get(row.type).noteClicks += Number(row.note_clicks || 0);
  return [...map.values()];
}

function enumerateDays(start, end, limit) {
  const days = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last && days.length < limit) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

async function readJson(request) {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 8192) return null;
  try { return await request.json(); } catch { return null; }
}

function roundPercent(ratio) { return Math.round(ratio * 1000) / 10; }
function adminBasePath(value) {
  const clean = String(value || "").trim().replace(/^\/+|\/+$/g, "");
  return /^[a-zA-Z0-9_-]{12,80}$/.test(clean) ? `/${clean}` : null;
}
function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function secureHtml(html, nonce) {
  return secureResponse(html, 200, "text/html; charset=utf-8", {
    "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`,
  });
}
function secureJson(body, status = 200, extraHeaders = {}) {
  return secureResponse(JSON.stringify(body), status, "application/json; charset=utf-8", extraHeaders);
}
function secureText(body, type, status = 200) { return secureResponse(body, status, type); }
function secureResponse(body, status, contentType, extraHeaders = {}) {
  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    ...extraHeaders,
  });
  return new Response(body, { status, headers });
}

