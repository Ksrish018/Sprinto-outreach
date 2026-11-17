import "server-only";
import { sql } from "../db";
import { env } from "../env";
import { record } from "../ledger";

// Store and Retrieve (FR-13.2, FR-13.3): embed the situation, not the correction; filter hard on
// reviewer and role group before searching by meaning; nothing below the score floor is passed on.
export const REVIEWER = "growth_lead";
export const SCORE_FLOOR = 0.62;
const TOP_K = 5;

export async function embed(text: string, runId?: number): Promise<number[]> {
  const e = env();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${e.GEMINI_EMBEDDING_MODEL}:embedContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": e.GEMINI_API_KEY },
    body: JSON.stringify({ content: { parts: [{ text }] }, outputDimensionality: 768 }),
    signal: AbortSignal.timeout(30_000),
  });
  await record("gemini_embed", "embedContent", { runId });
  if (!res.ok) throw new Error(`Embedding HTTP ${res.status}`);
  const d = (await res.json()) as { embedding: { values: number[] } };
  return d.embedding.values;
}

export function situationText(s: { roleGroup: string; trigger: string; stage: string | null; industry: string | null; employees: number | null; company: string }): string {
  return `${s.roleGroup} at ${s.company}, a ${s.stage ?? "unknown-stage"} ${s.industry ?? "B2B SaaS"} company with ${s.employees ?? "unknown"} employees; reason to buy now: ${s.trigger.replace("_", " ")}`;
}

export type Correction = { id: number; before: string; after: string; reason: string | null; score: number };

export async function retrieve(roleGroup: string, situation: string, runId?: number): Promise<Correction[]> {
  const [{ n }] = (await sql()`select count(*)::int as n from corrections where reviewer = ${REVIEWER} and role_group = ${roleGroup}`) as { n: number }[];
  if (!n) return [];
  const v = `[${(await embed(situation, runId)).join(",")}]`;
  // Hybrid: meaning (cosine) weighted 0.8, keywords (full text) 0.2.
  const rows = (await sql()`select id, before_text as before, after_text as after, reason,
      (0.8 * (1 - (embedding <=> ${v}::vector)) + 0.2 * least(1, ts_rank(search_text, plainto_tsquery('english', ${situation})) * 10))::float as score
    from corrections
    where reviewer = ${REVIEWER} and role_group = ${roleGroup} and embedding is not null
    order by score desc limit ${TOP_K}`) as Correction[];
  return rows.filter((r) => r.score >= SCORE_FLOOR);
}
