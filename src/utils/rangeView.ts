// 日内波幅分布：可交互直方图 + 逐年变化。构建时生成默认画面，浏览器里换年份 / 改宽度时用同一个函数重画。
// 数据只有天数（src/data/range-by-year.json，由 ES-breakout-dashboard/日内波幅.py 生成）：
// 每年每个波幅（精确到 0.01%，键是百分之一的整数，比如 "90" = 0.90%）有多少天。选多年时先把天数加起来再算。
import type { UIStrings } from "@/i18n/types";
import { tplStr } from "@/i18n/format";
import { groupNum } from "./breakoutView";

export type RangeData = Record<string, Record<string, number>>;
export type RangeStrings = UIStrings["range"];
export type Common = { sample: string; days: string; thousands: string; onlyYear: string };

export const STEP = 10; // 直方图每格 0.1%（10 个 0.01%）
export const BINS = 30; // 0%–3% 共 30 格，3% 以上并成最后一格
export const HH = 250;
export const HM = { l: 40, r: 12, t: 14, b: 26 };
export const QH = 230;
export const QM = { l: 40, r: 12, t: 14, b: 26 };
export const QTOP = 4; // 纵轴只画到 4%，更大的日子贴着顶边，另外标出最大值
export const YH = 210;
export const YM = { l: 40, r: 12, t: 14, b: 26 };

const pc = (v: number) => v.toFixed(2) + "%";
const pc1 = (v: number) => v.toFixed(1) + "%";

export function years(data: RangeData): number[] {
  return Object.keys(data).map(Number).sort((a, b) => a - b);
}

// 把选中年份的天数合在一起：按波幅从小到大排好的 [百分之一, 天数]
function pool(data: RangeData, y0: number, y1: number) {
  const m = new Map<number, number>();
  for (const [y, c] of Object.entries(data)) {
    if (+y < y0 || +y > y1) continue;
    for (const [k, n] of Object.entries(c)) m.set(+k, (m.get(+k) ?? 0) + n);
  }
  const rows = [...m.entries()].sort((a, b) => a[0] - b[0]);
  const total = rows.reduce((s, [, n]) => s + n, 0);
  return { rows, total };
}

// 分位数（和 pandas 默认一样，在相邻两个值之间按位置插值），返回百分比
function quantile(rows: [number, number][], total: number, q: number) {
  const pos = q * (total - 1);
  const at = (i: number) => {
    let seen = 0;
    for (const [k, n] of rows) {
      seen += n;
      if (i < seen) return k;
    }
    return rows[rows.length - 1][0];
  };
  const lo = Math.floor(pos);
  const a = at(lo);
  const b = at(Math.min(lo + 1, total - 1));
  return (a + (b - a) * (pos - lo)) / 100;
}

export type Stats = ReturnType<typeof stats>;
export function stats(data: RangeData, y0: number, y1: number) {
  const { rows, total } = pool(data, y0, y1);
  const q = (p: number) => quantile(rows, total, p);
  const bins = Array(BINS + 1).fill(0);
  for (const [k, n] of rows) bins[Math.min(BINS, Math.floor(k / STEP))] += n;
  let cum = 0;
  const share = bins.map(n => (100 * n) / total);
  const cumShare = bins.map(n => (100 * (cum += n)) / total);
  // 分位数曲线：第 i 个点是“(i / 2)% 的日子波幅不超过多少”，0%–100% 每 0.5% 一个点
  const curve = Array.from({ length: 201 }, (_, i) => q(i / 200));
  return { total, rows, p10: q(0.1), p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9), share, cumShare, curve };
}

// 平滑曲线：高斯核密度，换算成“每 0.1% 一格占多少天”，和柱子同一个刻度
function density(rows: [number, number][], total: number) {
  const bw = 0.07;
  const pts: [number, number][] = [];
  for (let x = 0; x <= 3.0001; x += 0.02) {
    let d = 0;
    for (const [k, n] of rows) {
      const z = (x - k / 100) / bw;
      if (Math.abs(z) < 4) d += n * Math.exp(-0.5 * z * z);
    }
    pts.push([x, (100 * 0.1 * d) / (total * bw * Math.sqrt(2 * Math.PI))]);
  }
  return pts;
}

export const binLabel = (s: RangeStrings, i: number) =>
  i < BINS
    ? tplStr(s.bin, { a: pc1(i / 10), b: pc1((i + 1) / 10) })
    : tplStr(s.overflow, { a: pc1(BINS / 10) });

// —— 直方图 ——
export const hx = (i: number, w: number) => HM.l + (i / (BINS + 1)) * (w - HM.l - HM.r); // 第 i 格左边
const hxv = (v: number, w: number) => hx(Math.min(v, BINS / 10) * 10, w); // 波幅 v% 的位置

