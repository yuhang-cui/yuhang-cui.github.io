// 星期几效应：周一到周五的收阳比例（圆点 + 95% 区间）、平均和中位数涨跌、日内波幅（三张小图）。构建时生成默认画面，浏览器里切换 / 改宽度时用同一个函数重画。
// 数据只有天数（src/data/weekday.json，由 ES-breakout-dashboard/星期几.py 生成）：年份 → 星期几（0 = 周一）→
// 天数 n、日盘收阳天数 up、有收盘对收盘的天数 nc 和上涨天数 upc，以及日盘涨跌 r、收盘对收盘涨跌 c、波幅 g 按 0.01% 分格的天数。
import type { UIStrings } from "@/i18n/types";
import { tplStr } from "@/i18n/format";
import { groupNum } from "./breakoutView";
import { wilson } from "./streakView";
import { pc1, share, yAxis, xLabels, type Box, type YearText } from "./chartKit";

type Hist = Record<string, number>;
type Cell = { n: number; up: number; nc: number; upc: number; r: Hist; c: Hist; g: Hist };
export type WeekdayData = Record<string, Record<string, Cell>>;
export type WeekdayStrings = UIStrings["weekday"];
export type WeekdayText = YearText & { thousands: string };

export const DAYS = 5;

export function years(data: WeekdayData): number[] {
  return Object.keys(data).map(Number).sort((a, b) => a - b);
}

// 分格的天数合在一起，算平均数和中位数（和 pandas 一样，偶数个时取中间两个的平均）
function summary(h: Map<number, number>) {
  const rows = [...h.entries()].sort((a, b) => a[0] - b[0]);
  const n = rows.reduce((s, [, c]) => s + c, 0);
  const mean = rows.reduce((s, [k, c]) => s + k * c, 0) / n / 100;
  const at = (i: number) => {
    let seen = 0;
    for (const [k, c] of rows) if (i < (seen += c)) return k;
    return 0;
  };
  const median = n % 2 ? at((n - 1) / 2) / 100 : (at(n / 2 - 1) + at(n / 2)) / 200;
  return { n, mean, median };
}

export function pool(data: WeekdayData, y0: number, y1: number) {
  const blank = () => ({ n: 0, up: 0, nc: 0, upc: 0, r: new Map<number, number>(), c: new Map<number, number>(), g: new Map<number, number>() });
  const all = blank();
  const days = Array.from({ length: DAYS }, blank);
  for (const [y, row] of Object.entries(data)) {
    if (+y < y0 || +y > y1) continue;
    for (const [w, cell] of Object.entries(row)) {
      for (const t of [days[+w], all]) {
        t.n += cell.n;
        t.up += cell.up;
        t.nc += cell.nc;
        t.upc += cell.upc;
        for (const k of ["r", "c", "g"] as const) for (const [b, v] of Object.entries(cell[k])) t[k].set(+b, (t[k].get(+b) ?? 0) + v);
      }
    }
  }
  const out = (t: ReturnType<typeof blank>) => ({ n: t.n, up: t.up, nc: t.nc, upc: t.upc, r: summary(t.r), c: summary(t.c), g: summary(t.g) });
  return { all: out(all), days: days.map(out) };
}
export type Pool = ReturnType<typeof pool>;
export type Day = Pool["all"];

// 选中的口径：日盘（开盘 → 收盘）还是收盘对收盘
export const upPair = (d: Day, basis: string): [number, number] => (basis === "r" ? [d.n, d.up] : [d.nc, d.upc]);
export const ret = (d: Day, basis: string) => (basis === "r" ? d.r : d.c);
export const signed = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(2) + "%";

// —— 三张小图共用的横轴：5 列 ——
export const B: Omit<Box, "w"> = { h: 200, l: 46, r: 12, t: 14, b: 26 };
export const band = (w: number) => (w - B.l - B.r) / DAYS;
export const cx = (i: number, w: number) => B.l + (i + 0.5) * band(w);
const scale = (lo: number, hi: number) => (v: number) => B.h - B.b - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (B.h - B.t - B.b);

function frame(s: WeekdayStrings, w: number, cls: string, label: string, inner: string) {
  const cols = Array.from({ length: DAYS }, (_, i) => `<rect class="wd-col" data-i="${i}" x="${B.l + i * band(w)}" y="${B.t}" width="${band(w)}" height="${B.h - B.t - B.b}"/>`).join("");
  return `<svg class="${cls}" viewBox="0 0 ${w} ${B.h}" width="100%" height="${B.h}" role="img" aria-label="${label}">
    ${cols}${inner}${xLabels({ ...B, w }, s.days.map((d, i) => [cx(i, w), d]))}
  </svg>`;
}

// 收阳比例：圆点 + 95% 区间，虚线是所有日子
function upChart(st: Pool, s: WeekdayStrings, basis: string, w: number) {
  const y = scale(40, 70);
  const [bn, bk] = upPair(st.all, basis);
  const base = share(bk, bn);
  const pts = st.days
    .map((d, i) => {
      const p = upPair(d, basis);
      const [lo, hi] = wilson(p);
      return `<line class="wd-ci" x1="${cx(i, w)}" x2="${cx(i, w)}" y1="${y(lo)}" y2="${y(hi)}"/>
        <circle class="wd-pt" cx="${cx(i, w)}" cy="${y(share(p[1], p[0]))}" r="5"/>`;
    })
    .join("");
  const inner = `${yAxis({ ...B, w }, [40, 50, 60, 70], y, v => v + "%")}
    <line class="fn-ref" x1="${B.l}" x2="${w - B.r}" y1="${y(base)}" y2="${y(base)}"/>${pts}`;
  return frame(s, w, "wd-up", s.upTitle, inner);
}

