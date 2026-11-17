import { describe, expect, it } from "vitest";
import { cleanHtml } from "@/lib/research/clean";
import type { Fact, QuestionId } from "@/lib/research/evidence";
import { type LoopDeps, type PageOut, research } from "@/lib/research/loop";
import { COMPETITOR_SECURITY, SAAS_HOME } from "./fixtures/pages";

type Site = Record<string, string | { failure: PageOut["failure"] }>;

// A fake web: pages by URL, a fake model that "finds" fields by keyword, a fake search.
function deps(site: Site, opts: { jobs?: unknown; search?: Fact[]; extractMap?: Record<string, Fact[]> } = {}) {
  const calls = { pages: [] as string[], extracts: 0, json: [] as string[] };
  let clock = 0;
  const d: LoopDeps = {
    now: () => (clock += 100),
    page: async (url) => {
      calls.pages.push(url);
      const key = url.replace(/\/$/, "");
      const v = site[key];
      if (v === undefined) return { url, status: 404, via: "plain", failure: "http_error", text: null, links: [], fetchCount: 1 };
      if (typeof v !== "string") return { url, status: 200, via: "plain", failure: v.failure, text: null, links: [], fetchCount: 1 };
      const c = cleanHtml(v, url);
      return { url, status: 200, via: "plain", failure: null, text: c.text, links: c.links, fetchCount: 1 };
    },
    json: async (url) => {
      calls.json.push(url);
      return url.includes("ashbyhq") && opts.jobs ? opts.jobs : null;
    },
    extract: async (url, _text, open: QuestionId[]) => {
      calls.extracts++;
      const kept = (opts.extractMap?.[url.replace(/\/$/, "")] ?? []).filter((f) => open.includes(f.question));
      return { kept, dropped: 0 };
    },
    search: async () => opts.search ?? [],
  };
  return { d, calls };
}

const f = (question: Fact["question"], field: string, value: string, url = "https://quillpay.io"): Fact => ({ question, field, value, quote: "q", sourceUrl: url, rung: "scrape", verified: true });

describe("research loop (FR-3, Loop 1)", () => {
  it("reads the homepage, the job-board API, then search, and stops when every question is answered", async () => {
    const home = "https://quillpay.io";
    const { d, calls } = deps(
      { [home]: SAAS_HOME, [`${home}/security`]: "<main><p>We are working towards SOC 2 Type II and keep customer data encrypted at rest.</p></main>" },
      {
        jobs: { jobs: [{ title: "GRC Analyst", descriptionPlain: "You will own our SOC 2 Type II readiness. We run on AWS.", jobUrl: "https://jobs.ashbyhq.com/quillpay/1" }] },
        search: [f("Q3", "employees", "85"), f("Q6", "funding_round", "Series B"), f("Q8", "geography", "US")],
        extractMap: {
          [home]: [f("Q1", "pricing_plans", "plans"), f("Q1", "demo_or_trial", "Book a demo"), f("Q5", "big_logos", "Northwind Bank, Contoso Health, Fabrikam Insurance"), f("Q7", "industry", "fintech")],
          [`${home}/security`]: [f("Q2", "in_progress", "SOC 2 Type II")],
        },
      },
    );
    const r = await research("quillpay.io", d);
    expect(r.stop).toBe("all_answered");
    expect(calls.json[0]).toContain("api.ashbyhq.com/posting-api/job-board/quillpay");
    expect(r.facts.some((x) => x.question === "Q4" && x.rung === "api")).toBe(true);
    expect(r.facts.some((x) => x.question === "Q8" && x.field === "cloud" && x.value === "AWS")).toBe(true);
    expect(r.timeline[0].why).toBe("Seed: homepage");
    expect(r.fetches).toBeLessThanOrEqual(15);
  });

  it("short-circuits as soon as a competitor trust center is found, before spending more", async () => {
    const home = "https://kitebase.io";
    const { d } = deps({ [home]: `<a href="/security">Security</a>${"<p>Kitebase is the analytics platform for revenue teams at growing B2B companies.</p>"}`, [`${home}/security`]: COMPETITOR_SECURITY }, {
      extractMap: { [home]: [f("Q1", "pricing_plans", "plans"), f("Q1", "business_language", "for revenue teams")] },
    });
    const r = await research("kitebase.io", d);
    expect(r.stop).toBe("short_circuit");
    expect(r.stopDetail).toMatch(/Vanta/);
    expect(r.facts.find((x) => x.field === "trust_center_tool")?.quote).toContain("trust.vanta.com");
  });

  it("never exceeds the fetch budget", async () => {
    const { d } = deps({ "https://slow.io": "<p>A company page with almost nothing useful written on it at all here.</p>" });
    const r = await research("slow.io", d, { maxFetches: 6, maxMs: 120_000 });
    expect(r.fetches).toBeLessThanOrEqual(6);
    expect(["budget", "no_sources"]).toContain(r.stop);
  });

  it("respects a block: records the reason and keeps going with other sources", async () => {
    const { d } = deps({ "https://blocked.io": { failure: "bot_check" } }, { search: [f("Q3", "employees", "40")] });
    const r = await research("blocked.io", d, { maxFetches: 8, maxMs: 120_000 });
    expect(r.timeline[0].failure).toBe("bot_check");
    expect(r.timeline[0].result).toMatch(/Not usable: bot check/);
    expect(r.facts.some((x) => x.question === "Q3")).toBe(true);
  });
});

describe("Q4 detector", async () => {
  const { complianceJobFacts } = await import("@/lib/research/detect");
  it("counts a GRC role but not a generic security engineer", () => {
    const facts = complianceJobFacts([
      { title: "Founding GRC Analyst", text: "Own our SOC 2 audit.", url: "u1" },
      { title: "Senior Application Security Engineer", text: "Secure our APIs and run threat models.", url: "u2" },
    ]);
    expect(facts).toHaveLength(1);
    expect(facts[0].value).toContain("GRC");
  });
  it("counts a security engineer only when the job names a framework", () => {
    const facts = complianceJobFacts([{ title: "Security Engineer", text: "You will lead our ISO 27001 certification.", url: "u3" }]);
    expect(facts[0].value).toMatch(/ISO 27001/);
  });
});
