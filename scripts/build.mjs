import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { TYPE_GUIDES, TYPE_ORDER } from "./type-guides.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(projectRoot, "site");
const outputDirectory = path.join(projectRoot, "dist");

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp(sourceDirectory, outputDirectory, { recursive: true });

const siteOrigin = "https://16type-diagnosis.type-navi-jp.workers.dev";
const personalities = JSON.parse(await readFile(path.join(sourceDirectory, "data", "personalities.json"), "utf8"));
const coverFiles = new Set(await readdir(path.join(sourceDirectory, "img", "type-covers")));

await generateTypePages();
await writeFile(path.join(outputDirectory, "sitemap.xml"), sitemapXml(), "utf8");

console.log("Static diagnosis site and SEO type guides generated in dist.");

async function generateTypePages() {
  const typesDirectory = path.join(outputDirectory, "types");
  await mkdir(typesDirectory, { recursive: true });
  await writeFile(path.join(typesDirectory, "index.html"), typeIndexHtml(), "utf8");

  for (const type of TYPE_ORDER) {
    const directory = path.join(typesDirectory, type.toLowerCase());
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "index.html"), typeGuideHtml(type), "utf8");
  }
}

function typeGuideHtml(type) {
  const guide = TYPE_GUIDES[type];
  const personality = personalities[type];
  if (!guide || !personality) throw new Error(`Missing SEO guide data for ${type}`);

  const canonical = `${siteOrigin}/types/${type.toLowerCase()}/`;
  const description = `${type}（${guide.label}）の性格を、日常、人間関係、恋愛、仕事、成長のヒントから詳しく解説します。`;
  const cover = coverUrl(type);
  const related = TYPE_ORDER.filter((candidate) => candidate !== type)
    .slice(TYPE_ORDER.indexOf(type) % 4, TYPE_ORDER.indexOf(type) % 4 + 4)
    .slice(0, 3);
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${type}（${guide.label}）の性格・恋愛・仕事`,
    description,
    inLanguage: "ja",
    mainEntityOfPage: canonical,
    image: cover,
    publisher: { "@type": "Organization", name: "16タイプ診断" },
  }).replaceAll("<", "\\u003c");

  return `<!doctype html>
<html lang="ja"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${type}（${escapeHtml(guide.label)}）の性格・恋愛・仕事｜16タイプ診断</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="article"><meta property="og:locale" content="ja_JP">
  <meta property="og:site_name" content="16タイプ診断"><meta property="og:title" content="${type}（${escapeHtml(guide.label)}）の性格・恋愛・仕事">
  <meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${cover}"><meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${structuredData}</script>
  <link rel="stylesheet" href="/css/style.css"><link rel="stylesheet" href="/css/type-guide.css"><link rel="stylesheet" href="/css/responsive.css">
</head><body>
  <header class="site-header"><a class="brand" href="/">16<span>TYPE</span></a><button class="theme-toggle" type="button" aria-label="テーマを切り替える">☾</button></header>
  <main class="container type-guide-main">
    <nav class="breadcrumbs" aria-label="パンくず"><a href="/">ホーム</a><span>›</span><a href="/types/">16タイプ一覧</a><span>›</span><span>${type}</span></nav>
    <article>
      <header class="type-guide-hero">
        <div><p class="eyebrow">16 TYPE GUIDE</p><p class="type-guide-code">${type}</p><h1>${escapeHtml(guide.label)}</h1><p class="type-guide-lead">${escapeHtml(guide.lead)}</p></div>
        <img src="${cover}" alt="${type}（${escapeHtml(guide.label)}）のイメージ" width="1200" height="630">
      </header>
      <section class="type-guide-section"><h2>${type}の日常に表れやすい特徴</h2><p>${escapeHtml(guide.everyday)}</p></section>
      <section class="type-guide-section"><h2>${type}の強みと活かし方</h2><p>${escapeHtml(guide.strengths)}</p></section>
      <section class="type-guide-section"><h2>${type}の人間関係と恋愛</h2><p>${escapeHtml(guide.relationships)}</p></section>
      <section class="type-guide-section"><h2>${type}の仕事で活きる力</h2><p>${escapeHtml(guide.work)}</p><ul class="type-guide-tags">${personality.jobs.map((job) => `<li>${escapeHtml(job)}</li>`).join("")}</ul></section>
      <section class="type-guide-section"><h2>${type}が疲れやストレスを感じたとき</h2><p>${escapeHtml(guide.stress)}</p></section>
      <section class="type-guide-section"><h2>${type}が自分らしく成長するヒント</h2><p>${escapeHtml(guide.growth)}</p></section>
      <aside class="type-guide-note"><p>この解説は自己理解のための一般的な傾向です。人の性格を断定するものや、医学的な診断ではありません。</p></aside>
    </article>
    <section class="type-guide-cta"><p>自分のタイプがまだ分からない方へ</p><h2>約30問の無料診断を試す</h2><a class="button primary large" href="/diagnosis.html">診断を始める <span>→</span></a></section>
    <section class="related-types"><h2>ほかのタイプも見る</h2><div>${related.map(typeCard).join("")}</div><a class="text-link" href="/types/">16タイプをすべて見る</a></section>
  </main>
  <footer>© 16 TYPE DIAGNOSIS</footer><script src="/js/theme.js"></script>
</body></html>`;
}

function typeIndexHtml() {
  const canonical = `${siteOrigin}/types/`;
  const description = "16タイプそれぞれの性格、日常、人間関係、恋愛、仕事、成長のヒントを一覧から詳しく読めます。";
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "16タイプ性格ガイド一覧",
    description,
    url: canonical,
    inLanguage: "ja",
  }).replaceAll("<", "\\u003c");

  return `<!doctype html>
<html lang="ja"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>16タイプ性格ガイド一覧｜恋愛・仕事・人間関係</title>
  <meta name="description" content="${description}"><link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="16タイプ診断">
  <meta property="og:title" content="16タイプ性格ガイド一覧"><meta property="og:description" content="${description}"><meta property="og:url" content="${canonical}">
  <meta name="twitter:card" content="summary"><script type="application/ld+json">${structuredData}</script>
  <link rel="stylesheet" href="/css/style.css"><link rel="stylesheet" href="/css/type-guide.css"><link rel="stylesheet" href="/css/responsive.css">
</head><body>
  <header class="site-header"><a class="brand" href="/">16<span>TYPE</span></a><button class="theme-toggle" type="button" aria-label="テーマを切り替える">☾</button></header>
  <main class="container types-index-main"><nav class="breadcrumbs" aria-label="パンくず"><a href="/">ホーム</a><span>›</span><span>16タイプ一覧</span></nav>
    <header class="types-index-hero"><p class="eyebrow">16 TYPE GUIDE</p><h1>16タイプ性格ガイド</h1><p>診断結果とは少し違う視点から、各タイプの日常、人間関係、恋愛、仕事、成長のヒントを紹介します。</p></header>
    <div class="types-directory">${TYPE_ORDER.map(typeCard).join("")}</div>
    <aside class="type-guide-note"><p>各ページは自己理解のヒントとしてお楽しみください。性格を断定するものや、医学的な診断ではありません。</p></aside>
    <section class="type-guide-cta"><p>自分のタイプを調べたい方へ</p><h2>無料の16タイプ診断</h2><a class="button primary large" href="/diagnosis.html">診断を始める <span>→</span></a></section>
  </main><footer>© 16 TYPE DIAGNOSIS</footer><script src="/js/theme.js"></script>
</body></html>`;
}

function typeCard(type) {
  const guide = TYPE_GUIDES[type];
  return `<a class="type-directory-card" href="/types/${type.toLowerCase()}/"><strong>${type}</strong><span>${escapeHtml(guide.label)}</span><small>${escapeHtml(guide.lead.split("。")[0])}。</small></a>`;
}

function coverUrl(type) {
  const filename = [...coverFiles].find((file) => file.toUpperCase().startsWith(`${type}.`));
  if (!filename) throw new Error(`Missing cover image for ${type}`);
  return `${siteOrigin}/img/type-covers/${filename}`;
}

function sitemapXml() {
  const urls = ["/", "/types/", ...TYPE_ORDER.map((type) => `/types/${type.toLowerCase()}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${siteOrigin}${url}</loc></url>`).join("\n")}\n</urlset>\n`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
