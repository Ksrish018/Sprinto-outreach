import "server-only";
// The company pool (v5 discovery): news feeds -> funding headlines -> companies -> compliance pre-check -> ranked pool.
import { sql } from "../db";
import { env } from "../env";
import { Gemini } from "../gemini";
import { domainsInHubspot } from "../hubspot";
import { record } from "../ledger";
import { normaliseDomain } from "../research/domains";
import { Fetcher } from "../research/fetcher";
import { USER_AGENT } from "../research/robots";
import { BATCH, type Headline, extractLeads } from "./headlines";
import { precheck } from "./precheck";
import { excludedRound, priority } from "./rank";
import { cleanTitle, parseFeed } from "./rss";
import { FEEDS, FUNDING_RE } from "./sources";

const POOL_DAYS = 30;
const COOLDOWN_DAYS = 90;
const MAX_NEW_HEADLINES = 150; // per read, to keep the AI cost of one read bounded
const PRECHECK_CONCURRENCY = 4;

function gemini() {
  const e = env();
  return new Gemini({ apiKey: e.GEMINI_API_KEY, model: e.GEMINI_MODEL, onCall: (kind) => record(kind, "generateContent", {}) });
}

export type ReadResult = { feeds: number; items: number; funding: number; newHeadlines: number; newLeads: number; failedFeeds: string[] };

