// 网站固定的 6 个分类。文章 frontmatter 的 tags 里写 name（如 "Research"）。
// 每个分类的中英文说明在 src/i18n/lang/zh.ts、en.ts 的 categories.desc 里。
// 颜色仿 Notion 的浅底色；不用绿色和红色，因为它们留给“多头 / 空头”。
// 以后要加新分类，在这里加一行，再在两个语言文件里各加一句说明。
export type Category = {
  slug: string;
  name: string;
  color: "blue" | "purple" | "orange" | "yellow" | "teal" | "pink";
};

export const CATEGORIES: Category[] = [
  { slug: "research", name: "Research", color: "blue" },
  { slug: "market-cycle", name: "Market Cycle", color: "purple" },
  { slug: "strategies", name: "Strategies", color: "orange" },
  { slug: "practice", name: "Practice", color: "yellow" },
  { slug: "tools", name: "Tools", color: "teal" },
  { slug: "thinking", name: "Thinking", color: "pink" },
];

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find(c => c.slug === slug);
}

export function categoryColorClass(slug: string): string {
  return `cat-${getCategory(slug)?.color ?? "gray"}`;
}
