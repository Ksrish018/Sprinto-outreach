// Funding headline -> company, round, sector, website. One AI call per batch of headlines, no web search.
import type { Gemini } from "../gemini";
import { normaliseDomain } from "../research/domains";

export type Headline = { i: number; title: string; summary: string; feed: string; link: string; published: string | null };

export type ExtractedLead = {
  i: number;
  company: string;
  domain: string | null;
  round: string;
  amount: string;
  sector: string;
  saas: "yes" | "no" | "unsure";
};

export const BATCH = 25;

const SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      i: { type: "integer" },
      company: { type: "string" },
      domain: { type: "string" },
      round: { type: "string", enum: ["Pre-seed", "Seed", "Series A", "Series B", "Series C", "Series D+", "Debt or grant", "Unknown"] },
      amount: { type: "string" },
      sector: { type: "string" },
      saas: { type: "string", enum: ["yes", "no", "unsure"] },
    },
    required: ["i", "company", "domain", "round", "amount", "sector", "saas"],
  },
};

export function headlinePrompt(items: Headline[]): string {
  const lines = items.map((h) => `${h.i}. ${h.title}${h.summary ? ` — ${h.summary.slice(0, 220)}` : ""}`).join("\n");
  return `Each line is a news headline (with a short summary) about a company raising money.
For each line, name the ONE company that raised the money, never the investor.
- domain: the company's own website domain (e.g. acme.com) if you are confident; otherwise an empty string. Never a news site.
- round: the funding round named in the text, or Unknown.
- amount: as written, e.g. "$12M", or empty.
- sector: 2 to 4 words, e.g. "HR software", "fintech payments", "AI drug discovery".
- saas: "yes" if it sells software to businesses (B2B SaaS, developer tools, data or AI platforms sold to companies);
  "no" for consumer apps, hardware, robotics, biotech or drug discovery, lending, crypto tokens, D2C brands, marketplaces for consumers, funds; else "unsure".
Skip lines that are not about one company raising money (opinion pieces, fund launches, roundups).
Reply as a JSON array.

${lines}`;
}

export async function extractLeads(gemini: Gemini, items: Headline[]): Promise<ExtractedLead[]> {
  if (!items.length) return [];
  const raw = await gemini.json<ExtractedLead[]>(headlinePrompt(items), SCHEMA);
  const valid = new Set(items.map((h) => h.i));
  return (Array.isArray(raw) ? raw : [])
    .filter((r) => valid.has(r.i) && r.company?.trim())
    .map((r) => ({ ...r, company: r.company.trim(), domain: r.domain ? normaliseDomain(r.domain) : null }));
}
