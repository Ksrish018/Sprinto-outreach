import { describe, expect, it } from "vitest";
import { MAX_CHARS, cleanHtml, cleanText, quoteFound } from "@/lib/research/clean";
import { classifyPage } from "@/lib/research/classify";
import { isAllowed, parseRobots } from "@/lib/research/robots";
import { CLOUDFLARE, JS_SHELL, LOGIN, SAAS_HOME } from "./fixtures/pages";

describe("cleanHtml (FR-3.2a)", () => {
  const c = cleanHtml(SAAS_HOME, "https://quillpay.io/");

  it("keeps the product text", () => {
    expect(c.text).toContain("The payments API built for B2B platforms and finance teams");
    expect(c.text).toContain("Book a demo with our team");
  });

  it("drops navigation, footer, cookie banner, scripts and styles", () => {
    expect(c.text).not.toMatch(/cookie/i);
    expect(c.text).not.toContain("All rights reserved");
    expect(c.text).not.toContain("dataLayer");
    expect(c.text).not.toContain("color:red");
  });

  it("drops short blocks but keeps short evidence words", () => {
    expect(c.text).not.toMatch(/^Short$/m);
    expect(c.text).toMatch(/^Enterprise$/m);
  });

  it("removes duplicate blocks", () => {
    expect(c.text.split("Quillpay helps software companies").length - 1).toBe(1);
  });

  it("collects links before dropping the footer, absolute and de-duplicated", () => {
    const hrefs = c.links.map((l) => l.href);
    expect(hrefs).toContain("https://quillpay.io/security");
    expect(hrefs).toContain("https://jobs.ashbyhq.com/quillpay");
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("caps output at about 2,000 tokens", () => {
    const long = `<p>${"word ".repeat(5000)}</p>`;
    expect(cleanHtml(long, "https://x.io/").text.length).toBeLessThanOrEqual(MAX_CHARS);
  });

  it("cleans Jina markdown the same way", () => {
    const md = "# Title\nAccept all cookies\n[Pricing](https://x.io/pricing) for teams that need SOC 2 reports and audit evidence";
    const t = cleanText(md);
    expect(t.text).not.toMatch(/cookies/i);
    expect(t.links[0].href).toBe("https://x.io/pricing");
  });
});

describe("quoteFound", () => {
  const text = "We are hiring a GRC Analyst to “own our SOC 2 Type II readiness”.";
  it("accepts exact quotes despite case, spacing and curly quotes", () => {
    expect(quoteFound('own our   SOC 2 type II readiness', text)).toBe(true);
  });
  it("rejects paraphrases and very short quotes", () => {
    expect(quoteFound("own SOC 2 readiness", text)).toBe(false);
    expect(quoteFound("SOC", text)).toBe(false);
  });
});

describe("classifyPage (FR-3.8 silent failures)", () => {
  const base = { status: 200, contentType: "text/html", cleanedWords: 300, requestedHost: "x.io", finalUrl: "https://x.io/" };
  it("detects a Cloudflare challenge", () => {
    expect(classifyPage({ ...base, html: CLOUDFLARE, cleanedWords: 5 })).toBe("bot_check");
  });
  it("detects a login wall", () => {
    expect(classifyPage({ ...base, html: LOGIN, cleanedWords: 3 })).toBe("login_wall");
  });
  it("treats a JavaScript shell as empty", () => {
    expect(classifyPage({ ...base, html: JS_SHELL, cleanedWords: 0 })).toBe("empty");
  });
  it("flags rate limits, PDFs and redirects off the domain", () => {
    expect(classifyPage({ ...base, html: "", status: 429 })).toBe("rate_limit");
    expect(classifyPage({ ...base, html: "", contentType: "application/pdf" })).toBe("non_text");
    expect(classifyPage({ ...base, html: "<p>hi</p>", finalUrl: "https://other.com/" })).toBe("off_domain");
  });
  it("passes a normal page", () => {
    expect(classifyPage({ ...base, html: SAAS_HOME })).toBeNull();
  });
});

describe("robots.txt", () => {
  const rules = parseRobots("User-agent: *\nDisallow: /private\nAllow: /private/ok\nDisallow: /*.pdf$\n\nUser-agent: OtherBot\nDisallow: /");
  it("applies the * group with longest-match and wildcards", () => {
    expect(isAllowed(rules, "/pricing")).toBe(true);
    expect(isAllowed(rules, "/private/x")).toBe(false);
    expect(isAllowed(rules, "/private/ok")).toBe(true);
    expect(isAllowed(rules, "/report.pdf")).toBe(false);
  });
  it("disallows everything when told to", () => {
    expect(isAllowed(parseRobots("User-agent: *\nDisallow: /"), "/")).toBe(false);
  });
});

describe("trust vendor detection (raw HTML, trust pages only)", async () => {
  const { trustVendor } = await import("@/lib/research/fetcher");
  it("finds the vendor behind trust.<domain>", () => {
    expect(trustVendor("https://trust.rillet.com/", '<script src="https://cdn.vanta.com/trust/app.js"></script>')?.tool).toBe("Vanta");
  });
  it("finds Sprinto on a /security page", () => {
    expect(trustVendor("https://zipy.ai/security", '<a href="https://trust.sprinto.com/zipy">Trust</a>')?.tool).toBe("Sprinto");
  });
  it("ignores vendor names on ordinary pages", () => {
    expect(trustVendor("https://acme.com/blog/vanta-vs-drata", "vanta.com drata.com")).toBeUndefined();
  });
});
