// 几张可交互图共用的小工具（缺口回补、20 均线、连续阳阴线、开盘即最高最低、开盘连续同色、昨日等距目标）。
// 上半部分是构建时和浏览器里都用的画图小函数；mount() 只在浏览器里用：把年份选择、开关按钮、下拉框和改宽度接到重画上。
import { tplStr } from "@/i18n/format";

export const pc1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) + "%" : "–");
export const share = (a: number, n: number) => (n ? (100 * a) / n : NaN);

export type Box = { w: number; h: number; l: number; r: number; t: number; b: number };
export type YearText = { yearRange: string; singleYear: string };

// 横向网格线 + 左边的刻度文字；第一个刻度画成坐标轴
export function yAxis(box: Box, ticks: number[], y: (v: number) => number, label: (v: number) => string) {
  return ticks
    .map(
      (v, i) => `<line class="${i ? "fn-grid" : "fn-axis"}" x1="${box.l}" x2="${box.w - box.r}" y1="${y(v)}" y2="${y(v)}"/>
      <text x="${box.l - 8}" y="${y(v)}" dy=".32em" text-anchor="end">${label(v)}</text>`
    )
    .join("");
}

// 横轴下面的文字
export function xLabels(box: Box, items: [number, string][]) {
  return items.map(([x, t]) => `<text x="${x}" y="${box.h - 8}" text-anchor="middle">${t}</text>`).join("");
}

export function rangeLabel(c: YearText, a: number, b: number) {
  return a === b ? tplStr(c.singleYear, { a }) : tplStr(c.yearRange, { a, b });
}

// 第 k 根 5 分钟 K 线（从 0 起）收线的时间，比如第 0 根是 9:35
export function barEnd(k: number) {
  const m = 9 * 60 + 30 + 5 * (k + 1);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

// —— 以下只在浏览器里用 ——

// 指针的横坐标，换算成 viewBox 里的单位
export function svgX(svg: SVGSVGElement, w: number, e: PointerEvent) {
  const r = svg.getBoundingClientRect();
  return ((e.clientX - r.left) / r.width) * w;
}

// 提示框放在指针旁边，靠右时翻到左边
export function placeTip(tip: HTMLElement, svg: SVGSVGElement, x: number, w: number, e: PointerEvent) {
  const r = svg.getBoundingClientRect();
  tip.hidden = false;
  const px = (x / w) * r.width;
  const tw = tip.offsetWidth;
  tip.style.left = `${px + 14 + tw > r.width ? px - 14 - tw : px + 14}px`;
  tip.style.top = `${Math.max(0, e.clientY - r.top - tip.offsetHeight / 2)}px`;
}

// 鼠标移动 / 手指点按时调用 show（返回 false 表示指针不在数据范围里，当作离开）
export function bindHover(box: HTMLElement, show: (e: PointerEvent) => boolean | void, hide: () => void) {
  const svg = box.querySelector("svg")!;
  const on = (e: PointerEvent) => {
    if (show(e) === false) hide();
  };
  svg.addEventListener("pointermove", on);
  svg.addEventListener("pointerdown", on);
  svg.addEventListener("pointerleave", hide);
}

export type State = { y0: number; y1: number; opt: Record<string, string> };

// 读年份下拉框（.bx-y0 / .bx-y1）、开关按钮（.bx-switch[data-k] 里的 button[data-v]）和下拉框（select[data-k]），
// 任何一个变了就重画；宽度变了也按新宽度重画。返回 setYears，给“点某一年只看这一年”用。
export function mount(root: HTMLElement, view: HTMLElement, draw: (st: State, w: number) => void) {
  const s0 = root.querySelector<HTMLSelectElement>(".bx-y0");
  const s1 = root.querySelector<HTMLSelectElement>(".bx-y1");
  const first = root.dataset.y0 ?? "";
  const last = root.dataset.y1 ?? "";
  const opt: Record<string, string> = {};
  root.querySelectorAll<HTMLElement>(".bx-switch[data-k]").forEach(g => {
    opt[g.dataset.k!] = g.querySelector<HTMLButtonElement>("button[aria-pressed=true]")!.dataset.v!;
  });
  root.querySelectorAll<HTMLSelectElement>("select[data-k]").forEach(sel => (opt[sel.dataset.k!] = sel.value));

  const redraw = () => {
    let a = s0 ? +s0.value : 0;
    let b = s1 ? +s1.value : 0;
    if (a > b) [a, b] = [b, a];
    draw({ y0: a, y1: b, opt: { ...opt } }, Math.round(view.clientWidth || 640));
  };

  root.querySelectorAll<HTMLElement>(".bx-switch[data-k]").forEach(g =>
    g.addEventListener("click", e => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-v]");
      if (!btn || btn.getAttribute("aria-pressed") === "true") return;
      g.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === btn)));
      opt[g.dataset.k!] = btn.dataset.v!;
      redraw();
    })
  );
  root.querySelectorAll<HTMLSelectElement>("select[data-k]").forEach(sel =>
    sel.addEventListener("change", () => {
      opt[sel.dataset.k!] = sel.value;
      redraw();
    })
  );
  s0?.addEventListener("change", redraw);
  s1?.addEventListener("change", redraw);
  root.querySelector(".bx-reset")?.addEventListener("click", () => {
    s0!.value = first;
    s1!.value = last;
    redraw();
  });

  // 第一次加载时也画一遍，把鼠标悬停接上；之后宽度变了才重画
  redraw();
  let lastW = view.clientWidth;
  new ResizeObserver(() => {
    const w = Math.round(view.clientWidth);
    if (w && w !== lastW) {
      lastW = w;
      redraw();
    }
  }).observe(view);

  return (y: number) => {
    s0!.value = s1!.value = String(y);
    redraw();
  };
}
