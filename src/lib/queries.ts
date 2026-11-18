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

// ---------------------------------------------------------------- M2: pipeline and dossier

export type RunRow = { id: number; trigger: string; status: string; counts: Record<string, unknown>; started_at: string; finished_at: string | null };

export async function getRun(id?: number): Promise<RunRow | null> {
  const rows = (id
    ? await sql()`select id, trigger, status, counts, started_at, finished_at from runs where id = ${id}`
    : await sql()`select id, trigger, status, counts, started_at, finished_at from runs order by id desc limit 1`) as RunRow[];
  return rows[0] ?? null;
}

export type PipelineRow = {
  company_id: number; domain: string; name: string | null; source: string | null; why_picked: string | null;
  status: string; stop_reason: string | null; fetches: number; error: string | null;
  outcome: string | null; score: number | null;
};

export async function getPipeline(runId: number): Promise<PipelineRow[]> {
  return (await sql()`select rc.company_id, c.domain, c.name, c.source, c.why_picked, rc.status, rc.stop_reason, rc.fetches, rc.error,
      d.outcome, d.score
    from run_companies rc
    join companies c on c.id = rc.company_id
    left join decisions d on d.company_id = rc.company_id and d.run_id = rc.run_id
    where rc.run_id = ${runId}
    order by case d.outcome when 'go' then 0 when 'go_flag' then 1 when 'human' then 2 when 'no_go' then 3 else 4 end,
      d.score desc nulls last, c.domain`) as PipelineRow[];
}

export type FactRow = { id: number; question_id: string; field: string; value: string; quote: string; source_url: string; source_rung: string; verified: boolean };
export type DossierStep = { source: string; rung: string; why: string; result: string; via?: string; failure?: string | null; facts: number };

export type Dossier = {
  company: { id: number; domain: string; name: string | null; source: string | null; why_picked: string | null };
  runId: number | null;
  decision: { outcome: string; score: number; gates: Record<string, string>; triggers: Record<string, boolean>; reasons: { text: string; factId: number | null }[]; flags: string[] } | null;
  facts: FactRow[];
  timeline: DossierStep[];
  stop: { stop_reason: string | null; fetches: number } | null;
};

export async function getDossier(companyId: number): Promise<Dossier | null> {
  const q = sql();
  const [company] = (await q`select id, domain, name, source, why_picked from companies where id = ${companyId}`) as Dossier["company"][];
  if (!company) return null;
  const [rc] = (await q`select run_id, stop_reason, fetches, timeline from run_companies
    where company_id = ${companyId} and status = 'qualified' order by run_id desc limit 1`) as { run_id: number; stop_reason: string | null; fetches: number; timeline: DossierStep[] }[];
  if (!rc) return { company, runId: null, decision: null, facts: [], timeline: [], stop: null };
  const [decision] = (await q`select outcome, score, gates, triggers, reasons, flags from decisions
    where company_id = ${companyId} and run_id = ${rc.run_id}`) as NonNullable<Dossier["decision"]>[];
  const facts = (await q`select id, question_id, field, value, quote, source_url, source_rung, verified from facts
    where company_id = ${companyId} and run_id = ${rc.run_id} order by question_id, id`) as FactRow[];
  return { company, runId: rc.run_id, decision: decision ?? null, facts, timeline: rc.timeline ?? [], stop: { stop_reason: rc.stop_reason, fetches: rc.fetches } };
}

// ---------------------------------------------------------------- M3: drafts

export type DraftRow = {
  id: number; company_id: number; run_id: number; domain: string; company: string | null;
  subject: string; hook: string; body: string; cta: string; status: string; segment: string | null; stage: string | null;
  pains: { id: string; text: string }[]; claim_map: { claims: { sentence: string; source: string }[]; problems: string[]; attempts: number };
  contact_name: string | null; contact_title: string | null; contact_email: string | null; pick_reason: string | null; hunter_confidence: number | null;
  hook_value: string | null; hook_quote: string | null; hook_url: string | null;
  outcome: string | null; score: number | null; reasons: { text: string; factId: number | null }[] | null;
  created_at: string;
};

export async function getDrafts(): Promise<DraftRow[]> {
  return (await sql()`select dr.id, dr.company_id, dr.run_id, c.domain, c.name as company, dr.subject, dr.hook, dr.body, dr.cta, dr.status,
      dr.segment, dr.stage, dr.pains, dr.claim_map, ct.name as contact_name, ct.title as contact_title, ct.email as contact_email,
      ct.pick_reason, ct.hunter_confidence, hf.value as hook_value, hf.quote as hook_quote, hf.source_url as hook_url,
      d.outcome, d.score, d.reasons, dr.created_at
    from drafts dr
    join companies c on c.id = dr.company_id
    left join contacts ct on ct.id = dr.contact_id
    left join facts hf on hf.id = dr.hook_fact_id
    left join decisions d on d.company_id = dr.company_id and d.run_id = dr.run_id
    order by dr.created_at desc limit 100`) as DraftRow[];
}

export type RunFunnel = { drafts: number; blocked: number; inGmail: number; sent: number; edited: number };

// Draft-side counts for one run, for the step-by-step view on Pipeline.
export async function getRunFunnel(runId: number): Promise<RunFunnel> {
  const [r] = (await sql()`select count(*)::int as drafts,
      count(*) filter (where status = 'blocked')::int as blocked,
      count(*) filter (where status = 'in_gmail')::int as "inGmail",
      count(*) filter (where status in ('sent_edited', 'sent_as_is'))::int as sent,
      count(*) filter (where status = 'sent_edited')::int as edited
    from drafts where run_id = ${runId}`) as RunFunnel[];
  return r ?? { drafts: 0, blocked: 0, inGmail: 0, sent: 0, edited: 0 };
}
