
import test from "node:test";
import assert from "node:assert/strict";
import { japanDateBounds, normalizeAnalyticsPayload, normalizeDateRange } from "../src/analytics-core.js";
import { createPasswordRecord, verifyPassword } from "../src/admin/security.js";
import { dashboardPage, setupPage } from "../src/admin/pages.js";

const visitorId = "550e8400-e29b-41d4-a716-446655440000";
const sessionId = "550e8400-e29b-41d4-a716-446655440001";

test("normalizes valid answer events and clamps the answer count", () => {
  assert.deepEqual(normalizeAnalyticsPayload({
    event: "answer", visitorId, sessionId, page: "/diagnosis.html?x=1", answeredCount: 99,
  }), {
    event: "answer", visitorId, sessionId, page: "/diagnosis.html", answeredCount: 30,
  });
});

test("rejects invalid identifiers and type codes", () => {
  assert.equal(normalizeAnalyticsPayload({ event: "visit", visitorId: "bad", sessionId }), null);
  assert.equal(normalizeAnalyticsPayload({ event: "complete", visitorId, sessionId, type: "XXXX" }), null);
});

test("creates Japan-time bounds for a custom range", () => {
  const range = normalizeDateRange(new URLSearchParams("range=custom&start=2026-08-01&end=2026-08-03"));
  assert.deepEqual(range, { startDate: "2026-08-01", endDate: "2026-08-03" });
  assert.deepEqual(japanDateBounds(range), {
    startIso: "2026-07-31T15:00:00.000Z",
    endIso: "2026-08-03T15:00:00.000Z",
  });
});

test("caps custom ranges to the 90-day retention period", () => {
  const range = normalizeDateRange(new URLSearchParams("range=custom&start=2026-01-01&end=2026-08-03"));
  assert.deepEqual(range, { startDate: "2026-05-06", endDate: "2026-08-03" });
});

test("password records verify only the correct password and pepper", async () => {
  const record = await createPasswordRecord("correct-horse-battery-staple", "test-pepper");
  assert.equal(record.iterations, 100_000);
  const user = {
    password_salt: record.salt,
    password_hash: record.hash,
    password_iterations: record.iterations,
  };
  assert.equal(await verifyPassword("correct-horse-battery-staple", "test-pepper", user), true);
  assert.equal(await verifyPassword("wrong-password", "test-pepper", user), false);
});

test("initial setup registers exactly one administrator", () => {
  const html = setupPage("test-nonce");
  assert.match(html, /name="username"/);
  assert.match(html, /name="password"/);
  assert.doesNotMatch(html, /name="username1"|name="username2"/);
  assert.match(html, /2人目はログイン後に追加できます/);
});

test("authenticated dashboard provides the second administrator form", () => {
  const html = dashboardPage("test-nonce");
  assert.match(html, /id="admin-create-form"/);
  assert.match(html, /admins\/create/);
  assert.match(html, /2人目の管理者を追加/);
});

