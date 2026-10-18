// 突破统计的可交互画面：构建时生成默认画面，浏览器里切换参照线 / 年份时用同一个函数重新生成。
// 数据只有每年四种结果的天数（src/data/breakout-by-year.json，由 ES-breakout-dashboard/突破统计.py 生成）。
// 界面文字从 src/i18n/lang/*.ts 的 breakout 部分传进来，所以中英文共用这一个函数。
import type { UIStrings } from "@/i18n/types";
import { tplStr } from "@/i18n/format";

export type Cls = "up" | "down" | "both" | "none";
export type Ref = "prev" | "globex";
export type ByYear = Record<Ref, Record<string, Record<Cls, number>>>;
export type BreakoutStrings = UIStrings["breakout"];

export const CLS: Cls[] = ["up", "down", "both", "none"];

const pct = (n: number, total: number) => (total ? (100 * n) / total : 0);
const fmt = (v: number) => v.toFixed(1) + "%";

export function years(data: ByYear, ref: Ref): number[] {
  return Object.keys(data[ref]).map(Number).sort((a, b) => a - b);
}

function sum(data: ByYear, ref: Ref, y0: number, y1: number) {
  const out: Record<Cls, number> = { up: 0, down: 0, both: 0, none: 0 };
  for (const [y, c] of Object.entries(data[ref])) {
    if (+y < y0 || +y > y1) continue;
    for (const k of CLS) out[k] += c[k];
  }
  const total = CLS.reduce((s, k) => s + out[k], 0);
  return { counts: out, total };
}

function bar(s: BreakoutStrings, counts: Record<Cls, number>, total: number, label: string) {
  const segs = CLS.map(k =>
    counts[k] > 0
      ? `<span class="bx-seg bx-${k}" style="flex:${counts[k]}" title="${s[k]} ${fmt(pct(counts[k], total))} (${tplStr(s.days, { n: counts[k] })})"></span>`
      : ""
  ).join("");
  return `<div class="bx-bar" role="img" aria-label="${label}">${segs}</div>`;
}

export function renderBreakout(
  data: ByYear,
  s: BreakoutStrings,
  ref: Ref,
  y0: number,
  y1: number
): string {
  const { counts, total } = sum(data, ref, y0, y1);
  const any = pct(total - counts.none, total);
  const range = y0 === y1 ? tplStr(s.singleYear, { a: y0 }) : tplStr(s.yearRange, { a: y0, b: y1 });

  const tiles = CLS.map(
    k => `<div class="bx-tile">
      <p class="bx-tile-k"><i class="bx-${k}"></i>${s[k]}</p>
      <p class="bx-tile-v">${fmt(pct(counts[k], total))}</p>
      <p class="bx-tile-n">${tplStr(s.days, { n: counts[k] })}</p>
    </div>`
  ).join("");

  const rows = years(data, ref)
    .map(y => {
      const c = data[ref][String(y)];
      const t = CLS.reduce((n, k) => n + c[k], 0);
      const on = y >= y0 && y <= y1;
      return `<button type="button" class="bx-year${on ? "" : " is-off"}" data-year="${y}" aria-label="${tplStr(s.onlyYear, { y })}">
        <span class="bx-year-y">${y}</span>
        ${bar(s, c, t, tplStr(s.share, { what: String(y) }))}
        <span class="bx-year-v">${fmt(pct(t - c.none, t))}</span>
      </button>`;
    })
    .join("");

  const compare = (["prev", "globex"] as Ref[])
    .map(r => {
      const sm = sum(data, r, y0, y1);
      return `<div class="bx-cmp${r === ref ? " is-current" : ""}">
        <span class="bx-cmp-name">${s[r]}</span>
        ${bar(s, sm.counts, sm.total, tplStr(s.share, { what: s[r] }))}
        <span class="bx-year-v">${fmt(pct(sm.total - sm.counts.none, sm.total))}</span>
      </div>`;
    })
    .join("");

  return `
    <div class="bx-hero">
      <p class="bx-hero-k">${tplStr(s.heroLabel, { range, ref: s[ref] })}</p>
      <p class="bx-hero-v">${fmt(any)}</p>
      <p class="bx-hero-n">${tplStr(s.sample, { n: total })}</p>
    </div>
    ${bar(s, counts, total, tplStr(s.share, { what: range }))}
    <div class="bx-tiles">${tiles}</div>

    <p class="bx-sub">${s.byYear}<span>${s.byYearHint}</span></p>
    <div class="bx-years">${rows}</div>

    <p class="bx-sub">${s.compare}<span>${range}</span></p>
    <div class="bx-cmps">${compare}</div>`;
}
