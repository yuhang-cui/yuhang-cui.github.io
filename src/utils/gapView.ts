// 缺口回补：按缺口大小的回补率（柱状图）+ 从开盘起多久碰回（累计曲线）。构建时生成默认画面，浏览器里切换 / 改宽度时用同一个函数重画。
// 数据只有次数（src/data/gap-close.json，由 ES-breakout-dashboard/缺口回补.py 生成）：
// 周线 w / 日线 d → 年份 → 向上 u / 向下 d → 每一档的缺口数 n、第一天（第一个小时）就碰回的 f、当期碰回的 c，
// 以及碰回时间 t（从开盘起第几根 5 分钟 K 线；周线一天 81 根接着往下数）。
import type { UIStrings } from "@/i18n/types";
import { tplStr } from "@/i18n/format";
import { groupNum } from "./breakoutView";
import { pc1, share, yAxis, xLabels, barEnd, type Box, type YearText } from "./chartKit";

type Cell = { n: number[]; f: number[]; c: number[]; t: Record<string, number> };
export type GapData = Record<string, Record<string, Partial<Record<"u" | "d", Cell>>>>;
export type GapStrings = UIStrings["gap"];
export type GapText = YearText & { thousands: string };

export const EDGES = [0, 5, 10, 15, 20, 30, 50, 100];
export const THIN = 20;
export const len = (p: string) => (p === "w" ? 5 * 81 : 81);

export function years(data: GapData): number[] {
  return Object.keys(data.w).map(Number).sort((a, b) => a - b);
}

export function pool(data: GapData, p: string, dir: string, y0: number, y1: number) {
  const k = EDGES.length;
  const n = Array(k).fill(0);
  const f = Array(k).fill(0);
  const c = Array(k).fill(0);
  const t = Array(len(p)).fill(0);
  for (const [y, row] of Object.entries(data[p])) {
    if (+y < y0 || +y > y1) continue;
    for (const d of dir === "all" ? ["u", "d"] : [dir]) {
      const cell = row[d as "u" | "d"];
      if (!cell) continue;
      for (let i = 0; i < k; i++) {
        n[i] += cell.n[i];
        f[i] += cell.f[i];
        c[i] += cell.c[i];
      }
      for (const [b, v] of Object.entries(cell.t)) t[+b] += v;
    }
  }
  const total = n.reduce((a, b) => a + b, 0);
  // cum[k]：到第 k 根 K 线收线为止（前 k 根里）已经碰回的缺口数
  const cum = [0];
  for (const v of t) cum.push(cum[cum.length - 1] + v);
  return { n, f, c, total, closed: c.reduce((a, b) => a + b, 0), first: f.reduce((a, b) => a + b, 0), cum };
}
export type Pool = ReturnType<typeof pool>;

export const bucketLabel = (i: number, unit = "%") =>
  i === EDGES.length - 1 ? `${EDGES[i]}${unit}+` : `${EDGES[i]}–${EDGES[i + 1]}${unit}`;

// —— 按缺口大小的柱状图 ——
export const SB: Omit<Box, "w"> = { h: 240, l: 40, r: 12, t: 22, b: 26 };
export const band = (w: number) => (w - SB.l - SB.r) / EDGES.length;

function sizeChart(st: Pool, s: GapStrings, w: number) {
  const box = { ...SB, w };
  const y = (v: number) => box.h - box.b - (v / 100) * (box.h - box.t - box.b);
  const bw = band(w);
  const pad = Math.max(3, bw * 0.16);
  const bars = st.n
    .map((n, i) => {
      const x = box.l + i * bw + pad;
      const all = share(st.c[i], n) || 0;
      const fst = share(st.f[i], n) || 0;
      return `<g class="gx-col${n < THIN ? " is-thin" : ""}" data-i="${i}">
        <rect class="gx-later" x="${x}" y="${y(all)}" width="${bw - 2 * pad}" height="${y(0) - y(all)}" rx="2"/>
        <rect class="gx-first" x="${x}" y="${y(fst)}" width="${bw - 2 * pad}" height="${y(0) - y(fst)}" rx="2"/>
        <text class="gx-val" x="${x + bw / 2 - pad}" y="${y(all) - 6}" text-anchor="middle">${n ? Math.round(all) + "%" : ""}</text>
      </g>`;
    })
    .join("");
  // 宽屏每一档写范围（10–15%）；窄屏写不下，改成在分界处标数字
  const labels = xLabels(
    box,
    w >= 520
      ? EDGES.map((_, i) => [box.l + (i + 0.5) * bw, bucketLabel(i)])
      : EDGES.map((e, i) => [box.l + i * bw, i ? String(e) : "0%"])
  );
  return `<svg class="gx-size" viewBox="0 0 ${w} ${box.h}" width="100%" height="${box.h}" role="img" aria-label="${s.sizeTitle}">
    ${yAxis(box, [0, 25, 50, 75, 100], y, v => v + "%")}${bars}${labels}
  </svg>`;
}

