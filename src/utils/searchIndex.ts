// 站内搜索的索引：构建时把每篇文章整理成纯文本，浏览器里按原文字面匹配（中文不需要分词）。
// 中文在 /search-index.json，英文在 /en/search-index.json。
import { getPostUrl } from "./getPostPaths";
import { getSortedPosts } from "./getSortedPosts";
import { getPostsByLocale, type Locale } from "./localePosts";
import { categoryColorClass } from "./categories";
import { slugifyStr } from "./slugify";
import dayjs from "dayjs";

export type SearchDoc = {
  title: string;
  url: string;
  date: string;
  category: string;
  categoryClass: string;
  description: string;
  headings: string;
  text: string;
};

// Markdown / MDX 正文 → 纯文本：去掉 import、代码块、HTML 标签、链接网址和格式符号
function toPlainText(body: string): string {
  return body
    .replace(/^import .*$/gm, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<svg[\s\S]*?<\/svg>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#|]/g, " ")
    .replace(/^\s*[-:]+\s*$/gm, " ")
    .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function buildSearchIndex(locale: Locale): Promise<SearchDoc[]> {
  const posts = getSortedPosts(await getPostsByLocale(locale));
  return posts.map(post => {
    const body = post.body ?? "";
    const headings = [...body.matchAll(/^#{2,4}\s+(.+)$/gm)].map(m => m[1].trim()).join(" · ");
    const category = post.data.tags[0] ?? "";
    return {
      title: post.data.title,
      url: getPostUrl(post.id, post.filePath, locale),
      date: dayjs(post.data.pubDatetime).format("YYYY-MM-DD"),
      category,
      categoryClass: category ? categoryColorClass(slugifyStr(category)) : "",
      description: post.data.description,
      headings,
      text: toPlainText(body),
    };
  });
}
