// 前 N 根 K 线包含全天高低点的概率：可交互折线图。构建时生成默认画面，浏览器里换年份 / 改宽度时用同一个函数重画。
// 数据只有天数（src/data/first-n-by-year.json，由 ES-breakout-dashboard/前N根极值.py 生成）：
// 每年的交易日数，以及第 1–81 根结束时最高点、最低点、两个都已出现的天数。选多年时先把天数加起来再算比例。
import type { UIStrings } from "@/i18n/types";
import { tplStr } from "@/i18n/format";
import { groupNum } from "./breakoutView";

export type FirstNYear = { days: number; hi: number[]; lo: number[]; both: number[] };
export type FirstNData = Record<string, FirstNYear>;
export type FirstNStrings = UIStrings["firstN"];
export type Line = "either" | "low" | "high" | "both";
export type Point = Record<Line, number> & { n: number };

export const BARS = 81;
export const LINES: { k: Line; color: string }[] = [
  { k: "either", color: "#b08a2e" },
  { k: "low", color: "#7a5aa6" },
  { k: "high", color: "#2b8a99" },
  { k: "both", color: "#b5527f" },
];
export const H = 280;
export const M = { l: 42, r: 12, t: 12, b: 26 };

export function years(data: FirstNData): number[] {
  return Object.keys(data).map(Number).sort((a, b) => a - b);
}

// 第 n 根 K 线的时间段，比如第 18 根是 10:55–11:00
export function barTime(n: number): string {
  const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
  const start = 9 * 60 + 30 + 5 * (n - 1);
  return `${hm(start)}–${hm(start + 5)}`;
}

export function series(data: FirstNData, y0: number, y1: number) {
  let days = 0;
  const hi = Array(BARS).fill(0);
  const lo = Array(BARS).fill(0);
  const both = Array(BARS).fill(0);
  for (const [y, d] of Object.entries(data)) {
    if (+y < y0 || +y > y1) continue;
    days += d.days;
    for (let i = 0; i < BARS; i++) {
      hi[i] += d.hi[i];
      lo[i] += d.lo[i];
      both[i] += d.both[i];
    }
  }
  const pct = (v: number) => (days ? (100 * v) / days : 0);
  const points: Point[] = hi.map((_, i) => ({
    n: i + 1,
    either: pct(hi[i] + lo[i] - both[i]),
    low: pct(lo[i]),
    high: pct(hi[i]),
    both: pct(both[i]),
  }));
  return { days, points };
}

export const xOf = (n: number, w: number) => M.l + ((n - 1) / (BARS - 1)) * (w - M.l - M.r);
export const yOf = (v: number) => H - M.b - (v / 100) * (H - M.t - M.b);

function svg(points: Point[], w: number): string {
  const grid = [0, 25, 50, 75, 100]
    .map(
      v => `<line class="${v ? "fn-grid" : "fn-axis"}" x1="${M.l}" x2="${w - M.r}" y1="${yOf(v)}" y2="${yOf(v)}"/>
      <text x="${M.l - 8}" y="${yOf(v)}" dy=".32em" text-anchor="end">${v}%</text>`
    )
    .join("");
  // 横轴标整点：第 6 根 10:00，第 18 根 11:00 …… 第 78 根 16:00；窄屏隔一个标一个
  const ticks = [6, 18, 30, 42, 54, 66, 78]
    .filter((_, i) => w >= 480 || i % 2 === 0)
    .map(n => `<text x="${xOf(n, w)}" y="${H - 8}" text-anchor="middle">${barTime(n).split("–")[1]}</text>`)
    .join("");
  const ref = `<line class="fn-ref" x1="${xOf(18, w)}" x2="${xOf(18, w)}" y1="${M.t}" y2="${H - M.b}"/>
    <text x="${xOf(18, w) + 4}" y="${M.t + 10}">18 bar</text>`;
  const lines = LINES.map(
    ({ k, color }) =>
      `<path fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="${points
        .map((p, i) => `${i ? "L" : "M"}${xOf(p.n, w).toFixed(1)},${yOf(p[k]).toFixed(1)}`)
        .join("")}"/>`
  ).join("");
  const hover = `<line class="fn-rule" y1="${M.t}" y2="${H - M.b}"/>
    ${LINES.map(({ k, color }) => `<circle class="fn-dot" data-k="${k}" r="3.5" fill="${color}"/>`).join("")}`;
  return `<svg viewBox="0 0 ${w} ${H}" width="100%" height="${H}" role="img">${grid}${ticks}${ref}${lines}${hover}</svg>`;
}

export function renderFirstN(
  data: FirstNData,
  s: FirstNStrings,
  sample: string,
  sep: string,
  range: string,
  y0: number,
  y1: number,
  w: number
): string {
  const { days, points } = series(data, y0, y1);
  const p18 = points[17];
  const legend = LINES.map(({ k, color }) => `<span><i style="background:${color}"></i>${s[k]}</span>`).join("");
  return `
    <div class="bx-hero">
      <p class="bx-hero-k">${tplStr(s.heroLabel, { range })}</p>
      <p class="bx-hero-v">${p18.either.toFixed(1)}%</p>
      <p class="bx-hero-n">${tplStr(sample, { n: groupNum(days, sep) })}</p>
    </div>
    <div class="fn-legend">${legend}</div>
    <div class="fn-chart">${svg(points, w)}<div class="fn-tip" hidden></div></div>
    <p class="fn-note">${s.note}</p>`;
}
