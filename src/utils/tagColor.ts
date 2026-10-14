// 标签颜色：data 固定灰色，常用分类固定颜色，其他标签按名字自动分配一种彩色。
// 不用绿色和红色，因为它们留给“多头 / 空头”。
const FIXED: Record<string, string> = {
  data: "tag-gray",
  research: "tag-blue",
  learning: "tag-purple",
  thinking: "tag-amber",
};

const PALETTE = ["tag-teal", "tag-pink", "tag-indigo", "tag-orange"];

export function tagColorClass(tag: string): string {
  const key = tag.toLowerCase();
  if (FIXED[key]) return FIXED[key];
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
