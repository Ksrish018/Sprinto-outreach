import "server-only";
import { sql } from "./db";

export type KillState = {
  is_on: boolean;
  fired_line: string | null;
  fired_at: string | null;
};

export type WeekSummary = {
  lastRun: { id: number; trigger: string; status: string; started_at: string } | null;
  found: number;
  go: number;
  drafted: number;
  sent: number;
};

export async function getKillState(): Promise<KillState> {
  const rows = (await sql()`select is_on, fired_line, fired_at from kill_state where id = 1`) as KillState[];
  return rows[0] ?? { is_on: false, fired_line: null, fired_at: null };
}

// Counts for the last 7 days; zero until the first run exists.
export async function getWeekSummary(): Promise<WeekSummary> {
  const q = sql();
  const [runs, counts] = await Promise.all([
    q`select id, trigger, status, started_at from runs order by started_at desc limit 1`,
    q`select
        (select count(*) from companies where created_at > now() - interval '7 days')::int as found,
        (select count(*) from decisions where outcome in ('go', 'go_flag') and created_at > now() - interval '7 days')::int as go,
        (select count(*) from drafts where created_at > now() - interval '7 days')::int as drafted,
        (select count(*) from sends where sent_at > now() - interval '7 days')::int as sent`,
  ]);
  const c = (counts as { found: number; go: number; drafted: number; sent: number }[])[0];
  return { lastRun: (runs as WeekSummary["lastRun"][])[0] ?? null, ...c };
}

export type IcpVersion = { id: number; weights: Record<string, number>; thresholds: Record<string, number>; note: string | null };

export async function getCurrentIcp(): Promise<IcpVersion | null> {
  const rows = (await sql()`select id, weights, thresholds, note from icp_versions order by id desc limit 1`) as IcpVersion[];
  return rows[0] ?? null;
}

export async function getSuppression(): Promise<{ domain: string; reason: string }[]> {
  return (await sql()`select domain, reason from suppression order by domain`) as { domain: string; reason: string }[];
}

export type LedgerRow = { api: string; calls: number; credits: number };

export async function getMonthLedger(): Promise<LedgerRow[]> {
  return (await sql()`select api, count(*)::int as calls, coalesce(sum(credits_used), 0)::float as credits
    from api_ledger where at >= date_trunc('month', now()) group by api order by api`) as LedgerRow[];
}
