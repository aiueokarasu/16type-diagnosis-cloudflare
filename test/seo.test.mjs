import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TYPE_GUIDES, TYPE_ORDER } from "../scripts/type-guides.mjs";

const origin = "https://16type-diagnosis.type-navi-jp.workers.dev";

test("build generates a crawlable guide for all 16 types", () => {
  assert.equal(TYPE_ORDER.length, 16);
  assert.equal(new Set(TYPE_ORDER).size, 16);

  for (const type of TYPE_ORDER) {
    const html = readFileSync(new URL(`../dist/types/${type.toLowerCase()}/index.html`, import.meta.url), "utf8");
    assert.match(html, new RegExp(`<title>${type}`));
    assert.match(html, new RegExp(`${origin}/types/${type.toLowerCase()}/`));
    assert.match(html, /application\/ld\+json/);
    assert.match(html, new RegExp(TYPE_GUIDES[type].label));
    assert.match(html, new RegExp(TYPE_GUIDES[type].everyday.slice(0, 20)));
    assert.match(html, new RegExp(TYPE_GUIDES[type].strengths.slice(0, 20)));
    assert.match(html, new RegExp(TYPE_GUIDES[type].stress.slice(0, 20)));
    assert.match(html, new RegExp(TYPE_GUIDES[type].communication.slice(0, 20)));
    assert.match(html, new RegExp(TYPE_GUIDES[type].decisions.slice(0, 20)));
    assert.match(html, /class="type-guide-toc"/);
    assert.match(html, /href="\/about\/"/);
    assert.match(html, /"@type":"BreadcrumbList"/);
    assert.match(html, /name="twitter:description"/);
    assert.ok(TYPE_GUIDES[type].strengths.length >= 90);
    assert.ok(TYPE_GUIDES[type].stress.length >= 90);
    assert.ok(TYPE_GUIDES[type].communication.length >= 90);
    assert.ok(TYPE_GUIDES[type].decisions.length >= 90);
  }
});

test("all type pages have unique search descriptions and meaningful internal links", () => {
  const descriptions = [];
  for (const type of TYPE_ORDER) {
    const html = readFileSync(new URL(`../dist/types/${type.toLowerCase()}/index.html`, import.meta.url), "utf8");
    const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
    assert.ok(description);
    descriptions.push(description);
    assert.ok((html.match(/class="type-directory-card"/g) ?? []).length >= 3);
    assert.match(html, /href="\/types\/"/);
    assert.match(html, /href="\/diagnosis.html"/);
  }
  assert.equal(new Set(descriptions).size, 16);
});

test("sitemap lists only the public landing and guide pages", () => {
  const sitemap = readFileSync(new URL("../dist/sitemap.xml", import.meta.url), "utf8");
  const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  assert.equal(locations.length, 20);
  assert.equal(locations[0], `${origin}/`);
  assert.equal(locations[1], `${origin}/types/`);
  assert.equal(locations[2], `${origin}/mbti-16type/`);
  assert.equal(locations[3], `${origin}/about/`);
  assert.equal(locations.includes(`${origin}/diagnosis.html`), false);
  assert.equal(locations.includes(`${origin}/result.html`), false);
});

test("robots and personalized pages use the intended indexing policy", () => {
  const robots = readFileSync(new URL("../dist/robots.txt", import.meta.url), "utf8");
  const result = readFileSync(new URL("../dist/result.html", import.meta.url), "utf8");
  const diagnosis = readFileSync(new URL("../dist/diagnosis.html", import.meta.url), "utf8");
  assert.match(robots, /Sitemap: https:\/\/16type-diagnosis\.type-navi-jp\.workers\.dev\/sitemap\.xml/);
  assert.match(result, /name="robots" content="noindex,follow"/);
  assert.match(diagnosis, /name="robots" content="noindex"/);
});

test("trust page explains purpose, limitations, and privacy", () => {
  const about = readFileSync(new URL("../dist/about/index.html", import.meta.url), "utf8");
  const landing = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(about, /<title>このサイトについて｜16タイプ診断<\/title>/);
  assert.match(about, /公式MBTI®ではなく/);
  assert.match(about, /個人を直接特定する情報は保存しません/);
  assert.match(about, /詳細な計測データは90日間保存/);
  assert.match(about, /"@type":"AboutPage"/);
  assert.match(landing, /href="\/about\/"/);
});

test("MBTI explainer is crawlable, accurate, and connected to the site", () => {
  const explainer = readFileSync(new URL("../dist/mbti-16type/index.html", import.meta.url), "utf8");
  const landing = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const typeIndex = readFileSync(new URL("../dist/types/index.html", import.meta.url), "utf8");
  assert.match(explainer, /<title>MBTIとは？無料16タイプ診断との違い｜16タイプ診断<\/title>/);
  assert.match(explainer, /当サイトは公式MBTI®ではなく/);
  assert.match(explainer, /https:\/\/www\.mbti\.or\.jp\/what\//);
  assert.match(explainer, /href="\/diagnosis.html"/);
  assert.match(explainer, /href="\/types\/"/);
  assert.match(explainer, /"@type":"BreadcrumbList"/);
  assert.match(landing, /href="\/mbti-16type\/"/);
  assert.match(typeIndex, /href="\/mbti-16type\/"/);
});

test("landing page exposes a large social sharing image", () => {
  const landing = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(landing, /property="og:image" content="https:\/\/16type-diagnosis\.type-navi-jp\.workers\.dev\/img\/og-image\.png"/);
  assert.match(landing, /property="og:image:width" content="1200"/);
  assert.match(landing, /property="og:image:height" content="630"/);
  assert.match(landing, /name="twitter:card" content="summary_large_image"/);
  assert.match(landing, /name="twitter:image" content="https:\/\/16type-diagnosis\.type-navi-jp\.workers\.dev\/img\/og-image\.png"/);
});
