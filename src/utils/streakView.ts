// 连续阳线 / 阴线之后：连涨（连跌）N 根以后，下一根收阳的概率，圆点 + 95% 区间。构建时生成默认画面，浏览器里切换 / 改宽度时用同一个函数重画。
// 数据只有次数（src/data/streaks.json，由 ES-breakout-dashboard/连续阳阴线.py 生成）：
// 日线 d / 周线 w → 日盘 r / 全天 f → 年份 → base（任意一根之后：[次数, 下一根收阳]）、u / b（连涨 / 连跌 1–8+ 根之后）。
import type { UIStrings } from "@/i18n/types";
import { tplStr } from "@/i18n/format";
import { groupNum } from "./breakoutView";
import { pc1, share, yAxis, xLabels, type Box, type YearText } from "./chartKit";

type Pair = [number, number];
type Year = { base: number[]; u: number[][]; b: number[][] }; // JSON 里是普通数组：[次数, 下一根收阳]
export type StreakData = Record<string, Record<string, Record<string, Year>>>;
export type StreakStrings = UIStrings["streak"];
export type StreakText = YearText & { thousands: string };

export const MAXN = 8;
export const THIN = 20;

export function years(data: StreakData): number[] {
  return Object.keys(data.d.r).map(Number).sort((a, b) => a - b);
}

export function pool(data: StreakData, tf: string, ses: string, y0: number, y1: number) {
  const base: Pair = [0, 0];
  const u: Pair[] = Array.from({ length: MAXN }, () => [0, 0]);
  const b: Pair[] = Array.from({ length: MAXN }, () => [0, 0]);
  for (const [y, d] of Object.entries(data[tf][ses])) {
    if (+y < y0 || +y > y1) continue;
    base[0] += d.base[0];
    base[1] += d.base[1];
    for (let i = 0; i < MAXN; i++) {
      u[i][0] += d.u[i][0];
      u[i][1] += d.u[i][1];
      b[i][0] += d.b[i][0];
      b[i][1] += d.b[i][1];
    }
  }
  // 连涨 / 连跌 2 根以上合在一起
  const two = (a: Pair[]) => a.slice(1).reduce<Pair>((s, [n, k]) => [s[0] + n, s[1] + k], [0, 0]);
  return { base, u, b, u2: two(u), b2: two(b) };
}
export type Pool = ReturnType<typeof pool>;

// 95% 区间（Wilson），样本少时比“比例 ± 2 倍标准误”更靠谱
export function wilson([n, k]: Pair): [number, number] {
  if (!n) return [NaN, NaN];
  const z = 1.96;
  const p = k / n;
  const c = (p + (z * z) / (2 * n)) / (1 + (z * z) / n);
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n);
  return [100 * (c - h), 100 * (c + h)];
}

export const nLabel = (s: StreakStrings, i: number) => tplStr(i === MAXN - 1 ? s.nBarsPlus : s.nBars, { n: i + 1 });

// —— 圆点 + 区间 ——
export const B: Omit<Box, "w"> = { h: 260, l: 40, r: 12, t: 14, b: 26 };
export const LO = 20;
export const HI = 90;
export const band = (w: number) => (w - B.l - B.r) / MAXN;
export const cx = (i: number, w: number) => B.l + (i + 0.5) * band(w);
export const cy = (v: number) => B.h - B.b - ((Math.min(HI, Math.max(LO, v)) - LO) / (HI - LO)) * (B.h - B.t - B.b);

function chart(st: Pool, s: StreakStrings, w: number) {
  const box = { ...B, w };
  const off = Math.min(9, band(w) * 0.18);
  const base = share(st.base[1], st.base[0]);
  const marks = (a: Pair[], k: "u" | "b", dx: number) =>
    a
      .map((p, i) => {
        if (!p[0]) return "";
        const [lo, hi] = wilson(p);
        const x = cx(i, w) + dx;
        return `<g class="sx-${k}${p[0] < THIN ? " is-thin" : ""}">
          <line class="sx-ci" x1="${x}" x2="${x}" y1="${cy(lo)}" y2="${cy(hi)}"/>
          <circle class="sx-pt" cx="${x}" cy="${cy(share(p[1], p[0]))}" r="4.5"/>
        </g>`;
      })
      .join("");
  const cols = Array.from({ length: MAXN }, (_, i) => `<rect class="sx-col" data-i="${i}" x="${B.l + i * band(w)}" y="${box.t}" width="${band(w)}" height="${box.h - box.t - box.b}"/>`).join("");
  return `<svg class="sx-chart" viewBox="0 0 ${w} ${box.h}" width="100%" height="${box.h}" role="img" aria-label="${s.chartTitle}">
    ${yAxis(box, [20, 30, 40, 50, 60, 70, 80, 90], cy, v => v + "%")}${cols}
    ${xLabels(box, Array.from({ length: MAXN }, (_, i) => [cx(i, w), i === MAXN - 1 ? `${MAXN}+` : String(i + 1)]))}
    <line class="fn-ref" x1="${box.l}" x2="${w - box.r}" y1="${cy(base)}" y2="${cy(base)}"/>
    <text class="zx-t" x="${w - box.r}" y="${cy(base) - 6}" text-anchor="end">${s.base} ${pc1(base)}</text>
    ${marks(st.u, "u", -off)}${marks(st.b, "b", off)}
  </svg>`;
}

export function renderStreak(data: StreakData, s: StreakStrings, c: StreakText, range: string, tf: string, ses: string, y0: number, y1: number, w: number) {
  const st = pool(data, tf, ses, y0, y1);
  return `
    <div class="bx-hero">
      <p class="bx-hero-k">${tplStr(s.heroLabel, { range })}</p>
      <p class="bx-hero-v">${pc1(share(st.b2[1], st.b2[0]))}</p>
      <p class="bx-hero-n">${tplStr(s.heroSub, {
        n: groupNum(st.b2[0], c.thousands),
        base: pc1(share(st.base[1], st.base[0])),
        up: pc1(share(st.u2[1], st.u2[0])),
      })}</p>
    </div>
    <p class="bx-sub">${s.chartTitle}<span>${s.chartHint}</span></p>
    <div class="fn-legend">
      <span><i class="sx-key-u"></i>${s.afterUp}</span>
      <span><i class="sx-key-b"></i>${s.afterDn}</span>
    </div>
    <div class="fn-chart sx-box">${chart(st, s, w)}<div class="fn-tip" hidden></div></div>
    <p class="fn-note">${s.note}</p>`;
}
