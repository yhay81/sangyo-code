import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("product surface", () => {
  const worker = read("src/worker.tsx");
  const client = read("public/app.js");
  const css = read("public/styles.css");
  const migration = read("migrations/0001_telemetry.sql");
  const source = read("SOURCE.md");
  const surface = `${worker}\n${client}`;

  it("communicates through an industry town, hierarchy rail, cards, and carry-out tray", () => {
    expect(worker).toContain('class="industry-town"');
    expect(worker).toContain('class="town-line"');
    expect(worker).toContain('class="classification-rail"');
    expect(worker).toContain('class="major-grid"');
    expect(worker).toContain('class="code-tray"');
    expect(client).toContain('element("article", `classification-card');
    expect(client).toContain('element("code", "classification-code"');
    expect(css.toLowerCase()).not.toContain("gradient");
    expect(css).not.toMatch(/h1\s*\{[^}]*font-size:\s*(?:[5-9]\d|[1-9]\d{2})px/su);
  });

  it("keeps queries and classification choices in the browser", () => {
    expect(worker).toContain('app.post("/api/telemetry"');
    expect(worker).not.toContain('app.post("/api/search"');
    expect(client).toContain('fetch("/data/index.json"');
    expect(client).toContain("localStorage");
    expect(client).toContain("saved.length >= 8");
    expect(client).toContain("saved.slice(0, 8)");
    expect(migration).not.toMatch(
      /classification_code|classification_name|query|search_term|business_detail|email|phone|advertising/iu,
    );
    expect(client).not.toMatch(/history\.(?:pushState|replaceState)|location\.search\s*=/u);
  });

  it("shows every hierarchy step and sends decisions to official detail pages", () => {
    expect(client).toContain("trailItems(item)");
    expect(client).toContain("trailText(item)");
    expect(client).toContain("https://www.e-stat.go.jp/classifications/terms/10/04/");
    expect(client).toContain('emit("official_opened")');
    expect(client).not.toContain("innerHTML");
    expect(worker).not.toContain("dangerouslySetInnerHTML");
    expect(client).toContain("textContent");
  });

  it("states source revision, dimensions, terms, transformation, and judgment limits", () => {
    expect(source).toContain("令和5年［2023年］7月改定");
    expect(source).toContain("2,128");
    expect(source).toContain("1,473");
    expect(source).toContain("e-Stat terms of use");
    expect(source).toContain("加工");
    expect(source).toContain("non-matching examples");
    expect(worker).toContain("事例・不適合事例");
  });

  it("separates automated checks from users and needs no account", () => {
    expect(client).toContain("navigator.webdriver");
    expect(client).toContain('"x-sangyo-code-qa"');
    expect(migration).toContain("is_qa");
    expect(surface).not.toMatch(/better-auth|betterAuth/iu);
  });

  it("contains no internal research language", () => {
    expect(surface).not.toMatch(
      /public validation|success criteria|experiment|仮説|成功条件|市場スコア|移行候補|収益性/iu,
    );
  });
});
