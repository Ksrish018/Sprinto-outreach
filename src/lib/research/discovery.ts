// FR-2: find candidate companies when no list is given. Gemini + Google Search, one source set per call,
// pre-scored from the snippet only so obvious misfits never cost research.
import type { Gemini } from "../gemini";
import { normaliseDomain } from "./domains";

export type Candidate = { name: string; domain: string; sourceUrl: string; why: string; preScore: number };

export const SOURCE_SETS = [
  "B2B SaaS companies that announced a Series A, Series B or Series C funding round in the last 6 months",
  "B2B SaaS companies with 20 to 500 employees currently hiring for SOC 2, ISO 27001, GRC or security compliance roles",
  "Recent Y Combinator or Product Hunt B2B SaaS companies selling to enterprises in fintech, healthtech, HR tech or data/AI",
  "B2B SaaS startups that launched an enterprise plan, SSO/SAML or a security page in the last year",
];

type RawCandidate = { name?: string; domain?: string; source_url?: string; why?: string; saas?: string; employees?: string; stage?: string; trigger?: string };

export function discoveryPrompt(sourceSet: string, exclude: string[]): string {
  return `Use Google Search to find up to 12 real companies matching: ${sourceSet}.
Sprinto sells compliance automation (SOC 2, ISO 27001, GDPR). A good prospect is a B2B SaaS company, Series A to C,
roughly 20 to 500 employees, that is preparing for an audit or is under pressure from enterprise customers.
Do not include: ${exclude.slice(0, 60).join(", ") || "none"}.
Reply with JSON only: an array of
{"name": "...", "domain": "company.com", "source_url": "page that mentions it", "why": "one sentence with the specific signal",
 "saas": "yes|no|unsure", "employees": "number or range or unknown", "stage": "Seed|Series A|Series B|Series C|later|unknown", "trigger": "audit|enterprise|none|unknown"}
Only include companies whose own website domain you are confident about.`;
}

// Pre-score from the snippet (FR-2.2): clear gate failures are dropped before research.
export function preScore(c: RawCandidate): number | null {
  if (c.saas === "no") return null;
  const emp = (c.employees ?? "").match(/\d+/g)?.map(Number);
  if (emp?.length && (Math.max(...emp) < 10 || Math.min(...emp) > 1000)) return null;
  if (/later|public|acquired/i.test(c.stage ?? "")) return null;
  let s = 0;
  if (c.saas === "yes") s += 20;
  if (/series [abc]/i.test(c.stage ?? "")) s += 20;
  if (c.trigger === "audit") s += 30;
  if (c.trigger === "enterprise") s += 25;
  if (emp?.length && Math.min(...emp) >= 20 && Math.max(...emp) <= 500) s += 10;
  return s;
}

export async function discover(gemini: Gemini, sourceSet: string, exclude: Set<string>): Promise<Candidate[]> {
  const { data } = await gemini.grounded<RawCandidate[]>(discoveryPrompt(sourceSet, [...exclude]));
  const out: Candidate[] = [];
  for (const c of Array.isArray(data) ? data : []) {
    const domain = normaliseDomain(c.domain ?? "");
    if (!domain || exclude.has(domain) || out.some((x) => x.domain === domain)) continue;
    const score = preScore(c);
    if (score === null) continue;
    out.push({ name: c.name?.trim() || domain, domain, sourceUrl: c.source_url ?? "", why: c.why?.trim() ?? sourceSet, preScore: score });
  }
  return out.sort((a, b) => b.preScore - a.preScore);
}
