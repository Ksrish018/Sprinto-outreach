// Clean before the model (FR-3.2a): strip markup, navigation, footers, cookie banners and scripts,
// drop blocks under 8 words, remove duplicates, cap at about 2,000 tokens.
import * as cheerio from "cheerio";

export const MAX_CHARS = 8000; // about 2,000 tokens
const MIN_WORDS = 8;

export type Link = { href: string; text: string };
export type Cleaned = { title: string; text: string; words: number; links: Link[] };

const DROP = [
  "script", "style", "noscript", "template", "svg", "iframe", "form", "nav", "footer", "header nav",
  "[role=navigation]", "[role=contentinfo]", "[aria-hidden=true]",
  "[id*=cookie i]", "[class*=cookie i]", "[id*=consent i]", "[class*=consent i]", "[class*=gdpr i]",
  "[id*=onetrust i]", "[class*=banner-cookie i]", "[class*=modal i]", "[class*=popup i]",
].join(",");

// Short labels that still carry evidence (prices, plan names, certification badges) are kept
// even when under the 8-word floor.
const KEEP_SHORT = /\b(soc ?2|iso ?27001|hipaa|gdpr|pci|sso|saml|scim|enterprise|pricing|per (user|seat|month)|\$\d|€\d|£\d|series [a-e]|employees|aws|azure|gcp|google cloud)\b/i;

export function cleanHtml(html: string, baseUrl: string): Cleaned {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();

  // Links are collected before nav and footer are dropped: the footer often holds /security and /trust.
  const links: Link[] = [];
  const seen = new Set<string>();
  $("a[href]").each((_, el) => {
    const raw = $(el).attr("href") ?? "";
    if (raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) return;
    try {
      const href = new URL(raw, baseUrl).toString().split("#")[0];
      if (seen.has(href)) return;
      seen.add(href);
      links.push({ href, text: $(el).text().replace(/\s+/g, " ").trim().slice(0, 80) });
    } catch {
      // ignore malformed URLs
    }
  });

  $(DROP).remove();

  const blocks: string[] = [];
  const unique = new Set<string>();
  $("h1,h2,h3,h4,h5,h6,p,li,td,th,blockquote,figcaption,dd,dt,summary,label,span,div").each((_, el) => {
    const node = $(el);
    // Only leaf-ish blocks: skip containers whose text comes from block children.
    if (node.children("p,li,div,h1,h2,h3,h4,h5,h6,ul,ol,table,section").length) return;
    const text = node.text().replace(/\s+/g, " ").trim();
    if (!text) return;
    const words = text.split(" ").length;
    if (words < MIN_WORDS && !KEEP_SHORT.test(text)) return;
    const key = text.toLowerCase();
    if (unique.has(key)) return;
    unique.add(key);
    blocks.push(text);
  });

  let text = blocks.join("\n");
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS).replace(/\s+\S*$/, "");
  return { title, text, words: text ? text.split(/\s+/).length : 0, links };
}

// Plain text from Jina Reader (markdown) gets the same rules.
export function cleanText(md: string): Cleaned {
  const unique = new Set<string>();
  const blocks: string[] = [];
  for (const line of md.split(/\n+/)) {
    const text = line.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#*>`_|]+/g, " ").replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (text.split(" ").length < MIN_WORDS && !KEEP_SHORT.test(text)) continue;
    if (/cookie|consent|accept all/i.test(text) && text.split(" ").length < 40) continue;
    if (unique.has(text.toLowerCase())) continue;
    unique.add(text.toLowerCase());
    blocks.push(text);
  }
  let text = blocks.join("\n");
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS).replace(/\s+\S*$/, "");
  const links = [...md.matchAll(/\[([^\]]*)\]\((https?:[^)\s]+)\)/g)].map((m) => ({ text: m[1].slice(0, 80), href: m[2] }));
  return { title: "", text, words: text ? text.split(/\s+/).length : 0, links };
}

// Normalised comparison so a quote survives whitespace, case and curly-quote differences, never paraphrase.
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function quoteFound(quote: string, sourceText: string): boolean {
  const q = normalise(quote).replace(/^["']|["']$/g, "");
  return q.length >= 8 && normalise(sourceText).includes(q);
}
