import { describe, expect, it } from "vitest";
import { normaliseDomain, parseDomainList } from "@/lib/research/domains";
import { preScore } from "@/lib/research/discovery";

describe("domain list (FR-1.3)", () => {
  it("normalises URLs, www, paths, case and ports", () => {
    expect(normaliseDomain("https://WWW.Acme.com/pricing?x=1")).toBe("acme.com");
    expect(normaliseDomain("acme.co.uk:443")).toBe("acme.co.uk");
    expect(normaliseDomain("not a domain")).toBeNull();
    expect(normaliseDomain("-bad.com")).toBeNull();
  });

  it("de-duplicates, reports invalid entries and caps at 50", () => {
    const r = parseDomainList("acme.com, https://acme.com/ , beta.io\nnope");
    expect(r.domains).toEqual(["acme.com", "beta.io"]);
    expect(r.invalid).toEqual(["nope"]);
    const many = Array.from({ length: 60 }, (_, i) => `c${i}.com`).join(" ");
    expect(parseDomainList(many).domains).toHaveLength(50);
    expect(parseDomainList(many).truncated).toBe(true);
  });
});

describe("discovery pre-score (FR-2.2)", () => {
  it("drops clear gate failures from the snippet alone", () => {
    expect(preScore({ saas: "no" })).toBeNull();
    expect(preScore({ employees: "5" })).toBeNull();
    expect(preScore({ employees: "5000" })).toBeNull();
    expect(preScore({ stage: "public" })).toBeNull();
  });
  it("ranks a funded SaaS with an audit signal highest", () => {
    const strong = preScore({ saas: "yes", stage: "Series B", trigger: "audit", employees: "120" })!;
    const weak = preScore({ saas: "unsure", stage: "unknown", trigger: "unknown" })!;
    expect(strong).toBeGreaterThan(weak);
  });
});
