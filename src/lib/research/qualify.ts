// Qualify (FR-4): a pure function of the facts and the ICP version, so the same dossier
// and the same rules always give the same answer.
import { type Fact, type QuestionId, facts_, parseEmployees, shortCircuit } from "./evidence";

export type Weights = {
  audit_prep: number; enterprise_pressure: number; funding_a_to_c: number; client_size: number;
  regulated_industry: number; cloud_stack: number; geography: number;
};
export type Thresholds = {
  go_score: number; near_miss_min: number; employees_min: number; employees_max: number;
  employees_drop_below: number; employees_drop_above: number;
};

export type Outcome = "go" | "go_flag" | "human" | "no_go";
export type Reason = { text: string; factIndex?: number };

export type Decision = {
  outcome: Outcome;
  score: number;
  gates: Record<"saas" | "not_served" | "size", "pass" | "fail" | "unknown">;
  triggers: { audit_prep: boolean; enterprise_pressure: boolean };
  reasons: Reason[];
  flags: string[];
  nearMiss: boolean; // score in the near-miss band; research may run once more
};

const REGULATED = ["fintech", "healthtech", "hrtech", "data_ai", "legaltech", "government"];
const GEOS = ["us", "uk", "eu", "india", "anz"];

function cite(facts: Fact[], f: Fact | undefined, text: string): Reason {
  return { text, factIndex: f ? facts.indexOf(f) : undefined };
}

export function qualify(facts: Fact[], w: Weights, t: Thresholds): Decision {
  const reasons: Reason[] = [];
  const flags: string[] = [];
  const first = (q: QuestionId, field: string) => facts_(facts, q, field)[0];

  // Short-circuits are instant No-go with the reason.
  const sc = shortCircuit(facts);
  if (sc) {
    const f = facts.find((x) => x.question === sc.question);
    return {
      outcome: "no_go", score: 0,
      gates: { saas: sc.question === "Q1" ? "fail" : "unknown", not_served: sc.question === "Q2" ? "fail" : "unknown", size: sc.question === "Q3" ? "fail" : "unknown" },
      triggers: { audit_prep: false, enterprise_pressure: false },
      reasons: [cite(facts, f, sc.reason)], flags: [], nearMiss: false,
    };
  }

  // Gate 1: B2B SaaS (2 of 4 signals).
  const saasSignals = ["pricing_plans", "demo_or_trial", "app_login", "business_language"].filter((f) => first("Q1", f));
  const saas: Decision["gates"]["saas"] = saasSignals.length >= 2 ? "pass" : "unknown";
  if (saas === "pass") reasons.push(cite(facts, first("Q1", saasSignals[0]), `B2B SaaS (${saasSignals.length} signals)`));

  // Gate 2: not already served. No trust page found = most likely not certified yet: a positive, flagged.
  const tool = first("Q2", "trust_center_tool");
  const certs = first("Q2", "certifications");
  const notServed = "pass" as const;
  if (!tool && !certs) flags.push("No security or trust page found: likely not certified yet");
  else if (certs) reasons.push(cite(facts, certs, `Holds ${certs.value}; may need the next framework`));

  // Gate 3: size.
  const emp = facts_(facts, "Q3", "employees").map((f) => ({ f, r: parseEmployees(f.value) })).find((x) => x.r);
  let size: Decision["gates"]["size"] = "unknown";
  if (emp?.r) {
    const mid = Math.round((emp.r.min + emp.r.max) / 2);
    if (mid >= t.employees_min && mid <= t.employees_max) {
      size = "pass";
      reasons.push(cite(facts, emp.f, `${emp.f.value} employees`));
    } else {
      // 10-19 and 501-1000 are neither a pass nor a drop: a human decides.
      flags.push(`Size ${emp.f.value} is outside ${t.employees_min}-${t.employees_max}`);
    }
  }

  // Triggers.
  const audit = first("Q4", "compliance_job") ?? first("Q4", "audit_statement") ?? first("Q2", "in_progress");
  const ent = ["enterprise_tier", "enterprise_case_study", "security_review_page", "sso_saml"].map((f) => first("Q5", f)).find(Boolean);
  const logos = facts_(facts, "Q5", "big_logos").flatMap((f) => f.value.split(",")).filter((x) => x.trim());
  const enterprise = Boolean(ent) || logos.length >= 3;
  if (audit) reasons.push(cite(facts, audit, `Preparing for an audit: ${audit.value}`));
  if (enterprise) reasons.push(cite(facts, ent ?? first("Q5", "big_logos"), ent ? `Enterprise pressure: ${ent.value}` : `Enterprise pressure: ${logos.length} large customers`));

  // Score.
  let score = 0;
  const unknown: string[] = [];
  if (audit) score += w.audit_prep;
  if (enterprise) score += w.enterprise_pressure;

  const round = first("Q6", "funding_round");
  if (!round) unknown.push("funding stage");
  else if (/series [abc]\b/i.test(round.value)) {
    score += w.funding_a_to_c;
    reasons.push(cite(facts, round, `${round.value}${first("Q6", "funding_date") ? ` (${first("Q6", "funding_date")!.value})` : ""}`));
  }

  const clientSize = first("Q7", "client_size");
  if (!clientSize) unknown.push("client size");
  else if (/yes/i.test(clientSize.value)) score += w.client_size;

  const industry = first("Q7", "industry");
  if (!industry) unknown.push("industry");
  else if (REGULATED.some((r) => industry.value.toLowerCase().includes(r))) {
    score += w.regulated_industry;
    reasons.push(cite(facts, industry, `Regulated industry: ${industry.value}`));
  }

  // Cloud: assume yes when unknown (almost all SaaS runs on cloud), no penalty.
  const cloud = first("Q8", "cloud");
  if (!cloud || /aws|gcp|google|azure/i.test(cloud.value)) score += w.cloud_stack;

  const geo = first("Q8", "geography");
  if (!geo) unknown.push("geography");
  else if (GEOS.some((g) => geo.value.toLowerCase().includes(g))) score += w.geography;

  const base = { score, gates: { saas, not_served: notServed, size }, triggers: { audit_prep: Boolean(audit), enterprise_pressure: enterprise }, reasons };

  // The 'one unknown' rule.
  if (saas !== "pass" || size !== "pass") {
    const missing = [saas !== "pass" && "SaaS signals", size !== "pass" && "headcount"].filter(Boolean).join(" and ");
    return { ...base, outcome: "human", flags: [...flags, `Gate not proven: ${missing}`], nearMiss: false };
  }
  if (!audit && !enterprise) {
    return { ...base, outcome: "no_go", reasons: [...reasons, { text: "No reason to buy now: no audit prep or enterprise pressure found" }], flags, nearMiss: false };
  }
  if (score >= t.go_score) {
    if (unknown.length) return { ...base, outcome: "go_flag", flags: [...flags, `Unknown: ${unknown.join(", ")}`], nearMiss: false };
    return { ...base, outcome: "go", flags, nearMiss: false };
  }
  return {
    ...base, outcome: "no_go",
    reasons: [...reasons, { text: `Score ${score} is below ${t.go_score}` }],
    flags, nearMiss: score >= t.near_miss_min,
  };
}
