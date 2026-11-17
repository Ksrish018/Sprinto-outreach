// FR-7: write the email from sourced facts only, then let code check it.
import type { Gemini } from "../gemini";
import { type Draft, SPRINTO_FACTS, checkDraft } from "./check";
import type { Pain } from "./pains";

export type DraftFact = { id: string; question: string; field: string; value: string; quote: string; verified: boolean };

// Hook = one verified fact; the strongest reason to buy now first (FR-7.2).
const HOOK_ORDER: [string, string][] = [
  ["Q4", "compliance_job"], ["Q4", "audit_statement"], ["Q2", "in_progress"],
  ["Q5", "enterprise_case_study"], ["Q5", "security_review_page"], ["Q5", "enterprise_tier"], ["Q5", "sso_saml"], ["Q5", "big_logos"],
];

export function pickHook(facts: DraftFact[]): DraftFact | null {
  for (const [q, f] of HOOK_ORDER) {
    const hit = facts.find((x) => x.verified && x.question === q && x.field === f);
    if (hit) return hit;
  }
  return null;
}

export type DraftInput = {
  company: string;
  person: { firstName: string; position: string };
  hook: DraftFact;
  facts: DraftFact[]; // verified facts only
  pains: Pain[];
  corrections: { before: string; after: string; reason: string | null }[]; // Loop 3 memory (M5); empty until then
};

const SCHEMA = {
  type: "OBJECT",
  properties: {
    subject: { type: "STRING" },
    hook: { type: "STRING" },
    body: { type: "STRING" },
    cta: { type: "STRING" },
    claims: { type: "ARRAY", items: { type: "OBJECT", properties: { sentence: { type: "STRING" }, source: { type: "STRING" } }, required: ["sentence", "source"] } },
  },
  required: ["subject", "hook", "body", "cta", "claims"],
};

export function draftPrompt(i: DraftInput, problems: string[] = []): string {
  const facts = i.facts.map((f) => `${f.id}: ${f.value} (quote: "${f.quote}")`).join("\n");
  const sprinto = Object.entries(SPRINTO_FACTS).map(([k, v]) => `${k}: ${v}`).join("\n");
  const memory = i.corrections.length
    ? `\nPast corrections by the Growth Lead in similar situations (follow their direction):\n${i.corrections.map((c, n) => `${n + 1}. Before: "${c.before}"\n   After: "${c.after}"${c.reason ? `\n   Why: ${c.reason}` : ""}`).join("\n")}\n`
    : "";
  return `Write a first cold email from Sprinto's Growth Lead to ${i.person.firstName}, ${i.person.position} at ${i.company}.

Sprinto automates compliance certification (SOC 2, ISO 27001, GDPR, HIPAA). Write like a peer: plain, specific, no hype.

Rules:
- hook: one sentence that greets ${i.person.firstName} by first name and names this specific fact: ${i.hook.id} = ${i.hook.value} ("${i.hook.quote}").
- body: two to three sentences tying the two pains below to what Sprinto does. Only use the facts listed. Never invent numbers, customers or events.
- cta: one short question asking for a 15-minute call next week. The only question mark in the email.
- subject: at most 7 words, no clickbait.
- Total of hook + body + cta: 60 to 110 words. No links, no em-dashes, no exclamation marks.
- claims: list every factual sentence with its source: a company fact id (F...) or a Sprinto fact id (S...).

Pains to address (in this order):
1. ${i.pains[0]?.text ?? ""}
2. ${i.pains[1]?.text ?? ""}

Company facts you may use:
${facts}

Sprinto facts you may use:
${sprinto}
${memory}${problems.length ? `\nYour previous draft failed these checks. Fix every one:\n- ${problems.join("\n- ")}\n` : ""}`;
}

export async function writeDraft(g: Gemini, i: DraftInput): Promise<{ draft: Draft; ok: boolean; problems: string[]; attempts: number }> {
  const factIds = new Set(i.facts.map((f) => f.id));
  let problems: string[] = [];
  let draft: Draft | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    draft = await g.json<Draft>(draftPrompt(i, problems), SCHEMA);
    const res = checkDraft(draft, { firstName: i.person.firstName, factIds });
    if (res.ok) return { draft, ok: true, problems: [], attempts: attempt };
    problems = res.problems;
  }
  return { draft: draft!, ok: false, problems, attempts: 2 };
}
