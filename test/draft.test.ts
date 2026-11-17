import { describe, expect, it } from "vitest";
import { checkDraft } from "@/lib/draft/check";
import { pickPains } from "@/lib/draft/pains";
import { type DraftFact, pickHook } from "@/lib/draft/write";
import { Hunter, QuotaError, acceptable, parseEmails } from "@/lib/people/hunter";
import { preferredRoles, rankCandidates } from "@/lib/people/pick";

// Recorded shape of a Hunter domain-search response, with made-up people.
const HUNTER_EMAILS = [
  { value: "maya@acme.io", first_name: "Maya", last_name: "Rao", position: "Chief Technology Officer", confidence: 96 },
  { value: "li@acme.io", first_name: "Li", last_name: "Chen", position: "Head of Information Security", confidence: 91 },
  { value: "sam@acme.io", first_name: "Sam", last_name: "Ortiz", position: "Co-founder & CEO", confidence: 99 },
  { value: "kim@acme.io", first_name: "Kim", last_name: "Lee", position: "VP of Sales", confidence: 88 },
  { value: "jo@acme.io", first_name: "Jo", last_name: "Park", position: "Marketing Manager", confidence: 97 },
  { value: "info@acme.io", first_name: null, last_name: null, position: null, confidence: 50 },
];

describe("person by company size (FR-5.2)", () => {
  const cands = parseEmails(HUNTER_EMAILS as never);
  it("drops generic inboxes", () => {
    expect(cands.map((c) => c.email)).not.toContain("info@acme.io");
  });
  it("under 50 employees: founder first", () => {
    expect(rankCandidates(cands, preferredRoles(30, false))[0].email).toBe("sam@acme.io");
  });
  it("50 to 200: CTO first", () => {
    expect(rankCandidates(cands, preferredRoles(85, false))[0].email).toBe("maya@acme.io");
  });
  it("200 to 500: security leader first", () => {
    expect(rankCandidates(cands, preferredRoles(320, false))[0].email).toBe("li@acme.io");
  });
  it("enterprise pressure makes the sales leader the second choice", () => {
    const r = rankCandidates(cands, preferredRoles(85, true));
    expect(r[1].email).toBe("kim@acme.io");
  });
  it("never picks someone outside the preferred roles", () => {
    expect(rankCandidates(cands, preferredRoles(85, false)).map((c) => c.email)).not.toContain("jo@acme.io");
  });
  it("accepts valid or confident accept_all emails only (FR-5.3)", () => {
    expect(acceptable({ status: "valid", score: 90 }, 50)).toBe(true);
    expect(acceptable({ status: "accept_all", score: 70 }, 85)).toBe(true);
    expect(acceptable({ status: "accept_all", score: 70 }, 60)).toBe(false);
    expect(acceptable({ status: "invalid", score: 10 }, 99)).toBe(false);
  });
});

describe("Hunter quota guard (FR-5.4)", () => {
  const account = (used: number) => new Response(JSON.stringify({ data: { requests: { searches: { used, available: 50 }, verifications: { used: 0, available: 100 } } } }));
  it("refuses to search when fewer than 5 searches are left, without spending one", async () => {
    let searched = false;
    const http = async (url: string) => {
      if (url.includes("domain-search")) searched = true;
      return account(47);
    };
    await expect(new Hunter("k", http as never).domainSearch("acme.io")).rejects.toBeInstanceOf(QuotaError);
    expect(searched).toBe(false);
  });
  it("searches and records the spend when quota allows", async () => {
    const spent: number[] = [];
    const http = async (url: string) => (url.includes("account") ? account(10) : new Response(JSON.stringify({ data: { emails: HUNTER_EMAILS } })));
    const r = await new Hunter("k", http as never, async (_k, rem) => { spent.push(rem!); }).domainSearch("acme.io");
    expect(r.candidates.length).toBe(5);
    expect(spent).toEqual([39]);
  });
});

describe("pains (FR-6)", () => {
  it("returns exactly two pains for the role and trigger", () => {
    const p = pickPains("engineering", ["audit_prep"], { holdsCert: false, hiringCompliance: true });
    expect(p).toHaveLength(2);
    expect(p[0].id).toBe("new_hire_ramp");
  });
  it("only uses fact-dependent pains when the fact exists", () => {
    const ids = pickPains("security", ["enterprise"], { holdsCert: false, hiringCompliance: false }).map((p) => p.id);
    expect(ids).not.toContain("next_framework_overlap");
  });
});

describe("hook (FR-7.2)", () => {
  const f = (id: string, question: string, field: string, verified = true): DraftFact => ({ id, question, field, value: "v", quote: "q", verified });
  it("prefers an audit-prep job over enterprise signals", () => {
    expect(pickHook([f("F1", "Q5", "enterprise_tier"), f("F2", "Q4", "compliance_job")])?.id).toBe("F2");
  });
  it("never uses an unverified fact", () => {
    expect(pickHook([f("F3", "Q4", "compliance_job", false)])).toBeNull();
  });
});

describe("draft checks and claim checker (FR-7.1, FR-7.3)", () => {
  const good = {
    subject: "Your GRC analyst role and SOC 2",
    hook: "Hi Maya, I saw Acme is hiring a GRC Analyst to own SOC 2 readiness.",
    body: "At your size that usually means engineers lose weeks to audit prep, and a new hire spends months building the evidence trail. Sprinto connects to your cloud, identity and code tools and collects most of that evidence automatically, so the hire runs the program instead of chasing screenshots and spreadsheets.",
    cta: "Worth a 15-minute call next week?",
    claims: [
      { sentence: "Acme is hiring a GRC Analyst", source: "F12" },
      { sentence: "Sprinto collects evidence automatically", source: "S2" },
    ],
  };
  const ctx = { firstName: "Maya", factIds: new Set(["F12"]) };

  it("passes a good draft", () => {
    expect(checkDraft(good, ctx)).toEqual({ ok: true, problems: [] });
  });
  it("blocks a claim that maps to no stored fact", () => {
    const r = checkDraft({ ...good, claims: [...good.claims, { sentence: "Acme raised $40M last week", source: "F99" }] }, ctx);
    expect(r.ok).toBe(false);
    expect(r.problems.join()).toMatch(/Unmapped claim/);
  });
  it("blocks links, extra questions, long subjects and a missing first name", () => {
    const r = checkDraft({ ...good, subject: "One two three four five six seven eight", hook: "Hello there, see www.acme.io?", body: good.body }, ctx);
    expect(r.problems.join(" | ")).toMatch(/Subject/);
    expect(r.problems.join(" | ")).toMatch(/first name/);
    expect(r.problems.join(" | ")).toMatch(/link/);
    expect(r.problems.join(" | ")).toMatch(/one question/);
  });
  it("enforces 60 to 120 words", () => {
    expect(checkDraft({ ...good, body: "Short body." }, ctx).problems.join()).toMatch(/words/);
  });
});
