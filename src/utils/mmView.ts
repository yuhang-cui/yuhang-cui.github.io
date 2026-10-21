// 今天能走出昨日区间几倍：今天向上、向下（以及至少一边）走到昨日区间几倍的比例（三条曲线）。构建时生成默认画面，浏览器里切换 / 改宽度时用同一个函数重画。
// 数据只有次数（src/data/yesterday-mm.json，由 ES-breakout-dashboard/昨日等距目标.py 生成）：
// 条件 → 年份 → 天数 n，以及向上 u、向下 d、至少一边 e 在 0, 0.05, …, 2 倍各打到的天数（第 0 格是严格突破昨日高低点）。
import type { UIStrings } from "@/i18n/types";
import { tplStr } from "@/i18n/format";
import { groupNum } from "./breakoutView";
import { pc1, share, yAxis, xLabels, type Box, type YearText } from "./chartKit";

type Year = { n: number; u: number[]; d: number[]; e: number[] };
export type MmData = Record<string, Record<string, Year>>;
export type MmStrings = UIStrings["mm"];
export type MmText = YearText & { thousands: string };
export type Line = "u" | "d" | "e";

export const STEPS = 40; // 0–2 倍，每 0.05 倍一格
export const GROUPS: { g: keyof MmStrings | null; conds: (keyof MmStrings)[] }[] = [
  { g: null, conds: ["all"] },
  { g: "gBar", conds: ["ybull", "ybear"] },
  { g: "gClose", conds: ["chi", "cmid", "clo"] },
  { g: "gOpen", conds: ["oabove", "ohi", "omid", "olo", "obelow"] },
];
export const LINES: { k: Line; cls: string }[] = [
  { k: "u", cls: "mx-up" },
  { k: "d", cls: "mx-dn" },
  { k: "e", cls: "mx-either" },
];

export function years(data: MmData): number[] {
  return Object.keys(data.all).map(Number).sort((a, b) => a - b);
}

export function pool(data: MmData, cond: string, y0: number, y1: number) {
  let n = 0;
  const out: Record<Line, number[]> = { u: Array(STEPS + 1).fill(0), d: Array(STEPS + 1).fill(0), e: Array(STEPS + 1).fill(0) };
  for (const [y, v] of Object.entries(data[cond])) {
    if (+y < y0 || +y > y1) continue;
    n += v.n;
    for (const k of ["u", "d", "e"] as Line[]) v[k].forEach((x, j) => (out[k][j] += x));
  }
  return { n, ...out };
}
export type Pool = ReturnType<typeof pool>;

export const kText = (j: number) => String(Math.round(j * 5) / 100); // 第 j 格是几倍：1、0.5、0.05

// —— 三条曲线 ——
export const B: Omit<Box, "w"> = { h: 260, l: 40, r: 12, t: 14, b: 26 };
export const mx = (j: number, w: number) => B.l + (j / STEPS) * (w - B.l - B.r);
export const my = (v: number) => B.h - B.b - (v / 100) * (B.h - B.t - B.b);

function chart(st: Pool, s: MmStrings, w: number) {
  const box = { ...B, w };
  const ticks = [0, 10, 20, 30, 40].map(j => [mx(j, w), j / 20 + "×"] as [number, string]);
  const refs = [10, 20]
    .map(j => `<line class="fn-ref" x1="${mx(j, w)}" x2="${mx(j, w)}" y1="${box.t}" y2="${box.h - box.b}"/>`)
    .join("");
  const lines = LINES.map(
    ({ k, cls }) =>
      `<path class="${cls}" d="${st[k].map((v, j) => `${j ? "L" : "M"}${mx(j, w).toFixed(1)},${my(share(v, st.n) || 0).toFixed(1)}`).join("")}"/>`
  ).join("");
  const dots = LINES.map(({ k, cls }) => `<circle class="fn-dot ${cls}-dot" data-k="${k}" r="3.5"/>`).join("");
  return `<svg class="mx-chart" viewBox="0 0 ${w} ${box.h}" width="100%" height="${box.h}" role="img" aria-label="${s.chartTitle}">
    ${yAxis(box, [0, 25, 50, 75, 100], my, v => v + "%")}${xLabels(box, ticks)}${refs}${lines}
    <line class="fn-rule" y1="${box.t}" y2="${box.h - box.b}"/>${dots}
  </svg>`;
}

export function renderMm(data: MmData, s: MmStrings, c: MmText, range: string, cond: string, y0: number, y1: number, w: number) {
  const st = pool(data, cond, y0, y1);
  return `
    <div class="bx-hero">
      <p class="bx-hero-k">${tplStr(s.heroLabel, { range, cond: s[cond as keyof MmStrings] })}</p>
      <p class="bx-hero-v">${pc1(share(st.e[20], st.n))}</p>
      <p class="bx-hero-n">${tplStr(s.heroSub, {
        n: groupNum(st.n, c.thousands),
        h: pc1(share(st.e[10], st.n)),
        z: pc1(share(st.e[0], st.n)),
      })}</p>
    </div>
    <p class="bx-sub">${s.chartTitle}<span>${s.chartHint}</span></p>
    <div class="fn-legend">
      <span><i class="mx-key-up"></i>${s.up}</span>
      <span><i class="mx-key-dn"></i>${s.down}</span>
      <span><i class="mx-key-either"></i>${s.either}</span>
    </div>
    <div class="fn-chart mx-box">${chart(st, s, w)}<div class="fn-tip" hidden></div></div>
    <p class="fn-note">${s.note}</p>`;
}