function histogram(st: Stats, s: RangeStrings, w: number) {
  const top = Math.max(4, Math.ceil(Math.max(...st.share) / 2) * 2);
  const y = (v: number) => HH - HM.b - (v / top) * (HH - HM.t - HM.b);
  const bw = hx(1, w) - hx(0, w);
  const step = top <= 8 ? 2 : 4;
  let grid = "";
  for (let v = 0; v <= top; v += step)
    grid += `<line class="${v ? "fn-grid" : "fn-axis"}" x1="${HM.l}" x2="${w - HM.r}" y1="${y(v)}" y2="${y(v)}"/>
      <text x="${HM.l - 8}" y="${y(v)}" dy=".32em" text-anchor="end">${v}%</text>`;
  const ticks = [0, 5, 10, 15, 20, 25, 30]
    .filter((_, i) => w >= 420 || i % 2 === 0)
    .map(
      i =>
        `<text x="${hx(i, w)}" y="${HH - 8}" text-anchor="middle">${i === BINS ? "3%+" : pc1(i / 10).replace(".0%", "%")}</text>`
    )
    .join("");
  const band = `<rect class="rg-band" x="${hxv(st.p25, w)}" y="${HM.t}" width="${hxv(st.p75, w) - hxv(st.p25, w)}" height="${HH - HM.t - HM.b}"/>`;
  const bars = st.share
    .map(
      (v, i) =>
        `<rect class="rg-bar${i === BINS ? " is-over" : ""}" data-i="${i}" x="${hx(i, w) + 1}" y="${y(v)}" width="${Math.max(1, bw - 2)}" height="${HH - HM.b - y(v)}" rx="2"/>`
    )
    .join("");
  const curve = `<path class="rg-curve" d="${density(st.rows, st.total)
    .map(([x, d], i) => `${i ? "L" : "M"}${hxv(x, w).toFixed(1)},${y(Math.min(d, top)).toFixed(1)}`)
    .join("")}"/>`;
  const mark = (v: number, cls: string, label: string, anchor: "start" | "end") =>
    `<line class="${cls}" x1="${hxv(v, w)}" x2="${hxv(v, w)}" y1="${HM.t}" y2="${HH - HM.b}"/>
     <text class="rg-mark-t" x="${hxv(v, w) + (anchor === "start" ? 5 : -5)}" y="${HM.t + 10}" text-anchor="${anchor}">${label}</text>`;
  return `<svg class="rg-hist" viewBox="0 0 ${w} ${HH}" width="100%" height="${HH}" role="img" aria-label="${s.label}">
    ${grid}${band}${bars}${curve}${ticks}
    ${mark(st.p50, "rg-median", `${s.median} ${pc(st.p50)}`, "start")}
    ${mark(st.p90, "rg-p90", `90% ${pc(st.p90)}`, "start")}
  </svg>`;
}

// —— 分位数曲线：横轴是日子的比例，纵轴是波幅 ——
export const qx = (p: number, w: number) => QM.l + (p / 100) * (w - QM.l - QM.r);
export const qy = (v: number) => QH - QM.b - (Math.min(v, QTOP) / QTOP) * (QH - QM.t - QM.b);

function quantileChart(st: Stats, s: RangeStrings, w: number) {
  let grid = "";
  for (let v = 0; v <= QTOP; v += 1)
    grid += `<line class="${v ? "fn-grid" : "fn-axis"}" x1="${QM.l}" x2="${w - QM.r}" y1="${qy(v)}" y2="${qy(v)}"/>
      <text x="${QM.l - 8}" y="${qy(v)}" dy=".32em" text-anchor="end">${v}%</text>`;
  const ticks = [0, 25, 50, 75, 90, 100]
    .filter(p => w >= 420 || p !== 90)
    .map(p => `<text x="${qx(p, w)}" y="${QH - 8}" text-anchor="middle">${p}%</text>`)
    .join("");
  const line = `<path class="rg-qline" d="${st.curve
    .map((v, i) => `${i ? "L" : "M"}${qx(i / 2, w).toFixed(1)},${qy(v).toFixed(1)}`)
    .join("")}"/>`;
  // 中位数和 90% 两个参考点：虚线引到坐标轴
  const guide = (p: number, v: number) =>
    `<polyline class="fn-ref" fill="none" points="${QM.l},${qy(v)} ${qx(p, w)},${qy(v)} ${qx(p, w)},${QH - QM.b}"/>
     <circle class="rg-qdot" cx="${qx(p, w)}" cy="${qy(v)}" r="3.5"/>
     <text class="rg-mark-t" x="${qx(p, w) + (p > 50 ? -6 : 6)}" y="${qy(v) - 7}" text-anchor="${p > 50 ? "end" : "start"}">${tplStr(s.qTip, { p: p + "%", v: pc(v) })}</text>`;
  const max = st.curve[200];
  const over =
    max > QTOP
      ? `<text class="rg-mark-t" x="${w - QM.r}" y="${QM.t - 2}" text-anchor="end">${tplStr(s.qMax, { v: pc(max) })} ↑</text>`
      : "";
  const hover = `<line class="fn-rule" y1="${QM.t}" y2="${QH - QM.b}"/><circle class="fn-dot rg-qhover" r="4"/>`;
  return `<svg class="rg-q" viewBox="0 0 ${w} ${QH}" width="100%" height="${QH}" role="img" aria-label="${s.qTitle}">
    ${grid}${ticks}${guide(50, st.p50)}${guide(90, st.p90)}${line}${over}${hover}
  </svg>`;
}

