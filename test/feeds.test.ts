import { describe, expect, it } from "vitest";
import { headlinePrompt } from "@/lib/feeds/headlines";
import { badgesIn, mentionsCompany, precheck, toolFromLinks } from "@/lib/feeds/precheck";
import { excludedRound, priority } from "@/lib/feeds/rank";
import { cleanTitle, parseFeed } from "@/lib/feeds/rss";
import { FEEDS, FUNDING_RE } from "@/lib/feeds/sources";

const RSS = `<?xml version="1.0"?><rss><channel><title>News</title>
<item><title><![CDATA[Acme raises $12M Series A to automate payroll]]></title><link>https://news.example/acme</link>
<pubDate>Mon, 16 Nov 2026 08:00:00 GMT</pubDate><description><![CDATA[<p>Acme &amp; partners</p>]]></description></item>
<item><title>Why founders should rest</title><link>https://news.example/rest</link></item>
<item><title>No link here</title></item>
</channel></rss>`;

const ATOM = `<feed><entry><title>Beta secures seed funding</title><link href="https://n.example/beta"/><updated>2026-11-15T10:00:00Z</updated><summary>x</summary></entry></feed>`;

describe("feed reader (step ③)", () => {
  it("parses RSS items with CDATA, entities and dates, and skips items without a link", () => {
    const items = parseFeed(RSS);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ title: "Acme raises $12M Series A to automate payroll", link: "https://news.example/acme", summary: "Acme & partners" });
    expect(items[0].published).toBe("2026-11-16T08:00:00.000Z");
  });

  it("parses Atom entries", () => {
    expect(parseFeed(ATOM)[0]).toMatchObject({ title: "Beta secures seed funding", link: "https://n.example/beta" });
  });

  it("keeps funding headlines only", () => {
    expect(FUNDING_RE.test("Acme raises $12M Series A")).toBe(true);
    expect(FUNDING_RE.test("Promise Robotics announces $40-million Series B round")).toBe(true);
    expect(FUNDING_RE.test("Why founders should rest")).toBe(false);
  });

  it("drops the Google News source suffix", () => {
    expect(cleanTitle("Dallas AI Startup 4Minds Raises $15M Series A - Dallas Innovates")).toBe("Dallas AI Startup 4Minds Raises $15M Series A");
  });

  it("lists at least 8 feeds with unique ids", () => {
    expect(FEEDS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(FEEDS.map((f) => f.id)).size).toBe(FEEDS.length);
  });

  it("asks for the company that raised, never the investor, and its own website", () => {
    const p = headlinePrompt([{ i: 1, title: "Acme raises $12M", summary: "", feed: "x", link: "https://n/a", published: null }]);
    expect(p).toContain("never the investor");
    expect(p).toContain("Never a news site");
  });
});

type Fake = { text?: string; title?: string; links?: { href: string; text: string }[]; trustTool?: { tool: string; evidence: string }; failure?: string };
function site(pages: Record<string, Fake>) {
  const calls: string[] = [];
  const page = async (url: string) => {
    calls.push(url);
    const p = pages[url];
    if (!p || p.failure) return { finalUrl: url, failure: (p?.failure ?? "http_error") as never, cleaned: null, trustTool: undefined };
    const text = p.text ?? "";
    return { finalUrl: url, failure: null, cleaned: { title: p.title ?? "", text, words: text.split(/\s+/).length, links: p.links ?? [] }, trustTool: p.trustTool };
  };
  return { page, calls };
}

describe("compliance pre-check (step ④)", () => {
  it("drops a company whose trust center runs on a compliance tool", async () => {
    const s = site({
      "https://acme.com/": { text: "Acme payroll for teams" },
      "https://trust.acme.com/": { text: "Trust center", trustTool: { tool: "Vanta", evidence: "app.vanta.com/acme" } },
    });
    const r = await precheck(s.page, "acme.com", "Acme");
    expect(r.verdict).toBe("uses_tool");
    expect(r.tool).toBe("Vanta");
  });

  it("catches a homepage link straight into a tool's trust center, with one fetch", async () => {
    const s = site({ "https://acme.com/": { text: "Acme payroll", links: [{ href: "https://app.drata.com/trust/acme", text: "Trust" }] } });
    const r = await precheck(s.page, "acme.com", "Acme");
    expect(r).toMatchObject({ verdict: "uses_tool", tool: "Drata" });
    expect(s.calls).toHaveLength(1);
  });

  it("keeps a certified company with no tool, with its badges", async () => {
    const s = site({ "https://acme.com/": { text: "Acme payroll. We are SOC 2 Type II and ISO 27001 certified." } });
    const r = await precheck(s.page, "acme.com", "Acme");
    expect(r.verdict).toBe("certified");
    expect(r.badges).toEqual(["SOC 2", "ISO 27001"]);
  });

  it("marks no sign of compliance, and never reads more than 4 pages", async () => {
    const s = site({ "https://acme.com/": { text: "Acme payroll for growing teams" } });
    const r = await precheck(s.page, "acme.com", "Acme");
    expect(r.verdict).toBe("not_found");
    expect(s.calls.length).toBeLessThanOrEqual(4);
  });

  it("rejects a guessed website that does not mention the company", async () => {
    const s = site({ "https://acme.com/": { text: "Domain for sale" } });
    expect((await precheck(s.page, "acme.com", "Zenith Payroll")).verdict).toBe("mismatch");
  });

  it("reports an unreadable website", async () => {
    const s = site({});
    expect((await precheck(s.page, "acme.com", "Acme")).verdict).toBe("unreachable");
  });

  it("helpers: badges, tool links and name matching", () => {
    expect(badgesIn("HIPAA and PCI-DSS ready")).toEqual(["HIPAA", "PCI DSS"]);
    expect(toolFromLinks([{ href: "https://acme.com/blog/vanta-vs-drata" }])).toBeUndefined();
    expect(toolFromLinks([{ href: "https://trust.secureframe.com/acme" }])?.tool).toBe("Secureframe");
    expect(mentionsCompany("Welcome to Fieldwire", "Fieldwire Inc", "fieldwire.com")).toBe(true);
  });
});

describe("pool ranking", () => {
  const now = Date.parse("2026-11-18T00:00:00Z");
  it("puts a fresh, uncertified Series A B2B SaaS company first", () => {
    const top = priority({ round: "Series A", saas: "yes", sector: "HR software", published: "2026-11-16T00:00:00Z", precheck: "not_found" }, now);
    const certified = priority({ round: "Series A", saas: "yes", sector: "HR software", published: "2026-11-16T00:00:00Z", precheck: "certified" }, now);
    const seedOld = priority({ round: "Seed", saas: "unsure", sector: "retail", published: "2026-09-01T00:00:00Z", precheck: "not_found" }, now);
    expect(top).toBe(30 + 25 + 25 + 10 + 15);
    expect(top).toBeGreaterThan(certified);
    expect(certified).toBeGreaterThan(seedOld);
  });

  it("drops rounds the ICP never targets", () => {
    expect(excludedRound("Series D+")).toBe(true);
    expect(excludedRound("Debt or grant")).toBe(true);
    expect(excludedRound("Series B")).toBe(false);
  });
});
