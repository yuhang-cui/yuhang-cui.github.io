// 文章页和分类页的路径生成，中文页面和英文页面（src/pages/en/…）共用。
import type { PaginateFunction } from "astro";
import { getPostSlug } from "./getPostPaths";
import { getSortedPosts } from "./getSortedPosts";
import { slugifyAll } from "./slugify";
import { CATEGORIES } from "./categories";
import { getPostsByLocale, type Locale } from "./localePosts";
import config from "@/config";

export async function postStaticPaths(locale: Locale) {
  const posts = await getPostsByLocale(locale);
  const sortedPosts = getSortedPosts(posts);
  const adjacent = (i: number) =>
    i >= 0 && i < sortedPosts.length
      ? {
          id: sortedPosts[i].id,
          title: sortedPosts[i].data.title,
          filePath: sortedPosts[i].filePath,
        }
      : null;

  // sortedPosts 按时间从新到旧，所以“上一篇”（更旧）是更大的下标
  return sortedPosts.map((post, index) => ({
    params: { slug: getPostSlug(post.id, post.filePath) },
    props: { post, prevPost: adjacent(index + 1), nextPost: adjacent(index - 1) },
  }));
}

// 6 个分类都生成页面，没有文章的分类也能点进来
export async function categoryStaticPaths(locale: Locale, paginate: PaginateFunction) {
  const posts = await getPostsByLocale(locale);
  return CATEGORIES.flatMap(category => {
    const tagPosts = getSortedPosts(
      posts.filter(({ data }) => slugifyAll(data.tags).includes(category.slug))
    );
    return paginate(tagPosts, {
      params: { tag: category.slug },
      props: { category },
      pageSize: config.posts.perPage,
    });
  });
}
