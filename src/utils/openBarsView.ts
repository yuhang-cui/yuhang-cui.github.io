// 开盘连续同色 K 线：开盘前 N 根都收阳（收阴）之后，四件事的比例（折线图）。构建时生成默认画面，浏览器里切换 / 改宽度时用同一个函数重画。
// 数据只有次数（src/data/opening-bars.json，由 ES-breakout-dashboard/开盘连续同色.py 生成）：
// K 线周期（5、15、30、60 分钟）→ 年份 → 天数、收阳 / 收阴的天数，以及 u（连续阳线）/ d（连续阴线）N = 1, 2, … 时的
// [出现天数, 全天同色, 收在信号收盘之外, 反方向极值已出现, 之后还创新高（低）]。
import type { UIStrings } from "@/i18n/types";
import { tplStr } from "@/i18n/format";
import { groupNum } from "./breakoutView";
import { pc1, share, yAxis, xLabels, type Box, type YearText } from "./chartKit";

type Row = [number, number, number, number, number];
type Year = { days: number; bull: number; bear: number; u: number[][]; d: number[][] };
export type OpenBarsData = Record<string, Record<string, Year>>;
export type OpenBarsStrings = UIStrings["openBars"];
export type OpenBarsText = YearText & { thousands: string };
export type Metric = "same" | "beyond" | "opp" | "more";

export const TFS = ["5", "15", "30", "60"];
export const THIN = 20;
// 四条线：颜色和“前 N 根”那张图一样
export const LINES: { k: Metric; i: number; color: string }[] = [
  { k: "same", i: 1, color: "#006cac" },
  { k: "beyond", i: 2, color: "#b08a2e" },
  { k: "opp", i: 3, color: "#7a5aa6" },
  { k: "more", i: 4, color: "#2b8a99" },
];

export function years(data: OpenBarsData): number[] {
  return Object.keys(data["60"]).map(Number).sort((a, b) => a - b);
}

export function pool(data: OpenBarsData, tf: string, dir: string, y0: number, y1: number) {
  let days = 0;
  let base = 0;
  let rows: Row[] = [];
  for (const [y, d] of Object.entries(data[tf])) {
    if (+y < y0 || +y > y1) continue;
    days += d.days;
    base += dir === "u" ? d.bull : d.bear;
    const src = dir === "u" ? d.u : d.d;
    if (!rows.length) rows = src.map((): Row => [0, 0, 0, 0, 0]);
    src.forEach((r, n) => r.forEach((v, j) => (rows[n][j] += v)));
  }
  return { days, base, rows };
}
export type Pool = ReturnType<typeof pool>;

// 第 n 根收线的时间（n 根 tf 分钟的 K 线，最后一根 60 分钟是 15:30–16:15）
export function signalEnd(tf: string, n: number) {
  const m = Math.min(9 * 60 + 30 + n * +tf, 16 * 60 + 15);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

export const label = (s: OpenBarsStrings, k: Metric, dir: string) => s[`${k}${dir === "u" ? "U" : "D"}` as keyof OpenBarsStrings];

// —— 折线图 ——
export const B: Omit<Box, "w"> = { h: 270, l: 40, r: 16, t: 14, b: 26 };
export const px = (n: number, N: number, w: number) => B.l + 14 + ((n - 1) / (N - 1)) * (w - B.l - B.r - 28);
export const py = (v: number) => B.h - B.b - (v / 100) * (B.h - B.t - B.b);

function chart(st: Pool, s: OpenBarsStrings, dir: string, w: number) {
  const box = { ...B, w };
  const N = st.rows.length;
  const base = share(st.base, st.days);
  const lines = LINES.map(({ k, i, color }) => {
    const pts = st.rows.map((r, n) => [px(n + 1, N, w), py(share(r[i], r[0]) || 0), r[0]] as const);
    const path = pts.map(([x, y], n) => `${n ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
    const dots = pts
      .map(([x, y, n]) => `<circle class="cx-pt${n < THIN ? " is-thin" : ""}" cx="${x}" cy="${y}" r="3.5" stroke="${color}" fill="${n < THIN ? "#fbfbf9" : color}"/>`)
      .join("");
    return `<g class="cx-line" data-k="${k}"><path fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" d="${path}"/>${dots}</g>`;
  }).join("");
  return `<svg class="cx-chart" viewBox="0 0 ${w} ${box.h}" width="100%" height="${box.h}" role="img" aria-label="${s.chartTitle}">
    ${yAxis(box, [0, 25, 50, 75, 100], py, v => v + "%")}
    ${xLabels(box, st.rows.map((_, n) => [px(n + 1, N, w), String(n + 1)]))}
    <line class="fn-ref" x1="${box.l}" x2="${w - box.r}" y1="${py(base)}" y2="${py(base)}"/>
    <text class="zx-t" x="${w - box.r}" y="${py(base) + 15}" text-anchor="end">${tplStr(dir === "u" ? s.baseU : s.baseD, { p: pc1(base) })}</text>
    ${lines}
    <line class="fn-rule" y1="${box.t}" y2="${box.h - box.b}"/>
  </svg>`;
}

export function renderOpenBars(data: OpenBarsData, s: OpenBarsStrings, c: OpenBarsText, range: string, tf: string, dir: string, y0: number, y1: number, w: number) {
  const st = pool(data, tf, dir, y0, y1);
  const r = st.rows[1]; // 开盘前 2 根
  const U = dir === "u";
  return `
    <div class="bx-hero">
      <p class="bx-hero-k">${tplStr(U ? s.heroU : s.heroD, { range, t: tf })}</p>
      <p class="bx-hero-v">${pc1(share(r[1], r[0]))}</p>
      <p class="bx-hero-n">${tplStr(U ? s.heroSubU : s.heroSubD, {
        n: groupNum(r[0], c.thousands),
        p: pc1(share(r[0], st.days)),
        b: pc1(share(r[2], r[0])),
      })}</p>
    </div>
    <p class="bx-sub">${s.chartTitle}<span>${s.chartHint}</span></p>
    <div class="fn-legend">${LINES.map(({ k, color }) => `<span><i style="background:${color}"></i>${label(s, k, dir)}</span>`).join("")}</div>
    <div class="fn-chart cx-box">${chart(st, s, dir, w)}<div class="fn-tip" hidden></div></div>
    <p class="fn-note">${s.note}</p>`;
}
