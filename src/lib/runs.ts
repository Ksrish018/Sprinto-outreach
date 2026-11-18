import "server-only";
import { sql } from "./db";
import { env } from "./env";
import { Gemini } from "./gemini";
import { domainsInHubspot } from "./hubspot";
import { record } from "./ledger";
import { personAndDraft } from "./outreach";
import { takeFromPool } from "./feeds/pool";
import { discover, SOURCE_SETS } from "./research/discovery";
import { parseDomainList } from "./research/domains";
import { extractFromPage, searchCompany } from "./research/extract";
import { Fetcher } from "./research/fetcher";
import { assess } from "./research/assess";
import type { LoopDeps, ResearchResult } from "./research/loop";
import type { Decision, Thresholds, Weights } from "./research/qualify";

const RESEARCH_COOLDOWN_DAYS = 90;
const MAX_COMPANIES = 20;
const FIND_MORE = { minGo: 5, maxRounds: 3 }; // Loop 2
const POOL_TAKE = { first: 30, more: 15 }; // v5: companies taken from the news pool per round

export class RunError extends Error {}

function gemini(runId: number) {
  const e = env();
  return new Gemini({ apiKey: e.GEMINI_API_KEY, model: e.GEMINI_MODEL, onCall: (kind) => record(kind, "generateContent", { runId }) });
}

function liveDeps(runId: number, domain: string, name: string): LoopDeps {
  const fetcher = new Fetcher(fetch, () => record("jina", "r.jina.ai", { runId }));
  const g = gemini(runId);
  return {
    now: () => Date.now(),
    page: async (url) => {
      const p = await fetcher.page(url);
      return { url, finalUrl: p.finalUrl, status: p.status, via: p.via, failure: p.failure, text: p.cleaned?.text ?? null, links: p.cleaned?.links ?? [], fetchCount: p.fetchCount, trustTool: p.trustTool };
    },
    json: (url) => fetcher.json(url),
    extract: (url, text, open, rung) => extractFromPage(g, domain, url, text, open, rung),
    search: () => searchCompany(g, name, domain),
  };
}

// ---------------------------------------------------------------- create

async function suppressed(): Promise<Set<string>> {
  const rows = (await sql()`select domain from suppression`) as { domain: string }[];
  return new Set(rows.map((r) => r.domain));
}

async function recentlyResearched(): Promise<Set<string>> {
  const rows = (await sql()`select domain from companies where last_researched_at > now() - make_interval(days => ${RESEARCH_COOLDOWN_DAYS})`) as { domain: string }[];
  return new Set(rows.map((r) => r.domain));
}

async function enqueue(runId: number, items: { domain: string; name?: string; source: string; why?: string; leadId?: number }[], skip: Map<string, string>) {
  for (const it of items) {
    const rows = (await sql()`insert into companies (domain, name, first_seen_run, source, why_picked, lead_id)
      values (${it.domain}, ${it.name ?? null}, ${runId}, ${it.source}, ${it.why ?? null}, ${it.leadId ?? null})
      on conflict (domain) do update set name = coalesce(companies.name, excluded.name),
        why_picked = coalesce(excluded.why_picked, companies.why_picked), lead_id = coalesce(excluded.lead_id, companies.lead_id)
      returning id`) as { id: number }[];
    const reason = skip.get(it.domain);
    await sql()`insert into run_companies (run_id, company_id, status, stop_reason)
      values (${runId}, ${rows[0].id}, ${reason ? "skipped" : "queued"}, ${reason ?? null})
      on conflict do nothing`;
  }
}

export async function createRun(input: { trigger: "cron" | "manual" | "domains"; domainsText?: string }) {
  const active = (await sql()`select id from runs where status = 'running' limit 1`) as { id: number }[];
  if (active.length) throw new RunError(`Run ${active[0].id} is still running. Wait for it to finish.`);

  const icp = (await sql()`select id from icp_versions order by id desc limit 1`) as { id: number }[];
  const [run] = (await sql()`insert into runs (trigger, icp_version_id, counts) values (${input.trigger}, ${icp[0].id}, ${JSON.stringify({ rounds: 0 })})
    returning id`) as { id: number }[];

  try {
    const blocked = await suppressed();
    if (input.trigger === "domains") {
      const { domains, invalid } = parseDomainList(input.domainsText ?? "");
      if (!domains.length) throw new RunError("No valid domains in the list.");
      const known = await domainsInHubspot(domains, run.id).catch(() => new Set<string>());
      const skip = new Map<string, string>();
      for (const d of domains) {
        if (blocked.has(d)) skip.set(d, "On the suppression list");
        else if (known.has(d)) skip.set(d, "Already in HubSpot");
      }
      await enqueue(run.id, domains.map((d) => ({ domain: d, source: "domain list" })), skip);
      await sql()`update runs set counts = counts || ${JSON.stringify({ invalid })}::jsonb where id = ${run.id}`;
    } else {
      await findCompanies(run.id, blocked);
    }
  } catch (err) {
    await sql()`update runs set status = 'failed', finished_at = now(), counts = counts || ${JSON.stringify({ error: (err as Error).message })}::jsonb where id = ${run.id}`;
    throw err;
  }
  return run.id;
}

