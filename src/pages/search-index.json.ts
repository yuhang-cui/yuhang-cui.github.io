import { buildSearchIndex } from "@/utils/searchIndex";

export async function GET() {
  return new Response(JSON.stringify(await buildSearchIndex("zh")), {
    headers: { "Content-Type": "application/json" },
  });
}
