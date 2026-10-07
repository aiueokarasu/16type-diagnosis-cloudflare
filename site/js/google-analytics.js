(() => {
  const measurementId = "G-80QV7XSVZR";
  const productionHost = "16type-diagnosis.type-navi-jp.workers.dev";
  const optOutKey = "sixteenTypeAnalyticsOptOut";
  const search = new URLSearchParams(location.search);

  if (search.get("analytics") === "exclude") localStorage.setItem(optOutKey, "1");
  if (search.get("analytics") === "include") localStorage.removeItem(optOutKey);

  if (location.hostname !== productionHost || search.has("preview") || localStorage.getItem(optOutKey) === "1") return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  const tag = document.createElement("script");
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(tag);

  window.trackSiteEvent = (name, parameters = {}) => window.gtag("event", name, parameters);
  if (location.pathname === "/diagnosis.html") window.trackSiteEvent("diagnosis_start");

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (link && new URL(link.href, location.href).hostname === "note.com") {
      window.trackSiteEvent("note_click", { link_url: link.href });
    }
  });
})();
