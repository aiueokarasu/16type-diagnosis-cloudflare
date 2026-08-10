(() => {
  const productionHosts = new Set(["16type-diagnosis.type-navi-jp.workers.dev"]);
  const search = new URLSearchParams(location.search);
  const optOutKey = "sixteenTypeAnalyticsOptOut";

  if (search.get("analytics") === "exclude") localStorage.setItem(optOutKey, "1");
  if (search.get("analytics") === "include") localStorage.removeItem(optOutKey);

  const enabled = productionHosts.has(location.hostname)
    && !search.has("preview")
    && localStorage.getItem(optOutKey) !== "1";

  if (!enabled) {
    window.Analytics = disabledAnalytics();
    return;
  }

  const visitorId = persistentId(localStorage, "sixteenTypeVisitorId");
  const sessionId = persistentId(sessionStorage, "sixteenTypeSessionId");
  let activeSeconds = Number(sessionStorage.getItem("sixteenTypeActiveSeconds") || 0);
  let lastVisibleAt = document.visibilityState === "visible" ? performance.now() : null;

  function send(event, details = {}) {
    const body = JSON.stringify({
      event,
      visitorId,
      sessionId,
      page: location.pathname,
      ...details,
    });
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      credentials: "omit",
      keepalive: true,
    }).catch(() => {});
  }

  function updateActiveTime() {
    if (lastVisibleAt === null) return;
    const now = performance.now();
    activeSeconds = Math.min(21_600, activeSeconds + Math.min(30, Math.max(0, (now - lastVisibleAt) / 1000)));
    lastVisibleAt = now;
    sessionStorage.setItem("sixteenTypeActiveSeconds", String(Math.round(activeSeconds)));
  }

  function heartbeat() {
    updateActiveTime();
    send("heartbeat", { activeSeconds: Math.round(activeSeconds) });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") lastVisibleAt = performance.now();
    else {
      heartbeat();
      lastVisibleAt = null;
    }
  });
  addEventListener("pagehide", heartbeat);
  setInterval(() => {
    if (document.visibilityState === "visible") heartbeat();
  }, 15_000);

  send("visit");
  window.Analytics = {
    answer(answeredCount) {
      send("answer", { answeredCount });
    },
    complete(type) {
      once(`complete:${type}`, () => send("complete", { type }));
    },
    resultView(type) {
      once(`result:${type}`, () => send("result_view", { type }));
    },
    noteClick(type) {
      once(`note:${type}`, () => send("note_click", { type }));
    },
  };

  function once(key, callback) {
    const storageKey = `sixteenTypeAnalytics:${key}`;
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, "1");
    callback();
  }

  function persistentId(storage, key) {
    const current = storage.getItem(key);
    if (/^[0-9a-f-]{36}$/i.test(current || "")) return current;
    const created = crypto.randomUUID();
    storage.setItem(key, created);
    return created;
  }

  function disabledAnalytics() {
    return { answer() {}, complete() {}, resultView() {}, noteClick() {} };
  }
})();
