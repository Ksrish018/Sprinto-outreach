// Extract named fields from a cleaned page, then keep only facts whose quote is really on the page (FR-3.3).
import type { Gemini } from "../gemini";
import { quoteFound } from "./clean";
import { type Fact, QUESTIONS, type QuestionId, type Rung } from "./evidence";

type RawFact = { question: string; field: string; value: string; quote: string };

const SCHEMA = {
  type: "OBJECT",
  properties: {
    facts: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          field: { type: "STRING" },
          value: { type: "STRING" },
          quote: { type: "STRING" },
        },
        required: ["question", "field", "value", "quote"],
      },
    },
  },
  required: ["facts"],
};

export function extractionPrompt(domain: string, url: string, text: string, open: QuestionId[]): string {
  const fields = open
    .map((q) => `${q} (${QUESTIONS[q].title})\n${Object.entries(QUESTIONS[q].fields).map(([f, d]) => `  - ${f}: ${d}`).join("\n")}`)
    .join("\n");
  return `You extract evidence about the company at ${domain} from one page of text (${url}).

Fill only the fields below that THIS page clearly supports. For every fact:
- "quote" must be copied character for character from the page text (8 to 200 characters). Never paraphrase.
- "value" is a short normalised answer as described for the field.
- If the page does not support a field, leave it out. An empty list is a good answer.
- Facts must be about ${domain} itself, not its customers, partners or competitors.

Fields:
${fields}

Page text:
"""
${text}
"""`;
}

export function verifyFacts(raw: RawFact[], text: string, url: string, rung: Rung, open: QuestionId[]): { kept: Fact[]; dropped: number } {
  const kept: Fact[] = [];
  let dropped = 0;
  for (const r of raw ?? []) {
    const q = r.question?.trim().toUpperCase() as QuestionId;
    if (!open.includes(q) || !QUESTIONS[q]?.fields[r.field]) {
      dropped++;
      continue;
    }
    if (!r.value?.trim() || !quoteFound(r.quote ?? "", text)) {
      dropped++;
      continue;
    }
    kept.push({ question: q, field: r.field, value: r.value.trim().slice(0, 200), quote: r.quote.trim().slice(0, 300), sourceUrl: url, rung, verified: true });
  }
  return { kept, dropped };
}

export async function extractFromPage(gemini: Gemini, domain: string, url: string, text: string, open: QuestionId[], rung: Rung) {
  if (!open.length || !text.trim()) return { kept: [] as Fact[], dropped: 0 };
  const out = await gemini.json<{ facts: RawFact[] }>(extractionPrompt(domain, url, text, open), SCHEMA);
  return verifyFacts(out.facts, text, url, rung, open);
}

// Search rung (FR-3.0 rung 3): one grounded search for size, funding and markets.
// These facts cite search sources; they cannot be checked verbatim, so verified = false.
type SearchAnswer = {
  employees?: { value: string; quote: string; source: string } | null;
  funding_round?: { value: string; date?: string; quote: string; source: string } | null;
  geography?: { value: string; quote: string; source: string } | null;
};

export function searchPrompt(name: string, domain: string): string {
  return `Use Google Search to find facts about the company ${name} (website ${domain}).
Answer only from search results about this exact company (check the domain). Reply with JSON only:
{
  "employees": {"value": "number or min-max", "quote": "short text from the source", "source": "source domain"} or null,
  "funding_round": {"value": "Seed | Series A | Series B | Series C | Series D+ | public | acquired | bootstrapped", "date": "YYYY-MM", "quote": "...", "source": "..."} or null,
  "geography": {"value": "comma-separated from US, UK, EU, India, ANZ, other", "quote": "...", "source": "..."} or null
}
Use null when you are not sure. Do not guess.`;
}

export function searchFacts(ans: SearchAnswer, sources: { uri: string; title: string }[], domain: string): Fact[] {
  const src = (label: string) => sources.find((s) => s.title && label && s.title.toLowerCase().includes(label.toLowerCase().replace(/^www\./, "")))?.uri
    ?? (label ? `https://${label.replace(/^https?:\/\//, "")}` : `https://${domain}`);
  const out: Fact[] = [];
  if (ans.employees?.value) out.push({ question: "Q3", field: "employees", value: ans.employees.value, quote: ans.employees.quote ?? "", sourceUrl: src(ans.employees.source), rung: "search", verified: false });
  if (ans.funding_round?.value) {
    out.push({ question: "Q6", field: "funding_round", value: ans.funding_round.value, quote: ans.funding_round.quote ?? "", sourceUrl: src(ans.funding_round.source), rung: "search", verified: false });
    if (ans.funding_round.date) out.push({ question: "Q6", field: "funding_date", value: ans.funding_round.date, quote: ans.funding_round.quote ?? "", sourceUrl: src(ans.funding_round.source), rung: "search", verified: false });
  }
  if (ans.geography?.value) out.push({ question: "Q8", field: "geography", value: ans.geography.value, quote: ans.geography.quote ?? "", sourceUrl: src(ans.geography.source), rung: "search", verified: false });
  return out;
}

export async function searchCompany(gemini: Gemini, name: string, domain: string): Promise<Fact[]> {
  const { data, sources } = await gemini.grounded<SearchAnswer>(searchPrompt(name, domain));
  return searchFacts(data ?? {}, sources, domain);
}
