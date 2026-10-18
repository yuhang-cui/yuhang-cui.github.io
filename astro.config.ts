import {
  defineConfig,
  envField,
  fontProviders,
  svgoOptimizer,
} from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import rehypeCallouts from "rehype-callouts";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import config from "./astro-paper.config";

export default defineConfig({
  site: config.site.url,
  outDir: "./dist.nosync", // 以 .nosync 结尾，iCloud 不会同步构建产物
  devToolbar: { enabled: false }, // 关闭本地预览时底部的 Astro 开发工具栏
  // 文章列表页已删除（首页就是全部文章），旧链接跳回首页
  redirects: { "/posts": "/", "/en/posts": "/en/" },
  integrations: [
    mdx(),
    sitemap({
      filter: page =>
        config.features?.showArchives !== false || !page.endsWith("/archives/"),
    }),
  ],
  i18n: {
    locales: ["zh", "en"],
    defaultLocale: "zh",
    routing: {
      prefixDefaultLocale: false,
    },
  },
  markdown: {
    processor: unified({
      remarkPlugins: [
        remarkToc,
        [remarkCollapse, { test: "Table of contents" }],
      ],
      rehypePlugins: [rehypeCallouts],
    }),
    shikiConfig: {
      themes: { light: "min-light", dark: "night-owl" },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerFileName({ style: "v2", hideDot: false }),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationDiff({ matchAlgorithm: "v3" }),
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  fonts: [
    {
      name: "Inter",
      cssVariable: "--font-inter",
      provider: fontProviders.google(),
      fallbacks: [],
      weights: [400, 500, 600],
      styles: ["normal"],
      subsets: ["latin"],
    },
    {
      name: "Noto Sans SC",
      cssVariable: "--font-noto-sc",
      provider: fontProviders.google(),
      fallbacks: [],
      weights: [400, 500],
      styles: ["normal"],
      subsets: ["chinese-simplified"],
    },
    {
      name: "JetBrains Mono",
      cssVariable: "--font-jetbrains",
      provider: fontProviders.google(),
      fallbacks: [],
      weights: [400],
      styles: ["normal"],
      subsets: ["latin"],
    },
  ],
  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
    },
  },
  experimental: {
    svgOptimizer: svgoOptimizer(),
  },
});
