import type { CollectionEntry } from "astro:content";
import config from "@/config";

/**
 * Determines whether a post is eligible to be listed/rendered.
 *
 * - Excludes drafts always
 * - In production, excludes scheduled posts until `pubDatetime` minus the configured margin
 * - In dev, always shows non-draft posts to make authoring easier
 */
export function postFilter({ data }: CollectionEntry<"posts">) {
  const isPublishTimePassed =
    Date.now() >
    new Date(data.pubDatetime).getTime() - config.posts.scheduledPostMargin;
  // tags 里带 private 的文章不上线：正式构建时不生成，只在本地 dev 里能看到。
  // 这类文章还必须放在 src/content/posts/_private/（不上传到 GitHub），这里只是第二道保险。
  if (import.meta.env.PROD && data.tags.includes("private")) return false;
  return !data.draft && (import.meta.env.DEV || isPublishTimePassed);
}
