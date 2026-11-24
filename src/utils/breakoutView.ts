// 突破统计的可交互画面：构建时生成默认画面，浏览器里切换参照线 / 年份时用同一个函数重新生成。
// 数据只有每年四种结果的天数（src/data/breakout-by-year.json，由 ES-breakout-dashboard/突破统计.py 生成；
// 黄金和 ES 全天的在 src/data/breakout-gold.json，由 量化/code/黄金昨日高低点.py 生成）。
// 界面文字从 src/i18n/lang/*.ts 的 breakout 部分传进来，所以中英文共用这一个函数。
import type { UIStrings } from "@/i18n/types";
import { tplStr } from "@/i18n/format";

export type Cls = "up" | "down" | "both" | "none";
// prev / globex：ES 日盘对昨日日盘、对夜盘。gcDay / gcNy：黄金全天、黄金只看纽约时段。esFull：ES 也按全天算，只用来和黄金对比
export type Ref = "prev" | "globex" | "gcDay" | "gcNy" | "esFull";
export type ByYear = Partial<Record<Ref, Record<string, Record<Cls, number>>>>;
// 黄金全天口径：第一次突破出在亚盘 / 欧盘 / 美盘的天数
export type Sess = "asia" | "eu" | "us";
export type FirstByYear = Record<string, Record<Sess, number>>;
export type BreakoutOpt = { cmp?: Ref[]; first?: FirstByYear };
export type BreakoutStrings = UIStrings["breakout"];

export const CLS: Cls[] = ["up", "down", "both", "none"];
const SESS: Sess[] = ["asia", "eu", "us"];

const pct = (n: number, total: number) => (total ? (100 * n) / total : 0);
const fmt = (v: number) => v.toFixed(1) + "%";
// 天数的千位分隔：英文 3,924，中文不加（分隔符来自界面文字 breakout.thousands）
export const groupNum = (n: number, sep: string) => String(n).replace(/\B(?=(\d{3})+$)/g, sep);

export function years(data: ByYear, ref: Ref): number[] {
  return Object.keys(data[ref]!).map(Number).sort((a, b) => a - b);
}

function sum(data: ByYear, ref: Ref, y0: number, y1: number) {
  const out: Record<Cls, number> = { up: 0, down: 0, both: 0, none: 0 };
  for (const [y, c] of Object.entries(data[ref]!)) {
    if (+y < y0 || +y > y1) continue;
    for (const k of CLS) out[k] += c[k];
  }
  const total = CLS.reduce((s, k) => s + out[k], 0);
  return { counts: out, total };
}

function bar(s: BreakoutStrings, counts: Record<Cls, number>, total: number, label: string) {
  const segs = CLS.map(k =>
    counts[k] > 0
      ? `<span class="bx-seg bx-${k}" style="flex:${counts[k]}" title="${s[k]} ${fmt(pct(counts[k], total))} (${tplStr(s.days, { n: groupNum(counts[k], s.thousands) })})"></span>`
      : ""
  ).join("");
  return `<div class="bx-bar" role="img" aria-label="${label}">${segs}</div>`;
}

// 大标题里的参照线名字。黄金的两个按钮（全天 / 只看纽约时段）太短，放进句子里要换成完整的说法
const heroName = (s: BreakoutStrings, ref: Ref) =>
  ref === "gcDay" ? s.gcDayHero : ref === "gcNy" ? s.gcNyHero : ref === "esFull" ? s.esFullCmp : s[ref];
// 对比行的名字。黄金卡片里四行分属两个品种，要带上品种名
const cmpName = (s: BreakoutStrings, ref: Ref, gold: boolean) =>
  ref === "esFull" ? s.esFullCmp : !gold ? s[ref] : ref === "gcDay" ? s.gcDayCmp : ref === "gcNy" ? s.gcNyCmp : s.prevCmp;

