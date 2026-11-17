// Research + qualify + the one near-miss follow-up (FR-4.6), shared by real runs and the golden set,
// so the test exercises exactly the production path.
import { type LoopDeps, type ResearchResult, research } from "./loop";
import { type Decision, type Thresholds, type Weights, qualify } from "./qualify";

export async function assess(domain: string, deps: LoopDeps, icp: { weights: Weights; thresholds: Thresholds }): Promise<{ result: ResearchResult; decision: Decision }> {
  let result = await research(domain, deps);
  let decision = qualify(result.facts, icp.weights, icp.thresholds);
  if (decision.nearMiss) {
    const more = await research(domain, deps, { maxFetches: 5, maxMs: 60_000 }, { facts: result.facts, visited: result.pages.map((p) => p.url) });
    result = {
      ...more,
      timeline: [...result.timeline, ...more.timeline],
      pages: [...result.pages, ...more.pages],
      fetches: result.fetches + more.fetches,
      stopDetail: `${result.stopDetail}; near miss, researched once more: ${more.stopDetail}`,
    };
    decision = qualify(result.facts, icp.weights, icp.thresholds);
    decision.flags.push("Near miss: researched once more");
  }
  return { result, decision };
}