// FR-2 discovery. v5: the news-feed pool first; web search (one source set per round) only when the pool is empty.
async function findCompanies(runId: number, blocked: Set<string>) {
  const run = (await sql()`select counts from runs where id = ${runId}`) as { counts: { rounds?: number; web_rounds?: number; from_pool?: number } }[];
  const { rounds: round = 0, web_rounds: webRound = 0, from_pool: pooledSoFar = 0 } = run[0].counts;
  const exclude = new Set([...blocked, ...(await recentlyResearched())]);
  const existing = (await sql()`select c.domain from run_companies rc join companies c on c.id = rc.company_id where rc.run_id = ${runId}`) as { domain: string }[];
  for (const e of existing) exclude.add(e.domain);

  const pooled = await takeFromPool(round === 0 ? POOL_TAKE.first : POOL_TAKE.more).catch(() => []);
  const fromPool = pooled.filter((l) => !exclude.has(l.domain));
  const dropped = pooled.filter((l) => exclude.has(l.domain)).map((l) => l.id);
  if (dropped.length) await sql()`update leads set status = 'excluded', status_reason = 'Suppressed or researched recently', updated_at = now() where id = any(${dropped})`;
  if (fromPool.length) {
    await enqueue(runId, fromPool.map((l) => ({ domain: l.domain, name: l.name, source: "news feed", why: l.why, leadId: l.id })), new Map());
    await sql()`update runs set counts = counts || ${JSON.stringify({ rounds: round + 1, from_pool: pooledSoFar + fromPool.length })}::jsonb where id = ${runId}`;
    return fromPool.length;
  }

  // Backup: web search, when the pool is empty.
  const g = gemini(runId);
  let found: Awaited<ReturnType<typeof discover>> = [];
  let i = webRound;
  for (; i < SOURCE_SETS.length && found.length < MAX_COMPANIES; i++) {
    const batch = await discover(g, SOURCE_SETS[i], exclude);
    for (const c of batch) exclude.add(c.domain);
    found.push(...batch);
    if (i - webRound >= 1) {
      i++;
      break; // at most two source sets per round keeps discovery cheap
    }
  }
  await sql()`update runs set counts = counts || ${JSON.stringify({ rounds: round + 1, web_rounds: i })}::jsonb where id = ${runId}`;
  const known = await domainsInHubspot(found.map((c) => c.domain), runId).catch(() => new Set<string>());
  found = found.filter((c) => !known.has(c.domain)).sort((a, b) => b.preScore - a.preScore).slice(0, MAX_COMPANIES);
  await enqueue(runId, found.map((c) => ({ domain: c.domain, name: c.name, source: "web search", why: c.why })), new Map());
  return found.length;
}

// ---------------------------------------------------------------- process

type Claimed = { company_id: number; domain: string; name: string | null; icp_version_id: number };

async function claimNext(runId: number): Promise<Claimed | null> {
  const rows = (await sql()`update run_companies rc set status = 'researching', updated_at = now(), attempts = attempts + 1
    from companies c, runs r
    where rc.run_id = ${runId} and rc.company_id = c.id and r.id = rc.run_id
      and (rc.run_id, rc.company_id) = (
        select run_id, company_id from run_companies
        where run_id = ${runId} and (status = 'queued' or (status = 'researching' and updated_at < now() - interval '10 minutes' and attempts < 3))
        order by company_id limit 1 for update skip locked)
    returning rc.company_id, c.domain, c.name, r.icp_version_id`) as Claimed[];
  return rows[0] ?? null;
}

async function saveResult(runId: number, companyId: number, r: ResearchResult, d: Decision) {
  const q = sql();
  await q`delete from facts where company_id = ${companyId} and run_id = ${runId}`;
  const ids: number[] = [];
  for (const f of r.facts) {
    const row = (await q`insert into facts (company_id, run_id, question_id, field, value, quote, source_url, source_rung, verified)
      values (${companyId}, ${runId}, ${f.question}, ${f.field}, ${f.value}, ${f.quote}, ${f.sourceUrl}, ${f.rung}, ${f.verified})
      returning id`) as { id: number }[];
    ids.push(row[0].id);
  }
  const reasons = d.reasons.map((x) => ({ text: x.text, factId: x.factIndex !== undefined ? ids[x.factIndex] : null }));
  await q`delete from decisions where company_id = ${companyId} and run_id = ${runId}`;
  await q`insert into decisions (company_id, run_id, outcome, score, gates, triggers, reasons, flags)
    values (${companyId}, ${runId}, ${d.outcome}, ${d.score}, ${JSON.stringify(d.gates)}, ${JSON.stringify(d.triggers)}, ${JSON.stringify(reasons)}, ${JSON.stringify(d.flags)})`;
  for (const p of r.pages) {
    await q`insert into pages (company_id, url, status, via, word_count, failure_reason, cleaned_text)
      values (${companyId}, ${p.url}, ${p.status}, ${p.via}, ${p.text ? p.text.split(/\s+/).length : 0}, ${p.failure}, ${p.text})
      on conflict (company_id, url) do update set fetched_at = now(), status = excluded.status, via = excluded.via,
        word_count = excluded.word_count, failure_reason = excluded.failure_reason, cleaned_text = excluded.cleaned_text`;
  }
  await q`update companies set last_researched_at = now() where id = ${companyId}`;
  await q`update run_companies set status = 'qualified', stop_reason = ${r.stopDetail}, fetches = ${r.fetches},
    timeline = ${JSON.stringify(r.timeline)}, error = null, updated_at = now()
    where run_id = ${runId} and company_id = ${companyId}`;
}

