// The Evidence Map (PRD §6, ICP and Evidence Map doc) as code.
// The model fills named fields; code decides whether each question is answered (FR-3.3, FR-3.4).

export type QuestionId = "Q1" | "Q2" | "Q3" | "Q4" | "Q5" | "Q6" | "Q7" | "Q8";
export type Rung = "api" | "provider" | "search" | "scrape";

export type Fact = {
  question: QuestionId;
  field: string;
  value: string;
  quote: string;
  sourceUrl: string;
  rung: Rung;
  verified: boolean; // quote found verbatim in the fetched source text
};

export const QUESTIONS: Record<QuestionId, { title: string; fields: Record<string, string> }> = {
  Q1: {
    title: "Is it a B2B SaaS company?",
    fields: {
      pricing_plans: "plan, tier or per-seat pricing for software",
      demo_or_trial: "a 'book a demo', 'start free trial' or 'get started' call to action",
      app_login: "a login to a web app (e.g. app.domain.com, 'Sign in')",
      business_language: "says it sells software to businesses or teams (e.g. 'for teams', 'for enterprises', 'platform for X companies')",
      not_saas: "evidence it is NOT B2B SaaS: agency, consultancy, services firm, e-commerce store, consumer app, hardware only",
    },
  },
  Q2: {
    title: "Already certified, or using a competitor?",
    // trust_center_tool is deliberately not here: the model confused vendors merely mentioned on a page
    // (integrations, comparisons) with the vendor hosting the trust center. Only code sets it (detect.ts, fetcher.ts).
    fields: {
      certifications: "compliance certifications it already holds: SOC 2, ISO 27001, HIPAA, GDPR, PCI DSS (value = comma-separated list)",
      in_progress: "a certification it says is in progress or being worked towards",
    },
  },
  Q3: {
    title: "Is it the right size?",
    fields: { employees: "number of employees or an employee range (value = a number or 'min-max')" },
  },
  Q4: {
    title: "Preparing for an audit?",
    fields: {
      audit_statement: "a statement such as 'SOC 2 in progress' or 'working towards ISO 27001'",
      compliance_job: "an open job that names SOC 2, ISO 27001, HIPAA, GRC, compliance or security compliance",
    },
  },
  Q5: {
    title: "Enterprise customers pushing them?",
    fields: {
      enterprise_tier: "an enterprise plan or 'contact sales' tier",
      sso_saml: "offers SSO, SAML or SCIM",
      big_logos: "named large or regulated customers (value = comma-separated names)",
      enterprise_case_study: "a case study with an enterprise or regulated customer",
      security_review_page: "a page for security reviews, questionnaires or 'request our SOC 2 report'",
    },
  },
  Q6: {
    title: "Funding stage?",
    fields: {
      funding_round: "latest funding round (value = Seed, Series A, Series B, Series C, Series D+, public, acquired, bootstrapped)",
      funding_date: "date of that round (value = YYYY-MM or YYYY)",
    },
  },
  Q7: {
    title: "Who are the clients, which industry?",
    fields: {
      industry: "the industry it sells into or the data it handles (value = fintech, healthtech, hrtech, data_ai, legaltech, government, other)",
      named_clients: "number of named customers on the site (value = a number)",
      client_size: "whether named customers include mid-market or enterprise brands (value = yes or no)",
    },
  },
  Q8: {
    title: "Runs on a public cloud?",
    fields: {
      cloud: "cloud provider it runs on (value = AWS, GCP, Azure or on_prem_only)",
      geography: "markets it sells in (value = comma-separated: US, UK, EU, India, ANZ, other)",
    },
  },
};

export const COMPETITOR_TOOLS = ["sprinto", "vanta", "drata", "secureframe"];
export const FRAMEWORKS = ["soc 2", "soc2", "iso 27001", "iso27001", "hipaa", "gdpr", "pci"];

const has = (facts: Fact[], q: QuestionId, field?: string) =>
  facts.some((f) => f.question === q && (!field || f.field === field));

export function facts_(facts: Fact[], q: QuestionId, field: string): Fact[] {
  return facts.filter((f) => f.question === q && f.field === field);
}

export function countFrameworks(facts: Fact[]): number {
  const held = facts_(facts, "Q2", "certifications").map((f) => f.value.toLowerCase()).join(",");
  const found = new Set<string>();
  if (/soc ?2/.test(held)) found.add("soc2");
  if (/iso ?27001/.test(held)) found.add("iso27001");
  if (/hipaa/.test(held)) found.add("hipaa");
  if (/gdpr/.test(held)) found.add("gdpr");
  if (/pci/.test(held)) found.add("pci");
  return found.size;
}

