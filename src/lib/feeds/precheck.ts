// Step ④: is the company already compliant? A cheap check of at most 4 pages, all by code, before any research.
// Uses a compliance tool (Vanta, Drata, Secureframe, Sprinto...) -> dropped: already served.
// Shows a certification but no tool -> kept, lower priority, renewal or next-framework angle.
// No sign of compliance -> kept, top priority.
import type { PageResult } from "../research/fetcher";

export type Precheck = {
  verdict: "uses_tool" | "certified" | "not_found" | "unreachable" | "mismatch";
  tool?: string;
  evidence?: string;
  badges: string[];
  pages: { url: string; result: string }[];
};

export const MAX_PAGES = 4;

const TOOL_HOSTS: [RegExp, string][] = [
  [/(^|\.)vanta\.com$/i, "Vanta"],
  [/(^|\.)drata\.com$/i, "Drata"],
  [/(^|\.)secureframe\.com$/i, "Secureframe"],
  [/(^|\.)sprinto\.com$/i, "Sprinto"],
  [/(^|\.)safebase\.(io|com)$/i, "SafeBase"],
  [/(^|\.)trustcloud\.ai$/i, "TrustCloud"],
  [/(^|\.)whistic\.com$/i, "Whistic"],
  [/(^|\.)conveyor\.com$/i, "Conveyor"],
];

const BADGES: [RegExp, string][] = [
  [/\bSOC\s?2\b/i, "SOC 2"],
  [/\bISO[\s/-]?(IEC\s?)?27001\b/i, "ISO 27001"],
  [/\bHIPAA\b/i, "HIPAA"],
  [/\bPCI[\s-]?DSS\b/i, "PCI DSS"],
];

type PageFn = (url: string) => Promise<Pick<PageResult, "finalUrl" | "failure" | "cleaned" | "trustTool">>;

// A link on the company's own site that points into a compliance tool's trust center.
export function toolFromLinks(links: { href: string }[]): { tool: string; evidence: string } | undefined {
  for (const l of links) {
    let host = "";
    try {
      host = new URL(l.href).hostname;
    } catch {
      continue;
    }
    for (const [re, tool] of TOOL_HOSTS) if (re.test(host)) return { tool, evidence: l.href.slice(0, 120) };
  }
  return undefined;
}

export function badgesIn(text: string): string[] {
  return BADGES.filter(([re]) => re.test(text)).map(([, b]) => b);
}

// The homepage must mention the company, or the AI guessed the wrong website.
export function mentionsCompany(text: string, name: string, domain: string): boolean {
  const t = text.toLowerCase();
  const root = domain.split(".")[0].toLowerCase();
  const words = name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !["inc", "ltd", "labs", "the", "technologies", "ai"].includes(w));
  return t.includes(name.toLowerCase()) || (root.length >= 4 && t.includes(root)) || (words.length > 0 && words.every((w) => t.includes(w)));
}

function trustLink(links: { href: string }[], domain: string): string | undefined {
  for (const l of links) {
    try {
      const u = new URL(l.href);
      if (!u.hostname.endsWith(domain)) continue;
      if (/^(trust|security)\./i.test(u.hostname) || /^\/(trust|security)(-center)?\/?$/i.test(u.pathname)) return `${u.origin}${u.pathname}`;
    } catch {
      continue;
    }
  }
  return undefined;
}

export async function precheck(page: PageFn, domain: string, name: string): Promise<Precheck> {
  const pages: Precheck["pages"] = [];
  const badges = new Set<string>();

  const home = await page(`https://${domain}/`);
  if (!home.cleaned) {
    pages.push({ url: `https://${domain}/`, result: home.failure ?? "no text" });
    return { verdict: "unreachable", badges: [], pages };
  }
  pages.push({ url: home.finalUrl, result: `${home.cleaned.words} words` });
  if (!mentionsCompany(`${home.cleaned.title} ${home.cleaned.text}`, name, domain)) {
    return { verdict: "mismatch", badges: [], pages };
  }
  badgesIn(home.cleaned.text).forEach((b) => badges.add(b));
  const linked = toolFromLinks(home.cleaned.links);
  if (linked) return { verdict: "uses_tool", tool: linked.tool, evidence: linked.evidence, badges: [...badges], pages };

  // Trust pages: the one the homepage links to first, then the usual addresses.
  const candidates = [trustLink(home.cleaned.links, domain), `https://trust.${domain}/`, `https://${domain}/trust`, `https://${domain}/security`, `https://security.${domain}/`]
    .filter((u, i, a): u is string => Boolean(u) && a.indexOf(u) === i)
    .slice(0, MAX_PAGES - 1);
  for (const url of candidates) {
    const p = await page(url);
    pages.push({ url, result: p.trustTool ? `trust center by ${p.trustTool.tool}` : p.cleaned ? `${p.cleaned.words} words` : (p.failure ?? "no text") });
    if (p.trustTool) return { verdict: "uses_tool", tool: p.trustTool.tool, evidence: p.trustTool.evidence, badges: [...badges], pages };
    if (p.cleaned) {
      badgesIn(p.cleaned.text).forEach((b) => badges.add(b));
      const t = toolFromLinks(p.cleaned.links);
      if (t) return { verdict: "uses_tool", tool: t.tool, evidence: t.evidence, badges: [...badges], pages };
    }
  }
  return { verdict: badges.size ? "certified" : "not_found", badges: [...badges], pages };
}
