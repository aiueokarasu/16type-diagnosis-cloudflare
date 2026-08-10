import { createServer } from "node:http";
import { dashboardPage, loginPage, setupPage } from "../src/admin/pages.js";

const port = Number(process.env.ADMIN_PREVIEW_PORT || 8766);
const server = createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  if (url.pathname.startsWith("/owner-space-preview/api/")) {
    const route = url.pathname.split("/").at(-1);
    const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
    if (route === "session") return sendJson(response, { csrfToken: "preview", user: { id: 1, username: "preview-owner" } }, headers);
    if (route === "admins") return sendJson(response, { admins: [{ id: 1, username: "preview-owner", active: true, lastLoginAt: new Date().toISOString() }, { id: 2, username: "preview-partner", active: true, lastLoginAt: null }] }, headers);
    if (route === "metrics") return sendJson(response, previewMetrics(), headers);
    return sendJson(response, { message: "プレビュー操作を確認しました。" }, headers);
  }
  const nonce = "local-preview";
  const html = url.pathname === "/login" ? loginPage(nonce)
    : url.pathname === "/setup" ? setupPage(nonce)
      : dashboardPage(nonce);
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  response.end(html);
});

function sendJson(response, value, headers) {
  response.writeHead(200, headers);
  response.end(JSON.stringify(value));
}

function previewMetrics() {
  const types = ["ENFP","ENFJ","ENTP","ENTJ","ESFP","ESFJ","ESTP","ESTJ","INFP","INFJ","INTP","INTJ","ISFP","ISFJ","ISTP","ISTJ"];
  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() - (6 - index));
    return { day: date.toISOString().slice(0, 10), visitors: 18 + index * 4, visits: 22 + index * 5, answers: 240 + index * 30, completed: 11 + index * 2, noteClicks: 3 + index };
  });
  return {
    summary: { visitors: 184, visits: 226, averageSeconds: 168, answers: 2310, started: 151, completed: 118, completionRate: 78.1, resultViews: 116, noteClicks: 42, noteClickRate: 36.2 },
    daily,
    types: types.map((type, index) => ({ type, completed: 4 + (index * 7) % 14, noteClicks: 1 + (index * 3) % 7 })),
    generatedAt: new Date().toISOString(),
  };
}

server.listen(port, "127.0.0.1", () => {
  console.log(`Admin preview available at http://127.0.0.1:${port}/`);
});
