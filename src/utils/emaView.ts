// 20 均线：第一次碰到均线的时间（累计曲线）+ 离开均线能连续多少根（两条曲线）。构建时生成默认画面，浏览器里换年份 / 改宽度时用同一个函数重画。
// 数据只有次数（src/data/ema-touch.json，由 ES-breakout-dashboard/20均线.py 生成）：每年的天数、没碰到的日子、
// 第一次碰到在第几根的天数（81 个）、在均线上方 / 下方连续 L 根的段数，以及出现过 20 根以上的天数。
import type { UIStrings } from "@/i18n/types";
import { tplStr } from "@/i18n/format";
import { groupNum } from "./breakoutView";
import { pc1, share, yAxis, xLabels, barEnd, type Box, type YearText } from "./chartKit";

type Year = { days: number; never: string[]; first: number[]; up: Record<string, number>; dn: Record<string, number>; d20: number };
export type EmaData = Record<string, Year>;
export type EmaStrings = UIStrings["ema"];
export type EmaText = YearText & { thousands: string };

export const BARS = 81;
export const MAXL = 60; // 连续根数的横轴画到 60 根

export function years(data: EmaData): number[] {
  return Object.keys(data).map(Number).sort((a, b) => a - b);
}

export function pool(data: EmaData, y0: number, y1: number) {
  let days = 0;
  let d20 = 0;
  const never: string[] = [];
  const first = Array(BARS).fill(0);
  const up = Array(BARS + 1).fill(0); // up[L]：在均线上方正好连续 L 根的段数
  const dn = Array(BARS + 1).fill(0);
  for (const [y, d] of Object.entries(data)) {
    if (+y < y0 || +y > y1) continue;
    days += d.days;
    d20 += d.d20;
    never.push(...d.never);
    d.first.forEach((v, i) => (first[i] += v));
    for (const [L, n] of Object.entries(d.up)) up[+L] += n;
    for (const [L, n] of Object.entries(d.dn)) dn[+L] += n;
  }
  // 到第 k 根为止已经碰过的天数（k = 1..81）
  const cum: number[] = [];
  first.reduce((s, v) => (cum.push(s + v), s + v), 0);
  // 连续至少 L 根的段数（L = 1..81）
  const atLeast = (a: number[]) => {
    const out = Array(BARS + 2).fill(0);
    for (let L = BARS; L >= 1; L--) out[L] = out[L + 1] + a[L];
    return out;
  };
  return { days, d20, never, first, cum, up: atLeast(up), dn: atLeast(dn) };
}
export type Pool = ReturnType<typeof pool>;

// —— 第一次碰到：累计曲线 ——
export const FB: Omit<Box, "w"> = { h: 240, l: 40, r: 12, t: 14, b: 26 };
export const fx = (n: number, w: number) => FB.l + ((n - 1) / (BARS - 1)) * (w - FB.l - FB.r);
export const fy = (v: number) => FB.h - FB.b - (v / 100) * (FB.h - FB.t - FB.b);

function firstChart(st: Pool, s: EmaStrings, w: number) {
  const box = { ...FB, w };
  const ticks = [6, 18, 30, 42, 54, 66, 78].filter((_, i) => w >= 480 || i % 2 === 0).map(n => [fx(n, w), barEnd(n - 1)] as [number, string]);
  const path = st.cum.map((v, i) => `${i ? "L" : "M"}${fx(i + 1, w).toFixed(1)},${fy(share(v, st.days)).toFixed(1)}`).join("");
  const v1 = share(st.cum[0], st.days);
  return `<svg class="ex-first" viewBox="0 0 ${w} ${box.h}" width="100%" height="${box.h}" role="img" aria-label="${s.firstTitle}">
    ${yAxis(box, [0, 25, 50, 75, 100], fy, v => v + "%")}${xLabels(box, ticks)}
    <path class="ex-line" d="${path}"/>
    <circle class="ex-mark" cx="${fx(1, w)}" cy="${fy(v1)}" r="3.5"/>
    <text class="zx-t" x="${fx(1, w) + 8}" y="${fy(v1) + 4}">${tplStr(s.bar1, { p: pc1(v1) })}</text>
    <line class="fn-rule" y1="${box.t}" y2="${box.h - box.b}"/><circle class="fn-dot ex-dot" r="4"/>
  </svg>`;
}

