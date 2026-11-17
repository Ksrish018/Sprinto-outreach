// The research loop (FR-3, Loop 1): seed -> read -> code judges -> stop or pick the next source.
// The model reads and fills fields; code decides when there is enough.
import type { Link } from "./clean";
import type { FailureReason } from "./classify";
import { type Board, type Job, boardPublicUrl, boardUrl, boardsFromLinks, cloudFromJobs, complianceJobFacts, parseJobs, trustToolFromLinks } from "./detect";
import { type Fact, PRIORITY, type QuestionId, type Rung, type SearchState, TRIES, isAnswered, shortCircuit } from "./evidence";

export type PageOut = {
  url: string; finalUrl?: string; status: number; via: "plain" | "jina"; failure: FailureReason | null; text: string | null; links: Link[]; fetchCount: number;
  trustTool?: { tool: string; evidence: string };
};

export type LoopDeps = {
  page: (url: string) => Promise<PageOut>;
  json: (url: string) => Promise<unknown | null>;
  extract: (url: string, text: string, open: QuestionId[], rung: Rung) => Promise<{ kept: Fact[]; dropped: number }>;
  search: () => Promise<Fact[]>;
  now: () => number;
};

export type Step = {
  source: string;
  rung: Rung;
  why: string;
  result: string;
  via?: "plain" | "jina";
  failure?: FailureReason | null;
  facts: number;
};

export type StopReason = "short_circuit" | "all_answered" | "budget" | "time" | "no_sources";

export type ResearchResult = {
  facts: Fact[];
  timeline: Step[];
  fetches: number;
  stop: StopReason;
  stopDetail: string;
  pages: PageOut[];
};

export const LIMITS = { maxFetches: 15, maxMs: 120_000 };

// Where each question usually lives, own pages first (Evidence Map column 3).
const PATHS: Record<QuestionId, string[]> = {
  Q1: ["/pricing", "/product", "/platform"],
  Q2: ["/security", "/trust", "trust.", "security."],
  Q3: ["/about", "/company", "/careers"],
  Q4: ["/careers", "/jobs", "/security"],
  Q5: ["/pricing", "/customers", "/enterprise", "/case-studies"],
  Q6: ["/press", "/news", "/newsroom"],
  Q7: ["/customers"],
  Q8: ["/security", "/docs"],
};
const KEYWORDS: Record<QuestionId, RegExp> = {
  Q1: /pricing|plans/i,
  Q2: /security|trust|compliance|soc ?2|privacy center/i,
  Q3: /about|company|team/i,
  Q4: /careers|jobs|join us|hiring|work with us/i,
  Q5: /customers|case stud|enterprise|success stor/i,
  Q6: /press|news|funding|raise/i,
  Q7: /customers|case stud/i,
  Q8: /security|infrastructure|docs/i,
};
const TRUST_ADDRESSES = ["/security", "/trust", "trust.", "security."];

function rootDomain(domain: string) {
  return domain.replace(/^www\./, "");
}

function toUrl(domain: string, p: string): string {
  if (p.endsWith(".")) return `https://${p}${rootDomain(domain)}/`;
  return `https://${rootDomain(domain)}${p}`;
}

function sameSite(href: string, domain: string): boolean {
  try {
    return new URL(href).hostname.replace(/^www\./, "").endsWith(rootDomain(domain));
  } catch {
    return false;
  }
}

// Near-miss follow-up (FR-4.6): resume from an earlier dossier, only for score questions, once.
export type Resume = { facts: Fact[]; visited: string[] };
const NEAR_MISS_TRIES: Record<QuestionId, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 1, Q5: 2, Q6: 1, Q7: 1, Q8: 1 };

