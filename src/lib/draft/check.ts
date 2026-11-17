// FR-7.1 and FR-7.3: rules every draft must pass before it can reach Gmail. Code, not the model, decides.

export type Draft = {
  subject: string;
  hook: string;
  body: string;
  cta: string;
  claims: { sentence: string; source: string }[]; // source = a fact id ("F12") or a Sprinto fact id ("S1")
};

// What Sprinto may claim about itself: from sprinto.com, never invented.
export const SPRINTO_FACTS: Record<string, string> = {
  S1: "Sprinto automates compliance for SOC 2, ISO 27001, HIPAA, GDPR and other frameworks",
  S2: "Sprinto connects to cloud, identity, HR and code tools through 300+ integrations and collects evidence automatically",
  S3: "Sprinto's promise: SOC 2 ready in weeks, not months",
  S4: "Sprinto is trusted by 4,000+ companies from Series A to enterprise",
  S5: "Sprinto monitors controls continuously so compliance does not drift between audits",
};

const SPAM = /\b(guarantee[d]?|free money|act now|limited time|100% free|risk[- ]free|click here|buy now|no obligation|winner|urgent|amazing deal|best price|once in a lifetime)\b/i;

export type CheckResult = { ok: boolean; problems: string[] };

export function checkDraft(d: Draft, ctx: { firstName: string; factIds: Set<string> }): CheckResult {
  const problems: string[] = [];
  const all = [d.subject, d.hook, d.body, d.cta].join(" ");
  const words = [d.hook, d.body, d.cta].join(" ").split(/\s+/).filter(Boolean).length;

  if (d.subject.split(/\s+/).filter(Boolean).length > 7) problems.push("Subject is longer than 7 words");
  if (!new RegExp(`\\b${ctx.firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(d.hook)) problems.push(`Hook does not address ${ctx.firstName} by first name`);
  if (words < 60 || words > 120) problems.push(`Body is ${words} words (60 to 120 allowed)`);
  if (/https?:\/\/|www\./i.test(all)) problems.push("Contains a link");
  if ((d.cta.match(/\?/g) ?? []).length !== 1 || /\?/.test(d.hook + d.body)) problems.push("Needs exactly one question, in the call to action");
  if (SPAM.test(all)) problems.push("Contains spam-trigger wording");
  if (/—/.test(all)) problems.push("Contains an em-dash");

  // Claim checker: every factual sentence maps to a stored, verified fact or to a Sprinto fact.
  if (!d.claims.length) problems.push("No claims mapped to sources");
  for (const c of d.claims) {
    const ok = ctx.factIds.has(c.source) || c.source in SPRINTO_FACTS;
    if (!ok) problems.push(`Unmapped claim: "${c.sentence.slice(0, 80)}"`);
  }
  return { ok: problems.length === 0, problems };
}
