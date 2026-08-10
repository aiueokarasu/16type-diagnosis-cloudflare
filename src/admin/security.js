
const encoder = new TextEncoder();
const SESSION_COOKIE = "tn_console_session";
const SESSION_SECONDS = 8 * 60 * 60;
// Cloudflare Workers Web Crypto accepts PBKDF2 iteration counts up to 100,000.
export const PASSWORD_ITERATIONS = 100_000;

export function normalizeUsername(value) {
  const username = String(value || "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) ? username : null;
}

export function validPassword(value) {
  return typeof value === "string" && value.length >= 12 && value.length <= 128;
}

export async function createPasswordRecord(password, pepper) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, pepper, salt, PASSWORD_ITERATIONS);
  return {
    salt: toBase64Url(salt),
    hash: toBase64Url(hash),
    iterations: PASSWORD_ITERATIONS,
  };
}

export async function verifyPassword(password, pepper, user) {
  const salt = fromBase64Url(user.password_salt);
  const expected = fromBase64Url(user.password_hash);
  const actual = await derivePassword(password, pepper, salt, user.password_iterations);
  return constantTimeEqual(actual, expected);
}

export async function performDummyPasswordCheck(password, pepper) {
  const salt = encoder.encode("type-navi-dummy!");
  await derivePassword(password || "invalid-password", pepper, salt, PASSWORD_ITERATIONS);
}

export async function createAdminSession(env, userId) {
  const token = randomToken(32);
  const csrfToken = randomToken(24);
  const tokenHash = await keyedHash(env.AUTH_PEPPER, token);
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_SECONDS * 1000);
  await env.ANALYTICS_DB.prepare(`
    INSERT INTO admin_sessions (token_hash, user_id, csrf_token, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(tokenHash, userId, csrfToken, createdAt.toISOString(), expiresAt.toISOString()).run();
  return {
    cookie: `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`,
    csrfToken,
  };
}

export async function getAdminSession(request, env) {
  const token = readCookie(request.headers.get("Cookie"), SESSION_COOKIE);
  if (!token || !env.AUTH_PEPPER) return null;
  const tokenHash = await keyedHash(env.AUTH_PEPPER, token);
  const session = await env.ANALYTICS_DB.prepare(`
    SELECT s.token_hash, s.csrf_token, s.expires_at,
           u.id AS user_id, u.username, u.active, u.last_login_at
    FROM admin_sessions s
    JOIN admin_users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1
  `).bind(tokenHash, new Date().toISOString()).first();
  return session || null;
}

export async function deleteAdminSession(request, env) {
  const token = readCookie(request.headers.get("Cookie"), SESSION_COOKIE);
  if (token && env.AUTH_PEPPER) {
    const tokenHash = await keyedHash(env.AUTH_PEPPER, token);
    await env.ANALYTICS_DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(tokenHash).run();
  }
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export function csrfMatches(request, session) {
  const token = request.headers.get("X-CSRF-Token") || "";
  return constantTimeEqual(encoder.encode(token), encoder.encode(session?.csrf_token || ""));
}

export async function setupTokenMatches(candidate, expected) {
  if (!candidate || !expected) return false;
  const [candidateHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return constantTimeEqual(new Uint8Array(candidateHash), new Uint8Array(expectedHash));
}

export function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  return origin === new URL(request.url).origin;
}

async function derivePassword(password, pepper, salt, iterations) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`${password}\0${pepper}`),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    256,
  );
  return new Uint8Array(bits);
}

async function keyedHash(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

function constantTimeEqual(left, right) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] || 0) ^ (right[index] || 0);
  }
  return difference === 0;
}

function randomToken(length) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(length)));
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

