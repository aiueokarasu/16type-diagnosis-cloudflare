
export const ANALYTICS_EVENTS = new Set([
  "visit",
  "heartbeat",
  "answer",
  "complete",
  "result_view",
  "note_click",
]);

export const TYPE_CODES = new Set([
  "ENFP", "ENFJ", "ENTP", "ENTJ",
  "ESFP", "ESFJ", "ESTP", "ESTJ",
  "INFP", "INFJ", "INTP", "INTJ",
  "ISFP", "ISFJ", "ISTP", "ISTJ",
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeAnalyticsPayload(input) {
  if (!input || typeof input !== "object" || !ANALYTICS_EVENTS.has(input.event)) return null;
  if (!UUID_PATTERN.test(input.visitorId || "") || !UUID_PATTERN.test(input.sessionId || "")) return null;

  const payload = {
    event: input.event,
    visitorId: input.visitorId.toLowerCase(),
    sessionId: input.sessionId.toLowerCase(),
    page: normalizePath(input.page),
  };

  if (input.event === "heartbeat") {
    payload.activeSeconds = clampInteger(input.activeSeconds, 0, 21_600);
  }
  if (input.event === "answer") {
    payload.answeredCount = clampInteger(input.answeredCount, 1, 30);
  }
  if (["complete", "result_view", "note_click"].includes(input.event)) {
    const type = String(input.type || "").toUpperCase();
    if (!TYPE_CODES.has(type)) return null;
    payload.type = type;
  }

  return payload;
}

export function normalizeDateRange(searchParams, now = new Date(), earliestDate = null) {
  const preset = searchParams.get("range") || "7d";
  const endDate = formatJapanDate(now);
  let startDate;

  if (preset === "today") startDate = endDate;
  else if (preset === "30d") startDate = shiftDate(endDate, -29);
  else if (preset === "all") startDate = validDate(earliestDate) ? earliestDate : shiftDate(endDate, -89);
  else if (preset === "custom") {
    startDate = validDate(searchParams.get("start")) ? searchParams.get("start") : endDate;
    const requestedEnd = validDate(searchParams.get("end")) ? searchParams.get("end") : endDate;
    const ordered = orderRange(startDate, requestedEnd);
    return ordered;
  } else startDate = shiftDate(endDate, -6);

  return { startDate, endDate };
}

export function japanDateBounds({ startDate, endDate }) {
  return {
    startIso: new Date(`${startDate}T00:00:00+09:00`).toISOString(),
    endIso: new Date(`${shiftDate(endDate, 1)}T00:00:00+09:00`).toISOString(),
  };
}

function normalizePath(value) {
  const path = String(value || "/").split(/[?#]/, 1)[0];
  return path.startsWith("/") ? path.slice(0, 120) : "/";
}

function clampInteger(value, min, max) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function formatJapanDate(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function shiftDate(value, days) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function orderRange(startDate, endDate) {
  return startDate <= endDate ? { startDate, endDate } : { startDate: endDate, endDate: startDate };
}