// 涨跌幅：实心是平均，空心是中位数
function retChart(st: Pool, s: WeekdayStrings, basis: string, w: number) {
  const vals = st.days.flatMap(d => [ret(d, basis).mean, ret(d, basis).median]);
  // 刻度取整到 0.05% / 0.1% / 0.25%，上下对称
  const raw = Math.max(0.05, Math.max(...vals.map(Math.abs)) * 1.15);
  const step = raw <= 0.15 ? 0.05 : raw <= 0.4 ? 0.1 : 0.25;
  const top = Math.ceil(raw / step) * step;
  const y = scale(-top, top);
  const ticks = Array.from({ length: Math.round((2 * top) / step) + 1 }, (_, i) => -top + i * step);
  const off = Math.min(8, band(w) * 0.14);
  const pts = st.days
    .map((d, i) => {
      const r = ret(d, basis);
      return `<circle class="wd-mean" cx="${cx(i, w) - off}" cy="${y(r.mean)}" r="5"/>
        <circle class="wd-med" cx="${cx(i, w) + off}" cy="${y(r.median)}" r="5"/>`;
    })
    .join("");
  const inner = `${yAxis({ ...B, w }, ticks, y, v => (v ? signed(v) : "0"))}
    <line class="fn-axis" x1="${B.l}" x2="${w - B.r}" y1="${y(0)}" y2="${y(0)}"/>${pts}`;
  return frame(s, w, "wd-ret", s.retTitle, inner);
}

// 日内波幅：柱子是中位数，圆点是平均
function rangeChart(st: Pool, s: WeekdayStrings, w: number) {
  const top = Math.ceil((Math.max(...st.days.map(d => d.g.mean)) * 1.1) / 0.25) * 0.25;
  const y = scale(0, top);
  const ticks = Array.from({ length: Math.round(top / 0.25) + 1 }, (_, i) => i * 0.25).filter((_, i, a) => a.length <= 6 || i % 2 === 0);
  const bw = band(w) * 0.42;
  const bars = st.days
    .map(
      (d, i) => `<rect class="wd-bar" x="${cx(i, w) - bw / 2}" y="${y(d.g.median)}" width="${bw}" height="${y(0) - y(d.g.median)}" rx="2"/>
        <text class="zx-t" x="${cx(i, w)}" y="${y(d.g.median) - 6}" text-anchor="middle">${d.g.median.toFixed(2)}%</text>
        <circle class="wd-mean" cx="${cx(i, w)}" cy="${y(d.g.mean)}" r="4"/>`
    )
    .join("");
  const inner = `${yAxis({ ...B, w }, ticks, y, v => v.toFixed(2).replace(/0$/, "") + "%")}${bars}`;
  return frame(s, w, "wd-range", s.rangeTitle, inner);
}

export function renderWeekday(data: WeekdayData, s: WeekdayStrings, c: WeekdayText, range: string, basis: string, y0: number, y1: number, w: number) {
  const st = pool(data, y0, y1);
  const [n, k] = upPair(st.all, basis);
  return `
    <p class="bx-hero-k">${tplStr(s.sample, {
      range,
      n: groupNum(st.all.n, c.thousands),
      up: pc1(share(k, n)),
      g: st.all.g.median.toFixed(2) + "%",
    })}</p>
    <p class="bx-sub">${s.upTitle}<span>${tplStr(basis === "r" ? s.upHintR : s.upHintC, { p: pc1(share(k, n)) })}</span></p>
    <div class="fn-chart wd-box">${upChart(st, s, basis, w)}<div class="fn-tip" hidden></div></div>
    <p class="fn-note">${s.upHow}</p>
    <p class="bx-sub">${s.retTitle}<span>${s.retHint}</span></p>
    <div class="fn-legend"><span><i class="wd-key-mean"></i>${s.mean}</span><span><i class="wd-key-med"></i>${s.median}</span></div>
    <div class="fn-chart wd-box">${retChart(st, s, basis, w)}<div class="fn-tip" hidden></div></div>
    <p class="bx-sub">${s.rangeTitle}<span>${s.rangeHint}</span></p>
    <div class="fn-chart wd-box">${rangeChart(st, s, w)}<div class="fn-tip" hidden></div></div>
    <p class="fn-note">${s.note}</p>`;
}

// 提示框：某一个星期几的全部数字
export function tipHtml(st: Pool, i: number, s: WeekdayStrings, c: WeekdayText, basis: string) {
  const d = st.days[i];
  const r = ret(d, basis);
  const [n, k] = upPair(d, basis);
  const [lo, hi] = wilson([n, k]);
  return (
    `<p class="fn-tip-h">${s.days[i]} · ${tplStr(s.nDays, { n: groupNum(n, c.thousands) })}</p>` +
    `<p class="fn-tip-r">${basis === "r" ? s.upR : s.upC}<b>${pc1(share(k, n))}</b></p>` +
    `<p class="fn-tip-r wd-tip-ci">${tplStr(s.ci, { a: pc1(lo), b: pc1(hi) })}</p>` +
    `<p class="fn-tip-r">${s.mean}<b>${signed(r.mean)}</b></p>` +
    `<p class="fn-tip-r">${s.median}<b>${signed(r.median)}</b></p>` +
    `<p class="fn-tip-r">${s.rangeMed}<b>${d.g.median.toFixed(2)}%</b></p>`
  );
}
