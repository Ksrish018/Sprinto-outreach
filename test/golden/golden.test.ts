// Golden set (PRD §12.3): live Gemini, live page fetches, no Hunter. Run with `npm run golden`.
// Never part of CI. Every model call is written to the API ledger as test "golden".
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";
import { Gemini } from "@/lib/gemini";
import { extractFromPage, searchCompany } from "@/lib/research/extract";
import { Fetcher } from "@/lib/research/fetcher";
import { assess } from "@/lib/research/assess";
import type { LoopDeps } from "@/lib/research/loop";
import type { Thresholds, Weights } from "@/lib/research/qualify";
import labels from "./labels.json";

const MAX_GEMINI_CALLS = 150;
const live = process.env.LIVE_APIS === "on";

describe.runIf(live)("golden set", () => {
  it("gets at least 9 of 10 hand-labelled companies right within budget", { timeout: 40 * 60_000 }, async () => {
    const db = neon(process.env.DATABASE_URL!);
    const [icp] = (await db`select weights, thresholds from icp_versions order by id desc limit 1`) as { weights: Weights; thresholds: Thresholds }[];
    let calls = 0;
    const g = new Gemini({
      apiKey: process.env.GEMINI_API_KEY!,
      model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
      onCall: async (kind) => {
        calls++;
        if (calls > MAX_GEMINI_CALLS) throw new Error(`Golden set exceeded ${MAX_GEMINI_CALLS} Gemini calls`);
        await db`insert into api_ledger (test_id, api, endpoint) values ('golden', ${kind}, 'generateContent')`;
      },
    });

    const suppressed = new Set(((await db`select domain from suppression`) as { domain: string }[]).map((r) => r.domain));
    const report: Record<string, unknown>[] = [];
    let correct = 0;
    const only = process.env.GOLDEN_ONLY?.split(",");
    for (const c of labels.companies.filter((x) => !only || only.includes(x.domain))) {
      if (suppressed.has(c.domain)) {
        // Exactly what a real run does (FR-2.4): never researched, never prospected.
        const ok = c.label === "no_go";
        if (ok) correct++;
        report.push({ domain: c.domain, label: c.label, outcome: "no_go", ok, geminiCalls: 0, stop: "On the suppression list" });
        console.log(`${ok ? "PASS" : "MISS"} ${c.domain}: label ${c.label}, suppressed (0 calls)`);
        continue;
      }
      const fetcher = new Fetcher(fetch, async () => {
        await db`insert into api_ledger (test_id, api, endpoint) values ('golden', 'jina', 'r.jina.ai')`;
      });
      const deps: LoopDeps = {
        now: () => Date.now(),
        page: async (url) => {
          const p = await fetcher.page(url);
          return { url, finalUrl: p.finalUrl, status: p.status, via: p.via, failure: p.failure, text: p.cleaned?.text ?? null, links: p.cleaned?.links ?? [], fetchCount: p.fetchCount, trustTool: p.trustTool };
        },
        json: (url) => fetcher.json(url),
        extract: (url, text, open, rung) => extractFromPage(g, c.domain, url, text, open, rung),
        search: () => searchCompany(g, c.name, c.domain),
      };
      const before = calls;
      let outcome = "error";
      let detail: Record<string, unknown> = {};
      try {
        const { result: r, decision: d } = await assess(c.domain, deps, icp);
        outcome = d.outcome;
        detail = {
          score: d.score, gates: d.gates, reasons: d.reasons.map((x) => x.text), flags: d.flags,
          stop: r.stopDetail, fetches: r.fetches,
          facts: r.facts.map((f) => `${f.question}.${f.field}=${f.value} [${f.rung}${f.verified ? "" : ", unverified"}] "${f.quote.slice(0, 120)}" <${f.sourceUrl}>`),
          failures: r.timeline.filter((s) => s.failure).map((s) => `${s.source}: ${s.failure}`),
        };
      } catch (err) {
        detail = { error: (err as Error).message };
      }
      const ok = c.label === "go" ? outcome === "go" || outcome === "go_flag" : outcome === "no_go";
      if (ok) correct++;
      report.push({ domain: c.domain, label: c.label, outcome, ok, geminiCalls: calls - before, ...detail });
      console.log(`${ok ? "PASS" : "MISS"} ${c.domain}: label ${c.label}, got ${outcome} (${calls - before} calls)`);
    }

    writeFileSync(join(__dirname, "last-report.json"), JSON.stringify({ at: new Date().toISOString(), correct, total: labels.companies.length, geminiCalls: calls, report }, null, 2));
    console.log(`Golden set: ${correct}/${labels.companies.length} correct, ${calls} Gemini calls`);
    expect(calls).toBeLessThanOrEqual(MAX_GEMINI_CALLS);
    if (!only) expect(correct).toBeGreaterThanOrEqual(9);
  });
});
