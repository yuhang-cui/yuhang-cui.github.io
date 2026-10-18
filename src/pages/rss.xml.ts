import rss from "@astrojs/rss";
import { getSortedPosts } from "@/utils/getSortedPosts";
import { getPostUrl } from "@/utils/getPostPaths";
import { getPostsByLocale, type Locale } from "@/utils/localePosts";
import { useTranslations } from "@/i18n";
import config from "@/config";

// 中文 RSS 在 /rss.xml，英文在 /en/rss.xml（src/pages/en/rss.xml.ts）
export async function buildRss(locale: Locale) {
  const t = useTranslations(locale);
  const sortedPosts = getSortedPosts(await getPostsByLocale(locale));

  return rss({
    title: t.site.title,
    description: t.site.description,
    site: config.site.url,
    items: sortedPosts.map(({ data, id, filePath }) => ({
      link: getPostUrl(id, filePath, locale),
      title: data.title,
      description: data.description,
      pubDate: new Date(data.modDatetime ?? data.pubDatetime),
    })),
  });
}

export function GET() {
  return buildRss("zh");
}
