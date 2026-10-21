// 夜盘区间宽度和突破：按夜盘宽度分组，每组一根四色横条（只破上 / 只破下 / 两边都破 / 都没破）。构建时生成默认画面，浏览器里换年份时用同一个函数重画。
// 数据只有天数（src/data/eth-width.json，由 ES-breakout-dashboard/夜盘区间宽度.py 生成）：年份 → 宽度分组 → 四种结果的天数。
import type { UIStrings } from "@/i18n/types";
import { tplStr } from "@/i18n/format";
import { groupNum, CLS, type Cls, type BreakoutStrings } from "./breakoutView";
import { pc1, share } from "./chartKit";

type Counts = Record<Cls, number>;
export type WidthData = Record<string, Record<string, Counts>>;
export type WidthStrings = UIStrings["ethWidth"];

export const EDGES = [0, 30, 40, 50, 60, 70, 80, 100, 120]; // 夜盘宽度（% 平均日波幅）

export function years(data: WidthData): number[] {
  return Object.keys(data).map(Number).sort((a, b) => a - b);
}

const zero = (): Counts => ({ up: 0, down: 0, both: 0, none: 0 });
const total = (c: Counts) => CLS.reduce((n, k) => n + c[k], 0);

export function pool(data: WidthData, y0: number, y1: number): Counts[] {
  const out = EDGES.map(zero);
  for (const [y, groups] of Object.entries(data)) {
    if (+y < y0 || +y > y1) continue;
    for (const [i, c] of Object.entries(groups)) for (const k of CLS) out[+i][k] += c[k];
  }
  return out;
}

// 把几组合在一起，比如 0–2 组 = 夜盘宽度不到 50%
export function merge(rows: Counts[], from: number, to: number): Counts {
  const c = zero();
  for (let i = from; i <= to; i++) for (const k of CLS) c[k] += rows[i][k];
  return c;
}

export const groupLabel = (i: number) =>
  i === 0 ? `< ${EDGES[1]}%` : i === EDGES.length - 1 ? `≥ ${EDGES[i]}%` : `${EDGES[i]}–${EDGES[i + 1]}%`;

export function renderWidth(data: WidthData, s: WidthStrings, b: BreakoutStrings, range: string, y0: number, y1: number) {
  const rows = pool(data, y0, y1);
  const narrow = merge(rows, 0, 2);
  const wide = merge(rows, 7, EDGES.length - 1);
  const legend = CLS.map(k => `<span><i class="bx-${k}"></i>${b[k]}</span>`).join("");
  const bars = rows
    .map((c, i) => {
      const n = total(c);
      const segs = CLS.map(k => (c[k] ? `<span class="bx-seg bx-${k}" style="flex:${c[k]}"></span>` : "")).join("");
      return `<div class="wx-row" data-i="${i}">
        <span class="wx-k">${groupLabel(i)}</span>
        <div class="bx-bar">${segs}</div>
        <span class="bx-year-v">${pc1(share(c.both, n))}</span>
      </div>`;
    })
    .join("");
  return `
    <div class="bx-hero">
      <p class="bx-hero-k">${tplStr(s.heroLabel, { range })}</p>
      <p class="bx-hero-v">${pc1(share(narrow.both, total(narrow)))}</p>
      <p class="bx-hero-n">${tplStr(s.heroSub, {
        n: groupNum(total(narrow), b.thousands),
        b: pc1(share(wide.both, total(wide))),
        z: pc1(share(wide.none, total(wide))),
      })}</p>
    </div>
    <p class="bx-sub">${s.title}<span>${s.hint}</span></p>
    <div class="fn-legend">${legend}</div>
    <div class="fn-chart wx-rows">${bars}<div class="fn-tip" hidden></div></div>
    <p class="fn-note">${s.note}</p>`;
}

export function tipHtml(c: Counts, i: number, s: WidthStrings, b: BreakoutStrings) {
  const n = total(c);
  return (
    `<p class="fn-tip-h">${tplStr(s.tipHead, { a: groupLabel(i), n: groupNum(n, b.thousands) })}</p>` +
    CLS.map(k => `<p class="fn-tip-r"><i class="bx-${k}"></i>${b[k]}<b>${pc1(share(c[k], n))}</b></p>`).join("")
  );
}
