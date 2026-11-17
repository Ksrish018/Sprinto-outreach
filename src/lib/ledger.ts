import "server-only";
import { sql } from "./db";

export type Api = "gemini" | "gemini_search" | "gemini_embed" | "hunter_search" | "hunter_verify" | "hubspot" | "gmail" | "jina";

// Every live external call is recorded (PRD §12.4), tagged with the run or the test that made it.
export async function record(api: Api, endpoint: string, ctx: { runId?: number; testId?: string }, credits = 0, remaining?: number) {
  await sql()`insert into api_ledger (test_id, run_id, api, endpoint, credits_used, remaining_after)
    values (${ctx.testId ?? null}, ${ctx.runId ?? null}, ${api}, ${endpoint}, ${credits}, ${remaining ?? null})`;
}

export async function usedThisMonth(api: Api): Promise<number> {
  const rows = (await sql()`select coalesce(sum(credits_used), 0)::float as n from api_ledger
    where api = ${api} and at >= date_trunc('month', now())`) as { n: number }[];
  return rows[0].n;
}
