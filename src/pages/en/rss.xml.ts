import { buildRss } from "../rss.xml";

export function GET() {
  return buildRss("en");
}
