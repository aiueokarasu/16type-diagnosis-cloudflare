import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { TYPE_GUIDES, TYPE_ORDER } from "./type-guides.mjs";
import { TOPIC_GUIDES } from "./topic-guides.mjs";

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
await generateTopicGuides();
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
  const description = `${type}（${guide.label}）の性格とは？${guide.lead.split("。")[0]}。日常・恋愛・仕事・ストレス時の傾向と、自分らしく過ごすヒントを紹介します。`;
  const cover = coverUrl(type);
  const related = [...new Set([...personality.best, personality.friend])].filter((candidate) => candidate !== type).slice(0, 3);
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: `${type}（${guide.label}）の性格・恋愛・仕事`,
        description,
        inLanguage: "ja",
        mainEntityOfPage: canonical,
        image: cover,
        author: { "@type": "Organization", name: "16タイプ診断", url: `${siteOrigin}/about/` },
        publisher: { "@type": "Organization", name: "16タイプ診断", url: siteOrigin },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "ホーム", item: `${siteOrigin}/` },
          { "@type": "ListItem", position: 2, name: "16タイプ性格ガイド", item: `${siteOrigin}/types/` },
          { "@type": "ListItem", position: 3, name: `${type}（${guide.label}）`, item: canonical },
        ],
      },
    ],
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
  <meta property="og:image" content="${cover}"><meta property="og:image:alt" content="${type}（${escapeHtml(guide.label)}）の性格ガイド">
  <meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${type}（${escapeHtml(guide.label)}）の性格・恋愛・仕事">
  <meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${cover}">
  <script type="application/ld+json">${structuredData}</script>
  <link rel="stylesheet" href="/css/style.css"><link rel="stylesheet" href="/css/type-guide.css"><link rel="stylesheet" href="/css/seo-content.css"><link rel="stylesheet" href="/css/responsive.css">
</head><body>
  <header class="site-header"><a class="brand" href="/">16<span>TYPE</span></a><button class="theme-toggle" type="button" aria-label="テーマを切り替える">☾</button></header>
  <main class="container type-guide-main">
    <nav class="breadcrumbs" aria-label="パンくず"><a href="/">ホーム</a><span>›</span><a href="/types/">16タイプ一覧</a><span>›</span><span>${type}</span></nav>
    <article>
      <header class="type-guide-hero">
        <div><p class="eyebrow">16 TYPE GUIDE</p><p class="type-guide-code">${type}</p><h1>${escapeHtml(guide.label)}</h1><p class="type-guide-lead">${escapeHtml(guide.lead)}</p></div>
        <img src="${cover}" alt="${type}（${escapeHtml(guide.label)}）のイメージ" width="1200" height="630">
      </header>
      <nav class="type-guide-toc" aria-label="このページの目次"><strong>このページで分かること</strong><div><a href="#everyday">日常</a><a href="#strengths">強み</a><a href="#relationships">恋愛・人間関係</a><a href="#communication">会話</a><a href="#work">仕事</a><a href="#stress">ストレス</a><a href="#decisions">迷ったとき</a><a href="#growth">成長</a></div></nav>
      <section class="type-guide-section" id="everyday"><h2>${type}の日常に表れやすい特徴</h2><p>${escapeHtml(guide.everyday)}</p></section>
      <section class="type-guide-section" id="strengths"><h2>${type}の強みと活かし方</h2><p>${escapeHtml(guide.strengths)}</p></section>
      <section class="type-guide-section" id="relationships"><h2>${type}の人間関係と恋愛</h2><p>${escapeHtml(guide.relationships)}</p></section>
      <section class="type-guide-section" id="communication"><h2>${type}のコミュニケーションのコツ</h2><p>${escapeHtml(guide.communication)}</p></section>
      <section class="type-guide-section" id="work"><h2>${type}の仕事で活きる力</h2><p>${escapeHtml(guide.work)}</p><ul class="type-guide-tags">${personality.jobs.map((job) => `<li>${escapeHtml(job)}</li>`).join("")}</ul></section>
      <section class="type-guide-section" id="stress"><h2>${type}が疲れやストレスを感じたとき</h2><p>${escapeHtml(guide.stress)}</p></section>
      <section class="type-guide-section" id="decisions"><h2>${type}が選択に迷ったときの考え方</h2><p>${escapeHtml(guide.decisions)}</p></section>
      <section class="type-guide-section" id="growth"><h2>${type}が自分らしく成長するヒント</h2><p>${escapeHtml(guide.growth)}</p></section>
      <aside class="type-guide-note"><p>この解説は自己理解のための一般的な傾向です。人の性格を断定するものや、医学的な診断ではありません。<a href="/about/">このサイトの考え方と情報の扱い</a>もご確認ください。</p></aside>
    </article>
    <section class="type-guide-cta"><p>自分のタイプがまだ分からない方へ</p><h2>約30問の無料診断を試す</h2><a class="button primary large" href="/diagnosis.html">診断を始める <span>→</span></a></section>
    <section class="related-types"><h2>あわせて読みたいタイプ</h2><p>考え方の違いや共通点を知るために、ほかのタイプのページも見比べてみましょう。</p><div>${related.map(typeCard).join("")}</div><a class="text-link" href="/types/">16タイプをすべて見る</a></section>
  </main>
  ${siteFooter()}<script src="/js/theme.js"></script>
