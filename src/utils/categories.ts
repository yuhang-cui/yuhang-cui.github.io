// 网站固定的 6 个分类。文章 frontmatter 的 tags 里写 name（如 "Research"）。
// 颜色仿 Notion 的浅底色；不用绿色和红色，因为它们留给“多头 / 空头”。
// 以后要加新分类，在这里加一行即可。
export type Category = {
  slug: string;
  name: string;
  desc: string;
  color: "blue" | "purple" | "orange" | "yellow" | "teal" | "pink";
};

export const CATEGORIES: Category[] = [
  { slug: "research", name: "Research", desc: "用数据检验交易里流传的说法", color: "blue" },
  { slug: "market-cycle", name: "Market Cycle", desc: "趋势、通道、区间：市场此刻处在哪个阶段", color: "purple" },
  { slug: "strategies", name: "Strategies", desc: "把研究结论变成具体的交易规则", color: "orange" },
  { slug: "practice", name: "Practice", desc: "刻意练习、复盘和执行", color: "yellow" },
  { slug: "tools", name: "Tools", desc: "数据、脚本和指标", color: "teal" },
  { slug: "thinking", name: "Thinking", desc: "学习路线，以及对市场和交易的思考", color: "pink" },
];

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find(c => c.slug === slug);
}

export function categoryColorClass(slug: string): string {
  return `cat-${getCategory(slug)?.color ?? "gray"}`;
}
