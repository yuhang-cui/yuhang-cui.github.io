// 按语言取文章：中文页面只列中文文章，英文页面（/en/…）只列英文文章。
import { getCollection, type CollectionEntry } from "astro:content";

export type Locale = "zh" | "en";

export function toLocale(locale: string | undefined): Locale {
  return locale === "en" ? "en" : "zh";
}

export async function getPostsByLocale(
  locale: string | undefined
): Promise<CollectionEntry<"posts">[]> {
  const lang = toLocale(locale);
  return getCollection("posts", ({ data }) => data.lang === lang);
}

/** 中文网址和英文网址互相对应：/posts/x ↔ /en/posts/x */
export function switchLocalePath(pathname: string, to: Locale): string {
  const zhPath = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  if (to === "zh") return zhPath;
  return zhPath === "/" ? "/en/" : `/en${zhPath}`;
}