</body></html>`;
}

function topicGuideHtml(guide) {
  const canonical = `${siteOrigin}/guides/${guide.slug}/`;
  const articleData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    url: canonical,
    inLanguage: "ja",
    isPartOf: { "@type": "WebSite", name: "16タイプ診断", url: `${siteOrigin}/` },
  }).replaceAll("<", "\\u003c");
  const breadcrumbData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ホーム", item: `${siteOrigin}/` },
      { "@type": "ListItem", position: 2, name: guide.shortTitle, item: canonical },
    ],
  }).replaceAll("<", "\\u003c");
  const sections = guide.sections.map((section, index) => `<section class="feature-card type-guide-section" id="section-${index + 1}"><h2>${escapeHtml(section.title)}</h2>${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</section>`).join("");
  const toc = guide.sections.map((section, index) => `<a href="#section-${index + 1}">${escapeHtml(section.title)}</a>`).join("");
  const faq = guide.faq.map(([question, answer]) => `<h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p>`).join("");
  const otherGuides = TOPIC_GUIDES.filter((item) => item.slug !== guide.slug).map((item) => `<a class="type-directory-card" href="/guides/${item.slug}/"><strong>${escapeHtml(item.shortTitle)}</strong><span>${escapeHtml(item.title)}</span><small>${escapeHtml(item.description)}</small></a>`).join("");

  return `<!doctype html>
<html lang="ja"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(guide.title)}｜16タイプ診断</title>
  <meta name="description" content="${escapeHtml(guide.description)}"><link rel="canonical" href="${canonical}">
  <meta property="og:type" content="article"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="16タイプ診断">
  <meta property="og:title" content="${escapeHtml(guide.title)}"><meta property="og:description" content="${escapeHtml(guide.description)}"><meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${siteOrigin}/img/og-image.png"><meta property="og:image:alt" content="${escapeHtml(guide.title)}">
  <meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(guide.title)}"><meta name="twitter:description" content="${escapeHtml(guide.description)}"><meta name="twitter:image" content="${siteOrigin}/img/og-image.png">
  <script type="application/ld+json">${articleData}</script><script type="application/ld+json">${breadcrumbData}</script>
  <link rel="stylesheet" href="/css/style.css"><link rel="stylesheet" href="/css/type-guide.css"><link rel="stylesheet" href="/css/seo-content.css"><link rel="stylesheet" href="/css/responsive.css">
