import { buildSearchIndex } from "@/utils/searchIndex";

export async function GET() {
  return new Response(JSON.stringify(await buildSearchIndex("en")), {
    headers: { "Content-Type": "application/json" },
  });
}
