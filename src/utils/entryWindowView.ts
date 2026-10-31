// Wedge Rep20 入场时间段假设：只在 [开始, 结束) 之间开仓，19 笔系统内交易会变成什么样。
// 上面四个小卡片 + 两条累计 R 曲线（全部 vs 只做这个时间段）+ 不同结束时间的合计 R 柱子。构建时和浏览器里用同一个函数画。
import { yAxis, xLabels, type Box } from "./chartKit";
import { signedR, type Trade, type S } from "./rep20View";
import { tplStr } from "@/i18n/format";

export const OPEN = 9 * 60 + 30;
export const CLOSE = 15 * 60;
export const STARTS = Array.from({ length: 11 }, (_, i) => OPEN + 30 * i); // 9:30 … 14:30
export const ENDS = Array.from({ length: 10 }, (_, i) => OPEN + 60 + 30 * i); // 10:30 … 15:00

export const hhmm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
export const minOf = (t: Trade) => +t.entry.slice(0, 2) * 60 + +t.entry.slice(3);
export const inWin = (t: Trade, a: number, b: number) => minOf(t) >= a && minOf(t) < b;

function stats(ts: Trade[]) {
  const sum = ts.reduce((s, t) => s + t.r, 0);
  const wins = ts.filter(t => t.pts > 0).length;
  return { n: ts.length, sum, avg: ts.length ? sum / ts.length : NaN, win: ts.length ? (100 * wins) / ts.length : NaN };
}
const avgR = (v: number) => (Number.isFinite(v) ? signedR(v) : "—");
const pct = (v: number) => (Number.isFinite(v) ? Math.round(v) + "%" : "—");

// 累计 R：不在时间段里的那一笔算 0
export function curves(ts: Trade[], a: number, b: number) {
  let all = 0;
  let rule = 0;
  return ts.map(t => {
    all += t.r;
    if (inWin(t, a, b)) rule += t.r;
    return [all, rule];
  });
}

function scale(B: Omit<Box, "w">, vals: number[]) {
  const lo = Math.floor(Math.min(0, ...vals) - 0.2);
  const hi = Math.ceil(Math.max(0, ...vals) + 0.2);
  const y = (v: number) => B.h - B.b - ((v - lo) / (hi - lo)) * (B.h - B.t - B.b);
  const step = hi - lo > 6 ? 2 : 1;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  return { y, ticks };
}
const rLabel = (v: number) => (v > 0 ? `+${v}R` : v < 0 ? `−${-v}R` : "0");

// —— 累计 R 曲线 ——
export const CB: Omit<Box, "w"> = { h: 220, l: 46, r: 14, t: 14, b: 26 };
export const cxOf = (i: number, n: number, w: number) => CB.l + (i / n) * (w - CB.l - CB.r);
export const curveY = (ts: Trade[], a: number, b: number) => scale(CB, curves(ts, a, b).flat()).y;