</head><body>
  <header class="site-header"><a class="brand" href="/">16<span>TYPE</span></a><button class="theme-toggle" type="button" aria-label="テーマを切り替える">☾</button></header>
  <main class="container trust-main"><nav class="breadcrumbs" aria-label="パンくず"><a href="/">ホーム</a><span>›</span><span>${escapeHtml(guide.shortTitle)}</span></nav>
    <header class="trust-hero"><p class="eyebrow">16 TYPE GUIDE</p><h1>${escapeHtml(guide.title)}</h1><p>${escapeHtml(guide.lead)}</p></header>
    <nav class="type-guide-toc" aria-label="ページ内メニュー"><strong>このページの内容</strong><div>${toc}</div></nav>
    ${sections}
    <section class="feature-card type-guide-section faq-list" id="faq"><h2>よくある質問</h2>${faq}</section>
    <section class="type-guide-note result-reading-note" aria-labelledby="result-reading-title"><div class="result-reading-heading"><span class="result-reading-icon" aria-hidden="true">✓</span><div><p class="result-reading-label">結果を見る前に</p><h2 id="result-reading-title">診断結果の受け取り方</h2></div></div><p class="result-reading-text">このガイドは自己理解や会話のきっかけを目的とした一般的な情報です。16タイプは、人の能力、価値、将来、関係の成功を決めるものではありません。結果だけで重要な判断をせず、実際の経験や本人同士の対話を大切にしてください。</p><div class="result-reading-actions"><a class="button primary" href="/diagnosis.html">16タイプ診断を始める <span aria-hidden="true">→</span></a></div></section>
    <section class="topic-related"><h2>16タイプごとの解説を見る</h2><p>自分や気になる相手のタイプから、日常、人間関係、恋愛、仕事の特徴を詳しく読めます。</p><div class="types-directory">${TYPE_ORDER.map(typeCard).join("")}</div></section>
    <section class="topic-guide-links"><h2>ほかのテーマを見る</h2><div class="types-directory">${otherGuides}</div></section>
  </main>${siteFooter()}<script src="/js/storage.js"></script><script src="/js/analytics.js"></script><script src="/js/theme.js"></script>
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
  <meta property="og:image" content="${siteOrigin}/img/og-image.png"><meta property="og:image:alt" content="16タイプ診断の性格ガイド一覧">
  <meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="16タイプ性格ガイド一覧｜恋愛・仕事・人間関係"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${siteOrigin}/img/og-image.png"><script type="application/ld+json">${structuredData}</script>
  <link rel="stylesheet" href="/css/style.css"><link rel="stylesheet" href="/css/type-guide.css"><link rel="stylesheet" href="/css/seo-content.css"><link rel="stylesheet" href="/css/responsive.css">
</head><body>
  <header class="site-header"><a class="brand" href="/">16<span>TYPE</span></a><button class="theme-toggle" type="button" aria-label="テーマを切り替える">☾</button></header>
  <main class="container types-index-main"><nav class="breadcrumbs" aria-label="パンくず"><a href="/">ホーム</a><span>›</span><span>16タイプ一覧</span></nav>
    <header class="types-index-hero"><p class="eyebrow">16 TYPE GUIDE</p><h1>16タイプ性格ガイド</h1><p>診断結果とは少し違う視点から、各タイプの日常、人間関係、恋愛、仕事、成長のヒントを紹介します。</p></header>
    <div class="types-directory">${TYPE_ORDER.map(typeCard).join("")}</div>
    <aside class="type-guide-note"><p>各ページは自己理解のヒントとしてお楽しみください。性格を断定するものや、医学的な診断ではありません。詳しくは<a href="/about/">このサイトについて</a>をご覧ください。</p></aside>
    <section class="type-guide-cta"><p>自分のタイプを調べたい方へ</p><h2>無料の16タイプ診断</h2><a class="button primary large" href="/diagnosis.html">診断を始める <span>→</span></a></section>
  </main>${siteFooter()}<script src="/js/theme.js"></script>
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
  const urls = ["/", "/types/", ...TOPIC_GUIDES.map((guide) => `/guides/${guide.slug}/`), "/mbti-16type/", "/about/", ...TYPE_ORDER.map((type) => `/types/${type.toLowerCase()}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${siteOrigin}${url}</loc></url>`).join("\n")}\n</urlset>\n`;
}

async function generateTopicGuides() {
  for (const guide of TOPIC_GUIDES) {
    const directory = path.join(outputDirectory, "guides", guide.slug);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "index.html"), topicGuideHtml(guide), "utf8");
  }
}

function siteFooter() {
  return `<footer><a href="/types/">16タイプ性格ガイド</a><a href="/guides/love/">恋愛</a><a href="/guides/work/">仕事</a><a href="/guides/compatibility/">相性</a><a href="/mbti-16type/">MBTIとの違い</a><a href="/about/">このサイトについて</a><span>© 16 TYPE DIAGNOSIS</span></footer>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
