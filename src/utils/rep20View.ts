// Wedge Rep20 实盘概况：大数字（平均每笔）+ 四个小卡片 + 累计 R 曲线。构建时生成默认画面，浏览器里切换范围 / 改宽度时用同一个函数重画。
// 数据是文章文件夹里的 trades.json（每笔交易一行，r = 盈亏点数 ÷ 初始止损）。文案从 i18n 的 rep20 传进来，中英文页面共用。
import { yAxis, xLabels, type Box } from "./chartKit";
import { tplStr } from "@/i18n/format";
import type { UIStrings } from "@/i18n/types";

export type Trade = {
  n: number;
  date: string;
  entry: string;
  dir: string;
  setup: string;
  pts: number;
  r: number;
  kind: "rush" | "other" | "rule";
};
export type S = UIStrings["rep20"];

// sys = 系统内（去掉规则外的那一笔），all = 全部
export const pick = (trades: Trade[], mode: string) => (mode === "all" ? trades : trades.filter(t => t.kind !== "rule"));

export const signedR = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(2) + "R";
const signed = (v: number, unit = "") => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toLocaleString("en-US") + unit;
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;

// 数据里方向、类别是中文（空 / 多，rush / rule），显示时换成当前语言
export const nTrades = (s: S, n: number) => tplStr(n === 1 ? s.trade1 : s.trades, { n });
export const dirText = (s: S, d: string) => (d === "空" ? s.short : s.long);
export const kindText = (s: S, k: string) => (k === "rush" ? s.rush : k === "rule" ? s.rule : "");

export function curve(ts: Trade[]) {
  let c = 0;
  return ts.map(t => (c += t.r));
}

export const B: Omit<Box, "w"> = { h: 230, l: 46, r: 14, t: 14, b: 26 };
export const xOf = (i: number, n: number, w: number) => B.l + (i / n) * (w - B.l - B.r);

function scale(cum: number[]) {
  const lo = Math.min(0, ...cum);
  const hi = Math.max(...cum);
  const y0 = lo < 0 ? Math.floor(lo - 0.2) : 0;
  const y1 = Math.ceil(hi + 0.2);
  const y = (v: number) => B.h - B.b - ((v - y0) / (y1 - y0)) * (B.h - B.t - B.b);
  const step = y1 - y0 > 5 ? 2 : 1;
  const ticks: number[] = [];
  for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) ticks.push(v);
  return { y, ticks };
}
export const yScale = (cum: number[]) => scale(cum).y;

function chart(ts: Trade[], w: number, s: S) {
  const cum = curve(ts);
  const n = ts.length;
  const { y, ticks } = scale(cum);
  const box = { ...B, w };
  const pts = [[xOf(0, n, w), y(0)], ...cum.map((v, i) => [xOf(i + 1, n, w), y(v)])];
  const path = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");
  const marks = ts.flatMap((t, i) => ([1, 5, 10, 15, 20].includes(t.n) ? [i] : []));
  const dots = ts
    .map((t, i) => `<circle class="r20-pt is-${t.kind}" cx="${xOf(i + 1, n, w)}" cy="${y(cum[i])}" r="4"/>`)
    .join("");
  return `<svg viewBox="0 0 ${w} ${B.h}" width="100%" height="${B.h}" role="img" aria-label="${s.cumChart}">
    ${yAxis(box, ticks, y, v => (v > 0 ? `+${v}R` : v < 0 ? `−${-v}R` : "0"))}
    <line class="fn-axis" x1="${B.l}" x2="${w - B.r}" y1="${y(0)}" y2="${y(0)}"/>
    <path class="r20-line" d="${path}"/>
    <line class="fn-rule" y1="${B.t}" y2="${B.h - B.b}"/>
    ${dots}
    <circle class="fn-dot r20-hover" r="6"/>
    ${xLabels(box, marks.map(i => [xOf(i + 1, n, w), `#${ts[i].n}`]))}
  </svg>`;
}

export function renderOverview(trades: Trade[], mode: string, w: number, s: S) {
  const ts = pick(trades, mode);
  const wins = ts.filter(t => t.pts > 0);
  const losses = ts.filter(t => t.pts < 0);
  const sumR = ts.reduce((s, t) => s + t.r, 0);
  const pts = ts.reduce((s, t) => s + t.pts, 0);
  const cum = curve(ts);
  let peak = 0;
  let dd = 0;
  for (const v of cum) {
    peak = Math.max(peak, v);
    dd = Math.max(dd, peak - v);
  }
  const tile = (k: string, v: string, note: string) =>
    `<div class="bx-tile"><p class="bx-tile-k">${k}</p><p class="bx-tile-v">${v}</p><p class="bx-tile-n">${note}</p></div>`;
  return `
    <div class="bx-hero">
      <p class="bx-hero-k">${tplStr(s.heroK, { scope: mode === "all" ? s.all : s.sys, n: ts.length })}</p>
      <p class="bx-hero-v">${signedR(sumR / ts.length)}</p>
      <p class="bx-hero-n">${tplStr(s.heroN, { r: signedR(sumR), pts: signed(pts), usd: signed(pts * 5).replace(/^([+−])/, "$1$") })}</p>
    </div>
    <div class="bx-tiles">
      ${tile(s.winRate, `${Math.round((100 * wins.length) / ts.length)}%`, tplStr(s.winLoss, { w: wins.length, l: losses.length }))}
      ${tile(s.avgWin, signedR(mean(wins.map(t => t.r))), nTrades(s, wins.length))}
      ${tile(s.avgLoss, signedR(mean(losses.map(t => t.r))), nTrades(s, losses.length))}
      ${tile(s.maxDD, signedR(-dd), s.fromPeak)}
    </div>
    <p class="bx-sub">${s.cumR}</p>
    <div class="fn-legend">
      <span><i class="r20-key-rush"></i>${s.rush}</span>
      <span><i class="r20-key-other"></i>${s.otherShort}</span>
      ${mode === "all" ? `<span><i class="r20-key-rule"></i>${s.rule}</span>` : ""}
    </div>
    <div class="fn-chart r20-chart">${chart(ts, w, s)}<div class="fn-tip" hidden></div></div>`;
}
