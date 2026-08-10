
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { japanDateBounds, normalizeAnalyticsPayload, normalizeDateRange } from "../src/analytics-core.js";
import { archiveStatements, detailCutoffIso } from "../src/admin-worker.js";
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

test("allows custom ranges older than the 90-day detail retention period", () => {
  const range = normalizeDateRange(new URLSearchParams("range=custom&start=2026-01-01&end=2026-08-03"));
  assert.deepEqual(range, { startDate: "2026-01-01", endDate: "2026-08-03" });
});

test("uses the earliest daily rollup for the all-time range", () => {
  const range = normalizeDateRange(new URLSearchParams("range=all"), new Date("2026-08-03T12:00:00Z"), "2024-04-12");
  assert.deepEqual(range, { startDate: "2024-04-12", endDate: "2026-08-03" });
});

test("retention archives old details before deleting them", () => {
  const database = new DatabaseSync(":memory:");
  database.exec(readFileSync(new URL("../migrations/0001_analytics_and_admin.sql", import.meta.url), "utf8"));
  database.exec(readFileSync(new URL("../migrations/0002_indefinite_daily_rollups.sql", import.meta.url), "utf8"));
  const insert = database.prepare(`INSERT INTO analytics_sessions (
    session_id, visitor_id, started_at, last_seen_at, entry_path, active_seconds, answers_count,
    answer_started_at, completed_at, result_viewed_at, result_type, note_clicked_at, note_type
  ) VALUES (?, ?, ?, ?, '/', ?, ?, ?, ?, ?, ?, ?, ?)`);
  insert.run("old-session", "old-visitor", "2026-01-02T01:00:00.000Z", "2026-01-02T01:03:00.000Z", 120, 7,
    "2026-01-02T01:01:00.000Z", "2026-01-02T01:02:00.000Z", "2026-01-02T01:02:30.000Z", "ENFP",
    "2026-01-02T01:03:00.000Z", "ENFP");
  insert.run("recent-session", "recent-visitor", "2026-08-02T01:00:00.000Z", "2026-08-02T01:03:00.000Z", 60, 2,
    null, null, null, null, null, null);

  const env = { ANALYTICS_DB: { prepare(sql) { return { sql, bind(...args) { this.args = args; return this; } }; } } };
  for (const statement of archiveStatements(env, "2026-05-01T15:00:00.000Z", "2026-08-03T00:00:00.000Z")) {
    database.prepare(statement.sql).run(...(statement.args || []));
  }

  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM analytics_sessions").get().count, 1);
  assert.deepEqual({ ...database.prepare("SELECT visitors, visits, active_seconds_total, active_sessions, answers, started, completed, result_views, note_clicks FROM analytics_daily WHERE day = '2026-01-02'").get() }, {
    visitors: 1, visits: 1, active_seconds_total: 120, active_sessions: 1, answers: 7,
    started: 1, completed: 1, result_views: 1, note_clicks: 1,
  });
  assert.deepEqual({ ...database.prepare("SELECT type, completed, note_clicks FROM analytics_daily_types WHERE day = '2026-01-02'").get() }, {
    type: "ENFP", completed: 1, note_clicks: 1,
  });
});

test("detail retention keeps 90 Japan calendar days", () => {
  assert.equal(detailCutoffIso(new Date("2026-08-11T03:00:00+09:00")), "2026-05-13T15:00:00.000Z");
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

