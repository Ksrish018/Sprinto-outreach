// Capture (FR-13.1): only the delta matters. Pure functions, unit tested.

export type Parts = { hook: string; body: string; cta: string };

// Signed by a person, not a team. The name is optional config (SENDER_NAME), never hardcoded.
export function signature(sender?: string): string {
  return sender ? `Best,\n${sender}\nGrowth, Sprinto` : "Best,\nGrowth Lead, Sprinto";
}

// A clear opt-out line on every email (Pre-Build Decisions: Sprinto must follow the email rules it sells).
export const OPT_OUT = 'If this is not relevant, reply "no thanks" and I will not follow up.';

export function composeEmail(pilotLine: string, p: Parts, sender?: string): string {
  return [pilotLine, "", p.hook, "", p.body, "", p.cta, "", signature(sender), "", OPT_OUT].join("\n");
}

const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).filter(Boolean);

// Word-level edit distance / longer length: 0 = identical, 1 = completely rewritten.
export function editRatio(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  if (!x.length && !y.length) return 0;
  const prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (x[i - 1] === y[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return Math.round((prev[y.length] / Math.max(x.length, y.length)) * 1000) / 1000;
}

// Split what was sent back into hook / body / CTA: drop the pilot line, signature and any quoted reply.
export function splitSent(text: string): Parts {
  const lines = text.replace(/\r/g, "").split("\n");
  const quoted = lines.findIndex((l) => /^On .+ wrote:$/.test(l.trim()) || l.startsWith(">"));
  const kept = quoted === -1 ? lines : lines.slice(0, quoted);
  // Everything from the sign-off down (name, title, opt-out line) is not part of what is learned from.
  const signoff = kept.findIndex((l) => /^(best|thanks|cheers|regards|best regards|kind regards),?$/i.test(l.trim()));
  const clean = (signoff === -1 ? kept : kept.slice(0, signoff)).join("\n")
    .replace(/^Pilot:.*$/m, "")
    .replace(/^If this is not relevant, reply.*$/m, "")
    .trim();
  const paras = clean.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (paras.length === 0) return { hook: "", body: "", cta: "" };
  if (paras.length === 1) return { hook: paras[0], body: "", cta: "" };
  if (paras.length === 2) return { hook: paras[0], body: "", cta: paras[1] };
  return { hook: paras[0], body: paras.slice(1, -1).join(" "), cta: paras[paras.length - 1] };
}

export type Delta = { hook: number; body: number; cta: number; overall: number; changed: (keyof Parts)[] };

export function delta(before: Parts, after: Parts): Delta {
  const d = { hook: editRatio(before.hook, after.hook), body: editRatio(before.body, after.body), cta: editRatio(before.cta, after.cta) };
  const overall = editRatio(`${before.hook} ${before.body} ${before.cta}`, `${after.hook} ${after.body} ${after.cta}`);
  return { ...d, overall, changed: (Object.keys(d) as (keyof Parts)[]).filter((k) => d[k] > 0.02) };
}

// Disagreement score (FR-13.5): share edited x average edit size, plus share discarded.
export function disagreement(outcomes: { outcome: "accepted" | "edited" | "discarded"; size: number }[]): number {
  if (!outcomes.length) return 0;
  const n = outcomes.length;
  const edited = outcomes.filter((o) => o.outcome === "edited");
  const avg = edited.length ? edited.reduce((s, o) => s + o.size, 0) / edited.length : 0;
  const discarded = outcomes.filter((o) => o.outcome === "discarded").length;
  return Math.min(1, Math.round(((edited.length / n) * avg + discarded / n) * 1000) / 1000);
}