async function loadIcp(id: number): Promise<{ weights: Weights; thresholds: Thresholds }> {
  const rows = (await sql()`select weights, thresholds from icp_versions where id = ${id}`) as { weights: Weights; thresholds: Thresholds }[];
  return rows[0];
}

export async function processNext(runId: number): Promise<{ domain: string; outcome: string } | null> {
  const c = await claimNext(runId);
  if (!c) {
    await finishOrFindMore(runId);
    return null;
  }
  try {
    const icp = await loadIcp(c.icp_version_id);
    const deps = liveDeps(runId, c.domain, c.name ?? c.domain);
    const { result: r, decision: d } = await assess(c.domain, deps, icp);
    await saveResult(runId, c.company_id, r, d);
    await sql()`update leads set status = 'researched', updated_at = now() where domain = ${c.domain} and status = 'queued'`;
    let outcome: string = d.outcome;
    if (d.outcome === "go" || d.outcome === "go_flag") {
      // Person + draft (steps 4 to 6). A failure here keeps the decision and is shown on the dossier.
      try {
        outcome = `${d.outcome}, ${await personAndDraft(runId, c.company_id)}`;
      } catch (err) {
        await sql()`update decisions set flags = flags || ${JSON.stringify([`Person or draft step failed: ${(err as Error).message.slice(0, 120)}`])}::jsonb
          where run_id = ${runId} and company_id = ${c.company_id}`;
      }
    }
    return { domain: c.domain, outcome };
  } catch (err) {
    // One company failing never stops the run (FR-1.5); it is retried up to 3 attempts.
    await sql()`update run_companies set status = case when attempts >= 3 then 'failed' else 'queued' end,
      error = ${(err as Error).message.slice(0, 300)}, updated_at = now()
      where run_id = ${runId} and company_id = ${c.company_id}`;
    return { domain: c.domain, outcome: "error" };
  }
}

async function finishOrFindMore(runId: number) {
  const [run] = (await sql()`select trigger, status, counts from runs where id = ${runId}`) as { trigger: string; status: string; counts: { rounds?: number } }[];
  if (!run || run.status !== "running") return;
  const busy = (await sql()`select 1 from run_companies where run_id = ${runId} and status in ('queued', 'researching') limit 1`) as unknown[];
  if (busy.length) return;
  const [go] = (await sql()`select count(*)::int as n from decisions where run_id = ${runId} and outcome in ('go', 'go_flag')`) as { n: number }[];
  if (run.trigger !== "domains" && go.n < FIND_MORE.minGo && (run.counts.rounds ?? 0) < FIND_MORE.maxRounds + 1) {
    const added = await findCompanies(runId, await suppressed()).catch(() => 0);
    if (added > 0) return;
  }
  const counts = (await sql()`select
      count(*) filter (where rc.status = 'qualified')::int as researched,
      count(*) filter (where rc.status = 'failed')::int as failed,
      count(*) filter (where rc.status = 'skipped')::int as skipped,
      count(*) filter (where d.outcome in ('go', 'go_flag'))::int as go,
      count(*) filter (where d.outcome = 'human')::int as human,
      count(*) filter (where d.outcome = 'no_go')::int as no_go
    from run_companies rc left join decisions d on d.company_id = rc.company_id and d.run_id = rc.run_id
    where rc.run_id = ${runId}`) as Record<string, number>[];
  await sql()`update runs set status = 'done', finished_at = now(), counts = counts || ${JSON.stringify(counts[0])}::jsonb where id = ${runId}`;
}

export async function runUntil(runId: number, deadlineMs: number) {
  const done: { domain: string; outcome: string }[] = [];
  while (Date.now() < deadlineMs) {
    const r = await processNext(runId);
    if (!r) break;
    done.push(r);
  }
  return done;
}

export async function runProgress(runId: number) {
  const [run] = (await sql()`select id, trigger, status, counts, started_at, finished_at from runs where id = ${runId}`) as Record<string, unknown>[];
  const rows = (await sql()`select status, count(*)::int as n from run_companies where run_id = ${runId} group by status`) as { status: string; n: number }[];
  return { run, byStatus: Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number> };
}

