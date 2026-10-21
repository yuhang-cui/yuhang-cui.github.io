// 开盘就是最高 / 最低价：之后多久回到开盘价（累计曲线）+ 第一根用不同周期的对照表。构建时生成默认画面，浏览器里切换 / 改宽度时用同一个函数重画。
// 数据只有次数（src/data/shaved-open.json，由 ES-breakout-dashboard/开盘即最高最低.py 生成）：
// 第一根的周期（1、5、15、30、60 分钟）→ 年份 → 天数、开在最高或最低价的天数 n（开在最低 lo、最高 hi）、
// 开盘价守到收盘的天数 keep，以及第一次回到开盘价是第几根 5 分钟 K 线 t。
import type { UIStrings } from "@/i18n/types";
import { tplStr } from "@/i18n/format";
import { groupNum } from "./breakoutView";
import { pc1, share, yAxis, xLabels, barEnd, type Box, type YearText } from "./chartKit";

type Year = { days: number; n: number; lo: number; hi: number; keep: number; t: Record<string, number> };
export type ShavedData = Record<string, Record<string, Year>>;
export type ShavedStrings = UIStrings["shaved"];
export type ShavedText = YearText & { thousands: string };

export const TFS = ["1", "5", "15", "30", "60"];
export const BARS = 81;

export function years(data: ShavedData): number[] {
  return Object.keys(data["5"]).map(Number).sort((a, b) => a - b);
}

export function pool(data: ShavedData, tf: string, y0: number, y1: number) {
  let days = 0;
  let n = 0;
  let lo = 0;
  let hi = 0;
  let keep = 0;
  const t = Array(BARS).fill(0);
  for (const [y, d] of Object.entries(data[tf])) {
    if (+y < y0 || +y > y1) continue;
    days += d.days;
    n += d.n;
    lo += d.lo;
    hi += d.hi;
    keep += d.keep;
    for (const [k, v] of Object.entries(d.t)) t[+k] += v;
  }
  // cum[k]：到第 k 根 5 分钟 K 线收线为止，已经回到开盘价的天数
  const cum = [0];
  for (const v of t) cum.push(cum[cum.length - 1] + v);
  return { days, n, lo, hi, keep, cum, back: cum[BARS] };
}
export type Pool = ReturnType<typeof pool>;

const pc2 = (v: number) => (Number.isFinite(v) ? v.toFixed(2) + "%" : "–");

// —— 回到开盘价的累计曲线 ——
export const C: Omit<Box, "w"> = { h: 230, l: 40, r: 12, t: 14, b: 26 };
export const cx = (k: number, w: number) => C.l + (k / BARS) * (w - C.l - C.r);
export const cy = (v: number) => C.h - C.b - (v / 100) * (C.h - C.t - C.b);

function backChart(st: Pool, s: ShavedStrings, tf: string, w: number) {
  const box = { ...C, w };
  const ticks = [6, 18, 30, 42, 54, 66, 78].filter((_, i) => w >= 480 || i % 2 === 0).map(n => [cx(n, w), barEnd(n - 1)] as [number, string]);
  const first = +tf / 5; // 第一根收线的位置（以 5 分钟为单位）
  const ref = `<line class="fn-ref" x1="${cx(first, w)}" x2="${cx(first, w)}" y1="${box.t}" y2="${box.h - box.b}"/>`;
  const path = st.cum.map((v, k) => `${k ? "L" : "M"}${cx(k, w).toFixed(1)},${cy(share(v, st.n) || 0).toFixed(1)}`).join("");
  const end = share(st.back, st.n) || 0;
  return `<svg class="ox-back" viewBox="0 0 ${w} ${box.h}" width="100%" height="${box.h}" role="img" aria-label="${s.backTitle}">
    ${yAxis(box, [0, 25, 50, 75, 100], cy, v => v + "%")}${xLabels(box, ticks)}${ref}
    <path class="ox-line" d="${path}"/>
    <text class="ox-end" x="${w - box.r}" y="${cy(end) - 7}" text-anchor="end">${pc1(end)}</text>
    <line class="fn-rule" y1="${box.t}" y2="${box.h - box.b}"/><circle class="fn-dot ox-dot" r="4"/>
  </svg>`;
}

// —— 第一根用不同周期的对照表，当前选中的那一行高亮 ——
function table(data: ShavedData, s: ShavedStrings, c: ShavedText, tf: string, y0: number, y1: number) {
  const rows = TFS.map(k => {
    const st = pool(data, k, y0, y1);
    return `<tr${k === tf ? ' class="is-on"' : ""}>
      <td>${tplStr(s.min, { n: k })}</td>
      <td>${groupNum(st.n, c.thousands)}<span>${pc2(share(st.n, st.days))}</span></td>
      <td>${pc1(share(st.back, st.n))}</td>
      <td>${pc1(share(st.keep, st.n))}</td>
    </tr>`;
  }).join("");
  return `<table class="ox-table">
    <thead><tr><th>${s.colTf}</th><th>${s.colN}</th><th>${s.colBack}</th><th>${s.colKeep}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export function renderShaved(data: ShavedData, s: ShavedStrings, c: ShavedText, range: string, tf: string, y0: number, y1: number, w: number) {
  const st = pool(data, tf, y0, y1);
  return `
    <div class="bx-hero">
      <p class="bx-hero-k">${tplStr(s.heroLabel, { range, t: tf })}</p>
      <p class="bx-hero-v">${pc2(share(st.n, st.days))}</p>
      <p class="bx-hero-n">${tplStr(s.heroSub, {
        d: groupNum(st.days, c.thousands),
        n: groupNum(st.n, c.thousands),
        lo: groupNum(st.lo, c.thousands),
        hi: groupNum(st.hi, c.thousands),
      })}</p>
    </div>
    <p class="bx-sub">${s.backTitle}<span>${s.backHint}</span></p>
    <div class="fn-chart ox-back-box">${backChart(st, s, tf, w)}<div class="fn-tip" hidden></div></div>
    <p class="bx-sub">${s.tableTitle}<span>${s.tableHint}</span></p>
    ${table(data, s, c, tf, y0, y1)}
    <p class="fn-note">${s.note}</p>`;
}