export async function research(domain: string, deps: LoopDeps, limits = LIMITS, resume?: Resume): Promise<ResearchResult> {
  const start = deps.now();
  const facts: Fact[] = resume ? [...resume.facts] : [];
  const timeline: Step[] = [];
  const pages: PageOut[] = [];
  const visited = new Set<string>(resume?.visited.map((u) => u.replace(/\/$/, "")) ?? []);
  const tries: Record<QuestionId, number> = resume ? { ...NEAR_MISS_TRIES } : { ...TRIES };
  const state: SearchState = { checkedTrustAddresses: 0, trustPageRead: false, checkedPages: [] };
  let links: Link[] = [];
  let fetches = 0;

  const add = (fs: Fact[]) => {
    for (const f of fs) {
      if (!facts.some((x) => x.question === f.question && x.field === f.field && x.value === f.value)) facts.push(f);
    }
  };
  const open = () => PRIORITY.filter((q) => !isAnswered(q, facts, state));
  const done = (stop: StopReason, stopDetail: string): ResearchResult => ({ facts, timeline, fetches, stop, stopDetail, pages });
  const outOfBudget = () => fetches >= limits.maxFetches;
  // One page can cost up to 3 requests (robots.txt, the page, one Jina retry), so a page only
  // starts when all 3 still fit: the 15-fetch limit is never exceeded (FR-3.5).
  const PAGE_COST = 3;
  const noRoomForPage = () => fetches + PAGE_COST > limits.maxFetches;
  const outOfTime = () => deps.now() - start >= limits.maxMs;

  const triedBoards = new Set<string>();
  let jobs: Job[] = [];

  // Rung 1, official APIs: a public job board answers audit prep (Q4) and often the cloud (Q8).
  async function readBoards(boards: Board[], why: string): Promise<boolean> {
    for (const b of boards) {
      const key = `${b.kind}:${b.slug}`;
      if (triedBoards.has(key) || outOfBudget()) continue;
      triedBoards.add(key);
      const data = await deps.json(boardUrl(b)).catch(() => null);
      fetches++;
      const parsed = data ? parseJobs(b.kind, data, boardPublicUrl(b)) : [];
      if (!parsed.length) continue;
      jobs = parsed;
      const fs = [...complianceJobFacts(parsed)];
      const cloud = cloudFromJobs(parsed);
      if (cloud) fs.push(cloud);
      add(fs);
      timeline.push({ source: boardPublicUrl(b), rung: "api", why, result: `${parsed.length} open roles, ${fs.length} facts`, facts: fs.length });
      return true;
    }
    return false;
  }

  async function readPage(url: string, why: string): Promise<PageOut> {
    visited.add(url.replace(/\/$/, ""));
    const p = await deps.page(url);
    fetches += p.fetchCount;
    pages.push(p);
    state.checkedPages.push(url);
    const isTrustAddress = TRUST_ADDRESSES.some((t) => (t.endsWith(".") ? new URL(url).hostname.startsWith(t) : new URL(url).pathname.replace(/\/$/, "") === t));
    if (isTrustAddress) state.checkedTrustAddresses++;

    let found = 0;
    let note = "";
    if (p.trustTool) {
      add([{ question: "Q2", field: "trust_center_tool", value: p.trustTool.tool, quote: p.trustTool.evidence, sourceUrl: url, rung: "scrape", verified: true }]);
      state.trustPageRead = true;
      found++;
    }
    // A careers page that redirects to a public job board is read through that board's API.
    if (p.failure === "off_domain" && p.finalUrl) {
      const boards = boardsFromLinks([{ href: p.finalUrl, text: "" }]);
      if (boards.length && !jobs.length && (await readBoards(boards, "Careers page redirects to a job board"))) note = "; redirected to a job board, read via its API";
    }
    if (p.text) {
      links = [...links, ...p.links.filter((l) => !links.some((x) => x.href === l.href))];
      const tool = trustToolFromLinks(p.links, url);
      if (tool) {
        add([tool]);
        found++;
      }
      if (isTrustAddress) state.trustPageRead = true;
      const q = open();
      if (q.length) {
        // A failed model call costs this page, never the company (FR-1.5).
        try {
          const { kept } = await deps.extract(url, p.text, q, "scrape");
          add(kept);
          found += kept.length;
        } catch (err) {
          note = `; reading failed (${(err as Error).message.slice(0, 60)})`;
        }
      }
    }
    timeline.push({
      source: url, rung: "scrape", why, via: p.via, failure: p.failure, facts: found,
      result: (p.failure ? `Not usable: ${p.failure.replace("_", " ")}` : `${found} fact${found === 1 ? "" : "s"}`) + note,
    });
    return p;
  }

  // 1. Seed: the homepage.
  let sc = shortCircuit(facts);
  if (resume) return loop();

  // If the site blocks us we respect it and continue with sources that are not the website.
  await readPage(`https://${rootDomain(domain)}/`, "Seed: homepage");
  sc = shortCircuit(facts);
  if (sc) return done("short_circuit", sc.reason);

  // 2. Job boards linked from the site first, then the usual slugs.
  if (!jobs.length) {
    const boards: Board[] = [...boardsFromLinks(links)];
    const slug = rootDomain(domain).split(".")[0];
    for (const kind of ["ashby", "greenhouse", "lever"] as const) {
      if (!boards.some((b) => b.kind === kind)) boards.push({ kind, slug });
    }
    const ok = await readBoards(boards.slice(0, 4), "Job board API: open roles");
    if (!ok) timeline.push({ source: "Greenhouse, Lever, Ashby", rung: "api", why: "Job board API: open roles", result: "No public job board found", facts: 0 });
  }

  // 3. Rung 3, search: size, funding and markets in one grounded search.
  if (!outOfBudget()) {
    fetches++;
    try {
      const fs = await deps.search();
      add(fs);
      timeline.push({ source: "Google Search (via Gemini)", rung: "search", why: "Size, funding and markets", result: `${fs.length} facts`, facts: fs.length });
    } catch (err) {
      timeline.push({ source: "Google Search (via Gemini)", rung: "search", why: "Size, funding and markets", result: `Search failed (${(err as Error).message.slice(0, 60)})`, facts: 0 });
    }
  }

  return loop();

  // 4. The loop: most important open question first, its most likely page next.
  async function loop(): Promise<ResearchResult> {
    for (;;) {
      sc = shortCircuit(facts);
      if (sc) return done("short_circuit", sc.reason);
      const q = open().filter((x) => tries[x] > 0);
      if (!open().length) return done("all_answered", "Every question answered");
      if (!q.length) return done("no_sources", `Still open: ${open().join(", ")}`);
      if (noRoomForPage()) return done("budget", `Used ${fetches} of ${limits.maxFetches} fetches`);
      if (outOfTime()) return done("time", `Stopped after ${Math.round((deps.now() - start) / 1000)} s`);

      const target = q[0];
      const fromLinks = links
        .filter((l) => sameSite(l.href, domain) && (KEYWORDS[target].test(l.text) || KEYWORDS[target].test(new URL(l.href).pathname)))
        .map((l) => l.href.split("?")[0]);
      const candidates = [...fromLinks, ...PATHS[target].map((p) => toUrl(domain, p))]
        .filter((u) => !visited.has(u.replace(/\/$/, "")));
      const next = candidates[0];
      if (!next) {
        tries[target] = 0;
        continue;
      }
      tries[target]--;
      await readPage(next, `${target} still open: ${fromLinks.includes(next) ? "linked from the site" : "standard page"}`);
    }
  }
}