function curveChart(ts: Trade[], a: number, b: number, w: number, s: S) {
  const cs = curves(ts, a, b);
  const n = ts.length;
  const { y, ticks } = scale(CB, cs.flat());
  const path = (k: 0 | 1) =>
    [[cxOf(0, n, w), y(0)], ...cs.map((c, i) => [cxOf(i + 1, n, w), y(c[k])])]
      .map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`)
      .join("");
  const dots = ts
    .map((t, i) =>
      inWin(t, a, b)
        ? `<circle class="ew-pt" cx="${cxOf(i + 1, n, w)}" cy="${y(cs[i][1])}" r="4"/>`
        : `<circle class="ew-pt-off" cx="${cxOf(i + 1, n, w)}" cy="${y(cs[i][0])}" r="3"/>`
    )
    .join("");
  const marks = ts.flatMap((t, i) => ([1, 5, 10, 15, 20].includes(t.n) ? [i] : []));
  return `<svg viewBox="0 0 ${w} ${CB.h}" width="100%" height="${CB.h}" role="img" aria-label="${s.curveAria}">
    ${yAxis({ ...CB, w }, ticks, y, rLabel)}
    <line class="fn-axis" x1="${CB.l}" x2="${w - CB.r}" y1="${y(0)}" y2="${y(0)}"/>
    <path class="ew-all" d="${path(0)}"/>
    <path class="ew-rule" d="${path(1)}"/>
    <line class="fn-rule" y1="${CB.t}" y2="${CB.h - CB.b}"/>
    ${dots}
    <circle class="fn-dot ew-hover" r="6"/>
    ${xLabels({ ...CB, w }, marks.map(i => [cxOf(i + 1, n, w), `#${ts[i].n}`]))}
  </svg>`;
}

// —— 不同结束时间的合计 R（开始时间不变）——
export const BB: Omit<Box, "w"> = { h: 190, l: 46, r: 14, t: 22, b: 26 };
export const endsFrom = (a: number) => ENDS.filter(e => e > a);
export const barBand = (k: number, w: number) => (w - BB.l - BB.r) / k;

function barChart(ts: Trade[], a: number, b: number, w: number, s: S) {
  const ends = endsFrom(a);
  const sums = ends.map(e => stats(ts.filter(t => inWin(t, a, e))).sum);
  const { y, ticks } = scale(BB, sums);
  const band = barBand(ends.length, w);
  const bw = Math.min(28, band * 0.56);
  const every = band < 44 ? 2 : 1;
  const bars = ends
    .map((e, i) => {
      const c = BB.l + (i + 0.5) * band;
      const v = sums[i];
      const top = Math.min(y(v), y(0));
      return `<rect class="ew-bar${e === b ? " is-on" : ""}" data-i="${i}" x="${c - bw / 2}" y="${top}" width="${bw}" height="${Math.max(1, Math.abs(y(v) - y(0)))}" rx="3"/>
        ${e === b || band >= 44 ? `<text class="ew-val${e === b ? " is-on" : ""}" x="${c}" y="${v >= 0 ? y(v) - 6 : y(v) + 14}" text-anchor="middle">${signedR(v).replace(".00", "")}</text>` : ""}`;
    })
    .join("");
  const labels = ends.flatMap((e, i) => ((ends.length - 1 - i) % every === 0 ? [[BB.l + (i + 0.5) * band, hhmm(e)] as [number, string]] : []));
  return `<svg viewBox="0 0 ${w} ${BB.h}" width="100%" height="${BB.h}" role="img" aria-label="${s.barsAria}">
    ${yAxis({ ...BB, w }, ticks, y, rLabel)}
    <line class="fn-axis" x1="${BB.l}" x2="${w - BB.r}" y1="${y(0)}" y2="${y(0)}"/>
    ${bars}
    ${xLabels({ ...BB, w }, labels)}
  </svg>`;
}

export function barTip(ts: Trade[], a: number, e: number, s: S) {
  const st = stats(ts.filter(t => inWin(t, a, e)));
  return (
    `<p class="fn-tip-h">${tplStr(s.barTipH, { a: hhmm(a), b: hhmm(e), n: st.n })}</p>` +
    `<p class="fn-tip-r">${s.total}<b>${st.n ? signedR(st.sum) : "—"}</b></p>` +
    `<p class="fn-tip-r">${s.avgPer}<b>${avgR(st.avg)}</b></p>` +
    `<p class="fn-tip-r">${s.winRate}<b>${pct(st.win)}</b></p>`
  );
}

export function renderWindow(ts: Trade[], a: number, b: number, w: number, s: S) {
  const all = stats(ts);
  const r = stats(ts.filter(t => inWin(t, a, b)));
  const tile = (k: string, v: string, note: string) =>
    `<div class="bx-tile"><p class="bx-tile-k">${k}</p><p class="bx-tile-v">${v}</p><p class="bx-tile-n">${note}</p></div>`;
  return `
    <div class="bx-tiles">
      ${tile(s.count, `${r.n}`, tplStr(s.skipN, { n: all.n - r.n }))}
      ${tile(s.total, r.n ? signedR(r.sum) : "—", tplStr(s.allV, { v: signedR(all.sum) }))}
      ${tile(s.avgPer, avgR(r.avg), tplStr(s.allV, { v: signedR(all.avg) }))}
      ${tile(s.winRate, pct(r.win), tplStr(s.allV, { v: pct(all.win) }))}
    </div>
    <p class="bx-sub">${s.cumR}</p>
    <div class="fn-legend">
      <span><i class="ew-key-rule"></i>${tplStr(s.onlyIn, { a: hhmm(a), b: hhmm(b) })}</span>
      <span><i class="ew-key-all"></i>${tplStr(s.allN, { n: all.n })}</span>
    </div>
    <div class="fn-chart ew-curve">${curveChart(ts, a, b, w, s)}<div class="fn-tip" hidden></div></div>
    <p class="bx-sub">${s.endsTitle}</p>
    <div class="fn-chart ew-bars">${barChart(ts, a, b, w, s)}<div class="fn-tip" hidden></div></div>`;
}