// —— 从开盘起多久碰回：累计曲线 ——
export const TB: Omit<Box, "w"> = { h: 220, l: 40, r: 12, t: 14, b: 26 };
export const tx = (k: number, p: string, w: number) => TB.l + (k / len(p)) * (w - TB.l - TB.r);
export const ty = (v: number) => TB.h - TB.b - (v / 100) * (TB.h - TB.t - TB.b);

// 第 k 根收线的时间：周线写“第 2 天 10:30”，日线只写“10:30”
export function timeOf(s: GapStrings, p: string, k: number) {
  const j = k - 1;
  return p === "w" ? `${tplStr(s.dayN, { n: Math.floor(j / 81) + 1 })} ${barEnd(j % 81)}` : barEnd(j);
}

function timeChart(st: Pool, s: GapStrings, p: string, w: number) {
  const box = { ...TB, w };
  let days = "";
  let labels: [number, string][];
  if (p === "w") {
    for (let d = 1; d < 5; d++) days += `<line class="fn-grid" x1="${tx(d * 81, p, w)}" x2="${tx(d * 81, p, w)}" y1="${box.t}" y2="${box.h - box.b}"/>`;
    labels = [0, 1, 2, 3, 4].map(d => [tx(d * 81 + 40.5, p, w), tplStr(s.dayN, { n: d + 1 })]);
  } else {
    labels = [6, 18, 30, 42, 54, 66, 78].filter((_, i) => w >= 480 || i % 2 === 0).map(n => [tx(n, p, w), barEnd(n - 1)]);
  }
  // 第一个小时 / 第一天的分界
  const cut = p === "w" ? 81 : 12;
  const ref = `<line class="fn-ref" x1="${tx(cut, p, w)}" x2="${tx(cut, p, w)}" y1="${box.t}" y2="${box.h - box.b}"/>`;
  const path = st.cum
    .map((v, k) => `${k ? "L" : "M"}${tx(k, p, w).toFixed(1)},${ty(share(v, st.total) || 0).toFixed(1)}`)
    .join("");
  const end = share(st.closed, st.total) || 0;
  return `<svg class="gx-time" viewBox="0 0 ${w} ${box.h}" width="100%" height="${box.h}" role="img" aria-label="${s.timeTitle}">
    ${yAxis(box, [0, 25, 50, 75, 100], ty, v => v + "%")}${days}${ref}${xLabels(box, labels)}
    <path class="gx-line" d="${path}"/>
    <text class="gx-end" x="${w - box.r}" y="${ty(end) - 7}" text-anchor="end">${pc1(end)}</text>
    <line class="fn-rule" y1="${box.t}" y2="${box.h - box.b}"/><circle class="fn-dot gx-dot" r="4"/>
  </svg>`;
}

export function renderGap(data: GapData, s: GapStrings, c: GapText, range: string, p: string, dir: string, y0: number, y1: number, w: number) {
  const st = pool(data, p, dir, y0, y1);
  const W = p === "w";
  return `
    <div class="bx-hero">
      <p class="bx-hero-k">${tplStr(W ? s.heroW : s.heroD, { range })}</p>
      <p class="bx-hero-v">${pc1(share(st.closed, st.total))}</p>
      <p class="bx-hero-n">${tplStr(W ? s.subW : s.subD, { n: groupNum(st.total, c.thousands), f: pc1(share(st.first, st.total)) })}</p>
    </div>
    <p class="bx-sub">${s.sizeTitle}<span>${W ? s.sizeHintW : s.sizeHintD}</span></p>
    <div class="fn-legend">
      <span><i class="gx-key-first"></i>${W ? s.firstW : s.firstD}</span>
      <span><i class="gx-key-later"></i>${W ? s.laterW : s.laterD}</span>
    </div>
    <div class="fn-chart gx-size-box">${sizeChart(st, s, w)}<div class="fn-tip" hidden></div></div>
    <p class="bx-sub">${s.timeTitle}<span>${W ? s.timeHintW : s.timeHintD}</span></p>
    <div class="fn-chart gx-time-box">${timeChart(st, s, p, w)}<div class="fn-tip" hidden></div></div>
    <p class="fn-note">${s.note}</p>`;
}