// —— 离开均线的连续根数：连续至少 L 根的段数占比 ——
export const SB: Omit<Box, "w"> = { h: 230, l: 40, r: 12, t: 14, b: 26 };
export const sx = (L: number, w: number) => SB.l + ((L - 1) / (MAXL - 1)) * (w - SB.l - SB.r);
// 纵轴用对数刻度：100%、10%、1%、0.1% 等距，长尾才看得清；低于 0.1% 的贴在底边
export const sy = (v: number) => SB.h - SB.b - ((Math.log10(Math.max(v, 0.1)) + 1) / 3) * (SB.h - SB.t - SB.b);

function streakChart(st: Pool, s: EmaStrings, w: number) {
  const box = { ...SB, w };
  const ticks = [1, 10, 20, 30, 40, 50, 60].map(L => [sx(L, w), String(L)] as [number, string]);
  const line = (a: number[], k: string) =>
    `<path class="ex-${k}" d="${Array.from({ length: MAXL }, (_, i) => i + 1)
      .filter(L => share(a[L], a[1]) >= 0.1) // 低于 0.1% 就不画了，免得贴着底边像是一条平线
      .map(L => `${L > 1 ? "L" : "M"}${sx(L, w).toFixed(1)},${sy(share(a[L], a[1])).toFixed(1)}`)
      .join("")}"/>`;
  const ref = `<line class="fn-ref" x1="${sx(20, w)}" x2="${sx(20, w)}" y1="${box.t}" y2="${box.h - box.b}"/>
    <text class="zx-t" x="${sx(20, w) + 5}" y="${box.t + 10}">${s.gap20}</text>`;
  return `<svg class="ex-streak" viewBox="0 0 ${w} ${box.h}" width="100%" height="${box.h}" role="img" aria-label="${s.streakTitle}">
    ${yAxis(box, [0.1, 1, 10, 100], sy, v => v + "%")}${xLabels(box, ticks)}${ref}
    ${line(st.up, "up")}${line(st.dn, "dn")}
    <line class="fn-rule" y1="${box.t}" y2="${box.h - box.b}"/>
    <circle class="fn-dot ex-up-dot" r="3.5"/><circle class="fn-dot ex-dn-dot" r="3.5"/>
  </svg>`;
}

function neverText(st: Pool, s: EmaStrings) {
  if (!st.never.length) return s.neverNone;
  if (st.never.length <= 3) return tplStr(s.neverList, { d: st.never.join("、") });
  return tplStr(s.neverMany, { n: st.never.length });
}

export function renderEma(data: EmaData, s: EmaStrings, c: EmaText, range: string, y0: number, y1: number, w: number) {
  const st = pool(data, y0, y1);
  const touched = st.days - st.never.length;
  return `
    <div class="bx-hero">
      <p class="bx-hero-k">${tplStr(s.heroLabel, { range })}</p>
      <p class="bx-hero-v">${(share(touched, st.days) || 0).toFixed(2)}%</p>
      <p class="bx-hero-n">${tplStr(s.heroSub, { n: groupNum(st.days, c.thousands) })} · ${neverText(st, s)}</p>
    </div>
    <p class="bx-sub">${s.firstTitle}<span>${s.firstHint}</span></p>
    <div class="fn-chart ex-first-box">${firstChart(st, s, w)}<div class="fn-tip" hidden></div></div>
    <p class="bx-sub">${s.streakTitle}<span>${s.streakHint} ${tplStr(s.d20, { p: pc1(share(st.d20, st.days)) })}</span></p>
    <div class="fn-legend">
      <span><i class="ex-key-up"></i>${s.above}</span>
      <span><i class="ex-key-dn"></i>${s.below}</span>
    </div>
    <div class="fn-chart ex-streak-box">${streakChart(st, s, w)}<div class="fn-tip" hidden></div></div>
    <p class="fn-note">${tplStr(s.note, {
      up: groupNum(st.up[1], c.thousands),
      dn: groupNum(st.dn[1], c.thousands),
      per: (share(st.up[1] + st.dn[1], st.days) / 100).toFixed(1),
    })}</p>`;
}