// Step ③: read every feed, keep funding headlines not seen before, turn them into companies.
export async function readFeeds(): Promise<ReadResult> {
  const q = sql();
  const out: ReadResult = { feeds: 0, items: 0, funding: 0, newHeadlines: 0, newLeads: 0, failedFeeds: [] };
  const fresh: Headline[] = [];
  const perFeed = new Map<string, { items: number; funding: number; leads: number }>();

  await Promise.all(
    FEEDS.map(async (f) => {
      try {
        const res = await fetch(f.url, { headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(30_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const items = parseFeed(await res.text());
        const funding = items.filter((it) => FUNDING_RE.test(it.title));
        perFeed.set(f.id, { items: items.length, funding: funding.length, leads: 0 });
        out.feeds++;
        out.items += items.length;
        out.funding += funding.length;
        for (const it of funding) {
          const title = f.id.startsWith("gnews") ? cleanTitle(it.title) : it.title;
          fresh.push({ i: 0, title, summary: f.id.startsWith("gnews") ? "" : it.summary, feed: f.id, link: it.link, published: it.published });
        }
      } catch (err) {
        out.failedFeeds.push(f.name);
        await q`insert into feed_reads (feed, ok, error) values (${f.id}, false, ${(err as Error).message.slice(0, 120)})`;
      }
    }),
  );

  // Only headlines never read before reach the AI.
  const urls = fresh.map((h) => h.link);
  const seen = new Set(((await q`select url from feed_items where url = any(${urls})`) as { url: string }[]).map((r) => r.url));
  const byTitle = new Map<string, Headline>();
  for (const h of fresh) if (!seen.has(h.link) && !byTitle.has(h.title.toLowerCase())) byTitle.set(h.title.toLowerCase(), h);
  const todo = [...byTitle.values()].slice(0, MAX_NEW_HEADLINES).map((h, i) => ({ ...h, i: i + 1 }));
  out.newHeadlines = todo.length;

  const g = gemini();
  const extracted: { h: Headline; company: string; domain: string | null; round: string; amount: string; sector: string; saas: string }[] = [];
  for (let s = 0; s < todo.length; s += BATCH) {
    const batch = todo.slice(s, s + BATCH);
    try {
      for (const r of await extractLeads(g, batch)) extracted.push({ ...r, h: batch.find((h) => h.i === r.i)! });
      for (const h of batch) await q`insert into feed_items (url, feed) values (${h.link}, ${h.feed}) on conflict do nothing`;
    } catch {
      // A failed batch is not marked as read, so tomorrow's read tries it again.
    }
  }

  // Companies the AI could not name a website for: one grounded search per batch finds the official site.
  const missing = extracted.filter((e) => !e.domain && e.saas !== "no");
  for (let s = 0; s < missing.length; s += 15) {
    const batch = missing.slice(s, s + 15);
    try {
      const { data } = await g.grounded<{ company: string; domain: string }[]>(
        `Find the official website domain of each company below (the company itself, not a news site or investor). ` +
          `Reply with JSON only: an array of {"company": "...", "domain": "acme.com"}; use "" if unsure.\n` +
          batch.map((e) => `- ${e.company} (${e.sector}; ${e.h.title})`).join("\n"),
      );
      for (const d of Array.isArray(data) ? data : []) {
        const e = batch.find((x) => x.company.toLowerCase() === (d.company ?? "").toLowerCase());
        if (e && d.domain) e.domain = normaliseDomain(d.domain);
      }
    } catch {
      // Left without a website: these headlines are skipped this time.
    }
  }

  for (const e of extracted) {
    if (!e.domain) continue;
    const excluded = e.saas === "no" ? `Not B2B SaaS (${e.sector})` : excludedRound(e.round) ? `Round not in the ICP (${e.round})` : null;
    const rows = (await q`insert into leads (domain, name, round, amount, sector, saas, headline, article_url, feed, published_at, status, status_reason)
      values (${e.domain}, ${e.company}, ${e.round}, ${e.amount || null}, ${e.sector}, ${e.saas}, ${e.h.title}, ${e.h.link}, ${e.h.feed},
        ${e.h.published}, ${excluded ? "excluded" : "new"}, ${excluded})
      on conflict (domain) do nothing returning id`) as { id: number }[];
    if (rows.length && !excluded) {
      out.newLeads++;
      const pf = perFeed.get(e.h.feed);
      if (pf) pf.leads++;
    }
  }
  for (const [feed, c] of perFeed) {
    await q`insert into feed_reads (feed, ok, items, funding, new_leads) values (${feed}, true, ${c.items}, ${c.funding}, ${c.leads})`;
  }
  return out;
}

export type CheckResult = { checked: number; ready: number; compliant: number; excluded: number; unreachable: number };

// Step ④ for every new company in the pool, until the deadline. Suppression, HubSpot and the 90-day rule apply here too.
export async function precheckPool(deadlineMs: number): Promise<CheckResult> {
  const q = sql();
  const out: CheckResult = { checked: 0, ready: 0, compliant: 0, excluded: 0, unreachable: 0 };
  await q`update leads set status = 'expired', status_reason = ${`Not researched within ${POOL_DAYS} days`}, updated_at = now()
    where status in ('new', 'ready') and first_seen_at < now() - make_interval(days => ${POOL_DAYS})`;

  const pending = (await q`select id, domain, name, round, saas, sector, published_at from leads where status = 'new' order by first_seen_at limit 60`) as {
    id: number; domain: string; name: string; round: string | null; saas: string; sector: string | null; published_at: string | null;
  }[];
  if (!pending.length) return out;

  const suppressed = new Set(((await q`select domain from suppression`) as { domain: string }[]).map((r) => r.domain));
  const recent = new Set(((await q`select domain from companies where last_researched_at > now() - make_interval(days => ${COOLDOWN_DAYS})`) as { domain: string }[]).map((r) => r.domain));
  const inHubspot = await domainsInHubspot(pending.map((p) => p.domain)).catch(() => new Set<string>());

  const fetcher = new Fetcher(fetch, () => record("jina", "r.jina.ai", {}));
  const page = (url: string) => fetcher.page(url);
  let next = 0;
  const worker = async () => {
    while (next < pending.length && Date.now() < deadlineMs) {
      const l = pending[next++];
      out.checked++;
      const skip = suppressed.has(l.domain) ? "Sprinto customer, competitor or Sprinto itself"
        : recent.has(l.domain) ? `Researched in the last ${COOLDOWN_DAYS} days`
        : inHubspot.has(l.domain) ? "Already in HubSpot" : null;
      if (skip) {
        out.excluded++;
        await q`update leads set status = 'excluded', status_reason = ${skip}, updated_at = now() where id = ${l.id}`;
        continue;
      }
      try {
        const pc = await precheck(page, l.domain, l.name);
        const stored = JSON.stringify({ ...pc, checked_at: new Date().toISOString() });
        if (pc.verdict === "uses_tool") {
          out.compliant++;
          await q`update leads set status = 'compliant', precheck = ${stored}::jsonb, status_reason = ${`Uses ${pc.tool}: already served`}, updated_at = now() where id = ${l.id}`;
        } else if (pc.verdict === "unreachable" || pc.verdict === "mismatch") {
          out.unreachable++;
          const why = pc.verdict === "mismatch" ? `Website ${l.domain} does not mention ${l.name}` : "Website could not be read";
          await q`update leads set status = 'unreachable', precheck = ${stored}::jsonb, status_reason = ${why}, updated_at = now() where id = ${l.id}`;
        } else {
          out.ready++;
          const p = priority({ round: l.round, saas: l.saas, sector: l.sector, published: l.published_at, precheck: pc.verdict });
          const why = pc.verdict === "certified" ? `Shows ${pc.badges.join(", ")} but no compliance tool: renewal or next-framework angle` : "No sign of compliance yet";
          await q`update leads set status = 'ready', precheck = ${stored}::jsonb, priority = ${p}, status_reason = ${why}, updated_at = now() where id = ${l.id}`;
        }
      } catch (err) {
        out.unreachable++;
        await q`update leads set status = 'unreachable', status_reason = ${`Pre-check failed: ${(err as Error).message.slice(0, 80)}`}, updated_at = now() where id = ${l.id}`;
      }
    }
  };
  await Promise.all(Array.from({ length: PRECHECK_CONCURRENCY }, worker));
  return out;
}

// Highest-priority companies ready for research; marked queued so no other run takes them.
export async function takeFromPool(limit: number): Promise<{ id: number; domain: string; name: string; why: string }[]> {
  return (await sql()`update leads set status = 'queued', updated_at = now()
    where id in (select id from leads where status = 'ready' order by priority desc, published_at desc nulls last limit ${limit})
    returning id, domain, name, coalesce(round, '') || ' · ' || coalesce(sector, '') || ' · ' || headline || ' (' || status_reason || ')' as why`) as {
    id: number; domain: string; name: string; why: string;
  }[];
}

export type PoolFunnel = { headlines7d: number; funding7d: number; leads: number; byStatus: Record<string, number>; lastRead: string | null; feeds: { feed: string; ok: boolean; items: number; funding: number; new_leads: number; read_at: string }[] };

export async function poolFunnel(): Promise<PoolFunnel> {
  const q = sql();
  const [r] = (await q`select coalesce(sum(items), 0)::int as items, coalesce(sum(funding), 0)::int as funding, max(read_at) as last
    from feed_reads where read_at > now() - interval '7 days'`) as { items: number; funding: number; last: string | null }[];
  const st = (await q`select status, count(*)::int as n from leads group by status`) as { status: string; n: number }[];
  const feeds = (await q`select distinct on (feed) feed, ok, items, funding, new_leads, read_at from feed_reads order by feed, read_at desc`) as PoolFunnel["feeds"];
  const byStatus = Object.fromEntries(st.map((s) => [s.status, s.n]));
  return { headlines7d: r.items, funding7d: r.funding, leads: st.reduce((a, s) => a + s.n, 0), byStatus, lastRead: r.last, feeds };
}