export function renderBreakout(
  data: ByYear,
  s: BreakoutStrings,
  ref: Ref,
  y0: number,
  y1: number,
  opt: BreakoutOpt = {}
): string {
  const cmp = opt.cmp ?? (["prev", "globex"] as Ref[]);
  const gold = cmp.includes("gcDay");
  const { counts, total } = sum(data, ref, y0, y1);
  const any = pct(total - counts.none, total);
  const range = y0 === y1 ? tplStr(s.singleYear, { a: y0 }) : tplStr(s.yearRange, { a: y0, b: y1 });

  // 单看一边：高点被突破 = 只破上 + 两边都破，低点同理
  const sides = (["hi", "lo"] as const)
    .map(
      k => `<div class="bx-side">
      <p class="bx-side-k">${s[k]}</p>
      <p class="bx-side-v">${fmt(pct(counts[k === "hi" ? "up" : "down"] + counts.both, total))}</p>
      <p class="bx-tile-n">${k === "hi" ? s.hiNote : s.loNote}</p>
    </div>`
    )
    .join("");

  const tiles = CLS.map(
    k => `<div class="bx-tile">
      <p class="bx-tile-k"><i class="bx-${k}"></i>${s[k]}</p>
      <p class="bx-tile-v">${fmt(pct(counts[k], total))}</p>
      <p class="bx-tile-n">${tplStr(s.days, { n: groupNum(counts[k], s.thousands) })}</p>
    </div>`
  ).join("");

  const rows = years(data, ref)
    .map(y => {
      const c = data[ref]![String(y)];
      const t = CLS.reduce((n, k) => n + c[k], 0);
      const on = y >= y0 && y <= y1;
      return `<button type="button" class="bx-year${on ? "" : " is-off"}" data-year="${y}" aria-label="${tplStr(s.onlyYear, { y })}">
        <span class="bx-year-y">${y}</span>
        ${bar(s, c, t, tplStr(s.share, { what: String(y) }))}
        <span class="bx-year-v">${fmt(pct(t - c.none, t))}</span>
      </button>`;
    })
    .join("");

  const compare = cmp
    .map(r => {
      const sm = sum(data, r, y0, y1);
      const name = cmpName(s, r, gold);
      return `<div class="bx-cmp${r === ref ? " is-current" : ""}">
        <span class="bx-cmp-name">${name}</span>
        ${bar(s, sm.counts, sm.total, tplStr(s.share, { what: name }))}
        <span class="bx-year-v">${fmt(pct(sm.total - sm.counts.none, sm.total))}</span>
      </div>`;
    })
    .join("");

  // 黄金全天口径多一块：第一次突破出在亚盘、欧盘还是美盘（只算破了至少一侧的日子）
  let first = "";
  if (opt.first && ref === "gcDay") {
    const n: Record<Sess, number> = { asia: 0, eu: 0, us: 0 };
    for (const [y, c] of Object.entries(opt.first)) {
      if (+y < y0 || +y > y1) continue;
      for (const k of SESS) n[k] += c[k];
    }
    const t = SESS.reduce((a, k) => a + n[k], 0);
    const segs = SESS.map(k =>
      n[k] > 0 ? `<span class="bx-seg bx-${k}" style="flex:${n[k]}" title="${s[k]} ${fmt(pct(n[k], t))}"></span>` : ""
    ).join("");
    const ftiles = SESS.map(
      k => `<div class="bx-tile">
        <p class="bx-tile-k"><i class="bx-${k}"></i>${s[k]}<span>${s[`${k}T`]}</span></p>
        <p class="bx-tile-v">${fmt(pct(n[k], t))}</p>
        <p class="bx-tile-n">${tplStr(s.days, { n: groupNum(n[k], s.thousands) })}</p>
      </div>`
    ).join("");
    first = `
    <p class="bx-sub">${s.first}<span>${s.firstHint}</span></p>
    <div class="bx-bar bx-firstbar" role="img" aria-label="${s.first}">${segs}</div>
    <div class="bx-tiles bx-tiles-3">${ftiles}</div>`;
  }

  return `
    <div class="bx-top">
      <div class="bx-hero">
        <p class="bx-hero-k">${tplStr(s.heroLabel, { range, ref: heroName(s, ref) })}</p>
        <p class="bx-hero-v">${fmt(any)}</p>
        <p class="bx-hero-n">${tplStr(s.sample, { n: groupNum(total, s.thousands) })}</p>
      </div>
      <div class="bx-sides">${sides}</div>
    </div>
    ${bar(s, counts, total, tplStr(s.share, { what: range }))}
    <div class="bx-tiles">${tiles}</div>
${first}
    <p class="bx-sub">${s.byYear}<span>${s.byYearHint}</span></p>
    <div class="bx-years">${rows}</div>

    <p class="bx-sub">${gold ? s.compareGold : s.compare}<span>${range}</span></p>
    <div class="bx-cmps${gold ? " bx-cmps-gold" : ""}">${compare}</div>`;
}
