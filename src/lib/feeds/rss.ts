// Minimal RSS 2.0 / Atom reader: title, link, date and a short summary per item. No dependencies.

export type FeedItem = { title: string; link: string; published: string | null; summary: string };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function strip(html: string): string {
  return decode(decode(html).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : null;
}

export function parseFeed(xml: string): FeedItem[] {
  const out: FeedItem[] = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  for (const b of blocks) {
    const title = strip(tag(b, "title") ?? "");
    let link = decode(tag(b, "link") ?? "").trim();
    if (!link) link = b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? "";
    const date = tag(b, "pubDate") ?? tag(b, "published") ?? tag(b, "updated") ?? tag(b, "dc:date");
    const t = date ? Date.parse(decode(date).trim()) : NaN;
    const summary = strip(tag(b, "description") ?? tag(b, "summary") ?? "").slice(0, 400);
    if (title && /^https?:\/\//.test(link)) out.push({ title, link, published: Number.isNaN(t) ? null : new Date(t).toISOString(), summary });
  }
  return out;
}

// Google News appends " - Source" to titles; that is not part of the headline.
export function cleanTitle(title: string): string {
  return title.replace(/\s+[-–|]\s+[^-–|]{2,60}$/, "").trim();
}
