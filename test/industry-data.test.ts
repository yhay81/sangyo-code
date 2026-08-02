import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type Item = { c: string; d: string; l: number; m: string; n: string; p: string };
type Data = {
  counts: { detail: number; division: number; group: number; major: number; total: number };
  items: Item[];
  majors: Array<{ c: string; count: number; n: string }>;
  source: {
    downloadUrl: string;
    interfaceRows: number;
    retrievedAt: string;
    revision: string;
    sha256: string;
    sourcePage: string;
    title: string;
  };
};

const dataPath = resolve(process.cwd(), "public/data/index.json");
const data = JSON.parse(readFileSync(dataPath, "utf8")) as Data;
const byCode = new Map(data.items.map((item) => [item.c, item]));

describe("official Japanese Standard Industrial Classification", () => {
  it("contains the verified current-revision CSV metadata", () => {
    expect(data.source).toMatchObject({
      interfaceRows: 2129,
      retrievedAt: "2026-08-02",
      revision: "04",
      sha256: "7b96fe5dee3c8da38d516a08041c605be7407492e3ee754bc39d7aa3f46f0fe3",
      title: "日本標準産業分類(令和５年[2023年]７月改定)",
    });
    expect(data.source.sourcePage).toBe("https://www.e-stat.go.jp/classifications/terms/10");
    expect(data.source.downloadUrl).toMatch(/^https:\/\/www\.e-stat\.go\.jp\/term\/download\?/u);
  });

  it("contains all 2,128 unique codes at the four official levels", () => {
    expect(data.counts).toEqual({ detail: 1473, division: 99, group: 536, major: 20, total: 2128 });
    expect(data.items).toHaveLength(2128);
    expect(data.majors).toHaveLength(20);
    expect(new Set(data.items.map((item) => item.c)).size).toBe(2128);
    expect(data.items.filter((item) => item.l === 1)).toHaveLength(20);
    expect(data.items.filter((item) => item.l === 2)).toHaveLength(99);
    expect(data.items.filter((item) => item.l === 3)).toHaveLength(536);
    expect(data.items.filter((item) => item.l === 4)).toHaveLength(1473);
  });

  it("retains valid parent and major references for every code", () => {
    data.items.forEach((item) => {
      expect(Object.keys(item).sort()).toEqual(["c", "d", "l", "m", "n", "p"]);
      expect(item.c).toMatch(/^(?:[A-T]|\d{2,4})$/u);
      expect(item.n.length).toBeGreaterThan(0);
      expect(byCode.get(item.m)?.l).toBe(1);
      if (item.p) {
        expect(byCode.has(item.p)).toBe(true);
        expect(byCode.get(item.p)?.l).toBe(item.l - 1);
      } else {
        expect(item.l).toBe(1);
      }
    });
  });

  it("retains known agriculture, software, and final classification records", () => {
    expect(byCode.get("0111")).toMatchObject({
      l: 4,
      m: "A",
      n: "米作農業",
      p: "011",
    });
    expect(byCode.get("3911")).toMatchObject({
      l: 4,
      m: "G",
      n: "受託開発ソフトウェア業",
      p: "391",
    });
    expect(byCode.get("9999")).toMatchObject({ l: 4, m: "T", n: "分類不能の産業", p: "999" });
  });

  it("keeps the complete static dataset within the delivery budget", () => {
    expect(statSync(dataPath).size).toBeLessThan(750_000);
  });
});
