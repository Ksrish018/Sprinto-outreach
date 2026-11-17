import { describe, expect, it } from "vitest";
import { type Fact, isAnswered, parseEmployees, shortCircuit } from "@/lib/research/evidence";
import { qualify } from "@/lib/research/qualify";

const W = { audit_prep: 30, enterprise_pressure: 25, funding_a_to_c: 15, client_size: 10, regulated_industry: 10, cloud_stack: 5, geography: 5 };
const T = { go_score: 50, near_miss_min: 45, employees_min: 20, employees_max: 500, employees_drop_below: 10, employees_drop_above: 1000 };

const f = (question: Fact["question"], field: string, value: string): Fact => ({ question, field, value, quote: `quote for ${field}`, sourceUrl: "https://x.io/p", rung: "scrape", verified: true });

const SAAS = [f("Q1", "pricing_plans", "per seat"), f("Q1", "demo_or_trial", "Book a demo")];
const SIZE = [f("Q3", "employees", "85")];
const AUDIT = [f("Q4", "compliance_job", "Hiring: GRC Analyst")];
const FULL_SCORE = [f("Q6", "funding_round", "Series B"), f("Q7", "industry", "fintech"), f("Q7", "client_size", "yes"), f("Q8", "cloud", "AWS"), f("Q8", "geography", "US, EU")];

describe("qualify (FR-4)", () => {
  it("Go: all gates, a trigger and score >= 50, with reasons linked to facts", () => {
    const d = qualify([...SAAS, ...SIZE, ...AUDIT, ...FULL_SCORE], W, T);
    expect(d.outcome).toBe("go");
    expect(d.score).toBe(30 + 15 + 10 + 10 + 5 + 5);
    expect(d.reasons.length).toBeGreaterThan(0);
    expect(d.reasons.every((r) => r.factIndex === undefined || r.factIndex >= 0)).toBe(true);
  });

  it("is deterministic: same facts and rules give the same decision", () => {
    const facts = [...SAAS, ...SIZE, ...AUDIT, ...FULL_SCORE];
    expect(qualify(facts, W, T)).toEqual(qualify(facts, W, T));
  });

  it("FR-4.3: a gate unknown means Human review, never Go", () => {
    const d = qualify([...SAAS, ...AUDIT, ...FULL_SCORE], W, T);
    expect(d.outcome).toBe("human");
    expect(d.flags.join(" ")).toMatch(/headcount/);
  });

  it("FR-4.4: no trigger means No-go", () => {
    const d = qualify([...SAAS, ...SIZE, ...FULL_SCORE], W, T);
    expect(d.outcome).toBe("no_go");
    expect(d.reasons.at(-1)?.text).toMatch(/No reason to buy now/);
  });

  it("FR-4.5: only score items unknown means Go-and-flag", () => {
    const d = qualify([...SAAS, ...SIZE, ...AUDIT, f("Q5", "enterprise_tier", "Enterprise plan")], W, T);
    expect(d.outcome).toBe("go_flag");
    expect(d.flags.join(" ")).toMatch(/Unknown: funding stage/);
  });

  it("FR-4.6: a score in the near-miss band is marked for one more round", () => {
    const d = qualify([...SAAS, ...SIZE, ...AUDIT, f("Q6", "funding_round", "Seed"), f("Q7", "industry", "fintech"), f("Q7", "client_size", "no"), f("Q8", "geography", "other")], W, T);
    expect(d.score).toBe(45);
    expect(d.outcome).toBe("no_go");
    expect(d.nearMiss).toBe(true);
  });

  it("sizes between the drop line and the ICP band go to a human", () => {
    const d = qualify([...SAAS, f("Q3", "employees", "700"), ...AUDIT, ...FULL_SCORE], W, T);
    expect(d.outcome).toBe("human");
  });

  it.each([
    [[f("Q1", "not_saas", "digital agency")], /Not B2B SaaS/],
    [[f("Q2", "trust_center_tool", "Vanta")], /Vanta/],
    [[f("Q2", "trust_center_tool", "Sprinto")], /Sprinto customer/],
    [[f("Q2", "certifications", "SOC 2, ISO 27001, HIPAA, GDPR")], /4 or more/],
    [[f("Q3", "employees", "5")], /Too small/],
    [[f("Q3", "employees", "2,500")], /Too large/],
    [[f("Q6", "funding_round", "public")], /Public/],
    [[f("Q8", "cloud", "on_prem_only")], /On-premise/],
  ])("short-circuits to No-go: %#", (facts, re) => {
    const d = qualify([...SAAS, ...SIZE, ...AUDIT, ...(facts as Fact[])], W, T);
    expect(d.outcome).toBe("no_go");
    expect(d.reasons[0].text).toMatch(re as RegExp);
  });
});

describe("Evidence Map rules", () => {
  const s = { checkedTrustAddresses: 0, trustPageRead: false, checkedPages: [] };
  it("Q1 needs two SaaS signals", () => {
    expect(isAnswered("Q1", [SAAS[0]], s)).toBe(false);
    expect(isAnswered("Q1", SAAS, s)).toBe(true);
  });
  it("Q2 is answered once 4 trust addresses were checked, even with nothing found", () => {
    expect(isAnswered("Q2", [], s)).toBe(false);
    expect(isAnswered("Q2", [], { ...s, checkedTrustAddresses: 4 })).toBe(true);
  });
  it("Q5 needs an enterprise tier, a case study, SSO, a security-review page or 3 big logos", () => {
    expect(isAnswered("Q5", [f("Q5", "big_logos", "A, B")], s)).toBe(false);
    expect(isAnswered("Q5", [f("Q5", "big_logos", "A, B, C")], s)).toBe(true);
  });
  it("parses headcount ranges", () => {
    expect(parseEmployees("51-200")).toEqual({ min: 51, max: 200 });
    expect(parseEmployees("about 1.2k")).toEqual({ min: 1200, max: 1200 });
    expect(parseEmployees("unknown")).toBeNull();
  });
  it("no short-circuit on a clean dossier", () => {
    expect(shortCircuit([...SAAS, ...SIZE])).toBeNull();
  });
});

describe("No-go beats Human review when Go is impossible", () => {
  it("an unproven gate with no trigger is No-go, not human", () => {
    expect(qualify([...SIZE, ...FULL_SCORE], W, T).outcome).toBe("no_go");
  });
  it("an unproven gate with a trigger but no path to 50 is No-go", () => {
    const d = qualify([...SIZE, f("Q5", "sso_saml", "yes"), f("Q6", "funding_round", "Seed"), f("Q7", "industry", "other"), f("Q7", "client_size", "no"), f("Q8", "geography", "US")], W, T);
    expect(d.score).toBeLessThan(50);
    expect(d.outcome).toBe("no_go");
    expect(d.reasons.at(-1)?.text).toMatch(/cannot reach/);
  });
  it("an unproven gate on a company that could be Go still goes to a human", () => {
    expect(qualify([...SIZE, ...AUDIT, ...FULL_SCORE], W, T).outcome).toBe("human");
  });
});