export function parseEmployees(value: string): { min: number; max: number } | null {
  const nums = value.replace(/,/g, "").match(/\d+(\.\d+)?\s*k?/gi);
  if (!nums) return null;
  const toN = (s: string) => {
    const k = /k/i.test(s);
    const n = parseFloat(s);
    return Math.round(k ? n * 1000 : n);
  };
  const parsed = nums.map(toN).filter((n) => n > 0 && n < 1_000_000);
  if (!parsed.length) return null;
  return { min: Math.min(...parsed), max: Math.max(...parsed) };
}

// Context needed by the sufficiency rules beyond the facts themselves.
export type SearchState = {
  checkedTrustAddresses: number; // of the 4 standard: /security, /trust, trust.<domain>, security.<domain>
  trustPageRead: boolean;
  checkedPages: string[];
};

// "Sufficient when", checked by code (Evidence Map column 4).
export function isAnswered(q: QuestionId, facts: Fact[], s: SearchState): boolean {
  switch (q) {
    case "Q1": {
      const positive = ["pricing_plans", "demo_or_trial", "app_login", "business_language"].filter((f) => has(facts, "Q1", f));
      return positive.length >= 2 || has(facts, "Q1", "not_saas");
    }
    // A security page without a visible vendor is not enough: the trust center often lives at /trust or trust.<domain>.
    case "Q2":
      return has(facts, "Q2", "trust_center_tool") || s.checkedTrustAddresses >= 4;
    case "Q3":
      return facts_(facts, "Q3", "employees").some((f) => parseEmployees(f.value) !== null);
    case "Q4":
      return has(facts, "Q4");
    case "Q5": {
      const logos = facts_(facts, "Q5", "big_logos").flatMap((f) => f.value.split(",")).filter((x) => x.trim()).length;
      return has(facts, "Q5", "enterprise_tier") || has(facts, "Q5", "enterprise_case_study") || logos >= 3 ||
        has(facts, "Q5", "sso_saml") || has(facts, "Q5", "security_review_page");
    }
    case "Q6":
      return has(facts, "Q6", "funding_round");
    case "Q7":
      return has(facts, "Q7", "industry");
    case "Q8":
      return has(facts, "Q8", "cloud");
  }
}

export type ShortCircuit = { question: QuestionId; reason: string } | null;

// Answers that end the whole assessment (Evidence Map column 7).
export function shortCircuit(facts: Fact[]): ShortCircuit {
  const notSaas = facts_(facts, "Q1", "not_saas")[0];
  if (notSaas) return { question: "Q1", reason: `Not B2B SaaS: ${notSaas.value}` };

  for (const f of facts_(facts, "Q2", "trust_center_tool")) {
    const tool = COMPETITOR_TOOLS.find((t) => f.value.toLowerCase().includes(t));
    if (tool) return { question: "Q2", reason: tool === "sprinto" ? "Already a Sprinto customer (trust center)" : `Trust center run by ${tool[0].toUpperCase()}${tool.slice(1)}` };
  }
  if (countFrameworks(facts) >= 4) return { question: "Q2", reason: "Mature program: 4 or more frameworks held" };

  for (const f of facts_(facts, "Q3", "employees")) {
    const e = parseEmployees(f.value);
    if (e && e.max < 10) return { question: "Q3", reason: `Too small: ${f.value} employees` };
    if (e && e.min > 1000) return { question: "Q3", reason: `Too large: ${f.value} employees` };
  }
  for (const f of facts_(facts, "Q6", "funding_round")) {
    const v = f.value.toLowerCase();
    if (v.includes("public") || v.includes("ipo")) return { question: "Q6", reason: "Public company" };
    if (v.includes("acquired")) return { question: "Q6", reason: "Acquired" };
  }
  for (const f of facts_(facts, "Q8", "cloud")) {
    if (f.value.toLowerCase().includes("on_prem_only")) return { question: "Q8", reason: "On-premise only" };
  }
  return null;
}

// Gates and short-circuits first, so a company that fails early never costs the expensive checks.
export const PRIORITY: QuestionId[] = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8"];
export const TRIES: Record<QuestionId, number> = { Q1: 2, Q2: 4, Q3: 1, Q4: 3, Q5: 2, Q6: 2, Q7: 0, Q8: 1 };