// —— 逐年变化 ——
export const yxOf = (i: number, n: number, w: number) => YM.l + ((i + 0.5) / n) * (w - YM.l - YM.r);
export type YearStat = { y: number; on: boolean } & Stats;

function byYear(s: RangeStrings, ys: YearStat[], all: number, w: number) {
  const hi = Math.max(...ys.map(d => d.p90));
  const top = hi > 3 ? Math.ceil(hi) : Math.ceil(hi * 2) / 2;
  const y = (v: number) => YH - YM.b - (v / top) * (YH - YM.t - YM.b);
  let grid = "";
  for (let v = 0; v <= top + 1e-9; v += top > 3 ? 1 : 0.5)
    grid += `<line class="${v ? "fn-grid" : "fn-axis"}" x1="${YM.l}" x2="${w - YM.r}" y1="${y(v)}" y2="${y(v)}"/>
      <text x="${YM.l - 8}" y="${y(v)}" dy=".32em" text-anchor="end">${v}%</text>`;
  const n = ys.length;
  const ref = `<line class="fn-ref" x1="${YM.l}" x2="${w - YM.r}" y1="${y(all)}" y2="${y(all)}"/>`;
  const cols = ys
    .map((d, i) => {
      const x = yxOf(i, n, w);
      const lab = w >= 520 || i % 2 === 0 ? `<text x="${x}" y="${YH - 8}" text-anchor="middle">${w >= 520 ? d.y : "’" + String(d.y).slice(2)}</text>` : "";
      return `<g class="rg-yr${d.on ? "" : " is-off"}" data-i="${i}">
        <line class="rg-whisk" x1="${x}" x2="${x}" y1="${y(d.p10)}" y2="${y(d.p90)}"/>
        <line class="rg-iqr" x1="${x}" x2="${x}" y1="${y(d.p25)}" y2="${y(d.p75)}"/>
        <circle class="rg-med" cx="${x}" cy="${y(d.p50)}" r="3.5"/>
        ${lab}
      </g>`;
    })
    .join("");
  return `<svg class="rg-years" viewBox="0 0 ${w} ${YH}" width="100%" height="${YH}" role="img" aria-label="${s.yearsTitle}">
    ${grid}${ref}${cols}<rect class="rg-hit" x="${YM.l}" y="${YM.t}" width="${w - YM.l - YM.r}" height="${YH - YM.t - YM.b}"/>
  </svg>`;
}

export function yearStats(data: RangeData, y0: number, y1: number): YearStat[] {
  return years(data).map(y => ({ y, on: y >= y0 && y <= y1, ...stats(data, y, y) }));
}

export function renderRange(
  data: RangeData,
  s: RangeStrings,
  c: Common,
  range: string,
  y0: number,
  y1: number,
  w: number
): string {
  const st = stats(data, y0, y1);
  const ys = yearStats(data, y0, y1);
  const first = ys[0].y;
  const last = ys[ys.length - 1].y;
  const all = stats(data, first, last).p50;
  return `
    <div class="bx-hero">
      <p class="bx-hero-k">${tplStr(s.heroLabel, { range })}</p>
      <p class="bx-hero-v">${pc(st.p50)}</p>
      <p class="bx-hero-n">${tplStr(c.sample, { n: groupNum(st.total, c.thousands) })} · ${tplStr(s.heroSub, { a: pc(st.p25), b: pc(st.p75) })}</p>
    </div>
    <div class="fn-legend">
      <span><i class="rg-key-bar"></i>${s.bars}</span>
      <span><i class="rg-key-band"></i>${tplStr(s.band, { a: pc(st.p25), b: pc(st.p75) })}</span>
      <span><i class="rg-key-line"></i>${s.median}</span>
      <span><i class="rg-key-dash"></i>${tplStr(s.p90, { v: pc(st.p90) })}</span>
    </div>
    <div class="fn-chart rg-hist-box">${histogram(st, s, w)}<div class="fn-tip" hidden></div></div>
    <p class="bx-sub">${s.qTitle}<span>${s.qHint}</span></p>
    <div class="fn-chart rg-q-box">${quantileChart(st, s, w)}<div class="fn-tip" hidden></div></div>
    <p class="bx-sub">${s.yearsTitle}<span>${s.yearsHint} ${tplStr(s.allMedian, { v: pc(all) })}</span></p>
    <div class="fn-chart rg-years-box">${byYear(s, ys, all, w)}<div class="fn-tip" hidden></div></div>
    <p class="fn-note">${s.note}</p>`;
}

export const fmt = { pc, pc1 };
