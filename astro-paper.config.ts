import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://yuhang-cui.github.io/",
    title: "兰森 · PA Research",           // 示例：网站名称
    description: "用数据检验 Price Action 交易中的常见说法。",
    author: "兰森",
    profile: "https://yuhang-cui.github.io/about/",
    ogImage: "default-og.jpg",
    lang: "zh",
    timezone: "America/New_York",
    dir: "ltr",
  },
  posts: {
    perPage: 8,
    perIndex: 6,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: false,
    dynamicOgImage: false,
    showArchives: false,
    showBackButton: true,
    editPost: { enabled: false },
    search: "pagefind",
  },
  socials: [
    { name: "github", url: "https://github.com/yuhang-cui" },
  ],
  shareLinks: [
    { name: "x",    url: "https://x.com/intent/post?url=" },
    { name: "mail", url: "mailto:?subject=See%20this%20post&body=" },
  ],
});
