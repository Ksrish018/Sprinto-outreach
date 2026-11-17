// Facts code can establish on its own, with no model: trust-center tools from links (Q2),
// job-board slugs, and compliance roles or cloud stack from job posts (Q4, Q8).
import type { Link } from "./clean";
import type { Fact } from "./evidence";

const TRUST_HOSTS: [RegExp, string][] = [
  [/trust\.vanta\.com|app\.vanta\.com\/.+\/trust/i, "Vanta"],
  [/app\.drata\.com\/trust|trust\.drata\.com/i, "Drata"],
  [/trust\.sprinto\.com|sprinto\.com\/trust-center/i, "Sprinto"],
  [/trust\.secureframe\.com|secureframe\.com\/trust/i, "Secureframe"],
  [/safebase\.io/i, "SafeBase"],
  [/whistic\.com/i, "Whistic"],
];

export function trustToolFromLinks(links: Link[], pageUrl: string): Fact | null {
  for (const l of links) {
    for (const [re, tool] of TRUST_HOSTS) {
      if (re.test(l.href)) {
        return { question: "Q2", field: "trust_center_tool", value: tool, quote: l.href, sourceUrl: pageUrl, rung: "scrape", verified: true };
      }
    }
  }
  return null;
}

export type Board = { kind: "greenhouse" | "lever" | "ashby"; slug: string };

export function boardsFromLinks(links: Link[]): Board[] {
  const out: Board[] = [];
  for (const { href } of links) {
    let m = href.match(/(?:boards|job-boards)\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/i);
    if (m) out.push({ kind: "greenhouse", slug: m[1].toLowerCase() });
    m = href.match(/jobs\.lever\.co\/([a-z0-9_-]+)/i);
    if (m) out.push({ kind: "lever", slug: m[1].toLowerCase() });
    m = href.match(/jobs\.ashbyhq\.com\/([a-z0-9_.-]+)/i);
    if (m) out.push({ kind: "ashby", slug: m[1].toLowerCase() });
  }
  return out.filter((b, i) => out.findIndex((x) => x.kind === b.kind && x.slug === b.slug) === i);
}

export function boardUrl(b: Board): string {
  if (b.kind === "greenhouse") return `https://boards-api.greenhouse.io/v1/boards/${b.slug}/jobs?content=true`;
  if (b.kind === "lever") return `https://api.lever.co/v0/postings/${b.slug}?mode=json`;
  return `https://api.ashbyhq.com/posting-api/job-board/${b.slug}`;
}

export function boardPublicUrl(b: Board): string {
  if (b.kind === "greenhouse") return `https://boards.greenhouse.io/${b.slug}`;
  if (b.kind === "lever") return `https://jobs.lever.co/${b.slug}`;
  return `https://jobs.ashbyhq.com/${b.slug}`;
}

export type Job = { title: string; text: string; url: string };

const strip = (html: string) =>
  html.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export function parseJobs(kind: Board["kind"], data: unknown, fallbackUrl: string): Job[] {
  try {
    if (kind === "greenhouse") {
      const jobs = (data as { jobs: { title: string; content?: string; absolute_url?: string }[] }).jobs ?? [];
      return jobs.map((j) => ({ title: j.title, text: strip(j.content ?? ""), url: j.absolute_url ?? fallbackUrl }));
    }
    if (kind === "lever") {
      const jobs = data as { text: string; descriptionPlain?: string; lists?: { content: string }[]; hostedUrl?: string }[];
      return jobs.map((j) => ({ title: j.text, text: strip([j.descriptionPlain ?? "", ...(j.lists ?? []).map((l) => l.content)].join(" ")), url: j.hostedUrl ?? fallbackUrl }));
    }
    const jobs = (data as { jobs: { title: string; descriptionPlain?: string; descriptionHtml?: string; jobUrl?: string }[] }).jobs ?? [];
    return jobs.map((j) => ({ title: j.title, text: j.descriptionPlain ?? strip(j.descriptionHtml ?? ""), url: j.jobUrl ?? fallbackUrl }));
  } catch {
    return [];
  }
}

// A compliance-owning role is audit prep on its own. A generic security engineer is not: those jobs count
// only when the text names a framework (the second branch below).
const COMPLIANCE_TITLE = /\b(grc|governance,? risk|compliance|soc ?2|iso ?27001|ciso|chief information security officer|head of (information )?security)\b/i;
const FRAMEWORK_TEXT = /\b(soc ?2( type (i|ii|1|2))?|iso ?27001|hipaa|fedramp|pci[- ]dss)\b/i;

function sentenceAround(text: string, idx: number): string {
  const start = Math.max(text.lastIndexOf(".", idx) + 1, idx - 160);
  const endDot = text.indexOf(".", idx);
  const end = endDot === -1 ? Math.min(text.length, idx + 160) : Math.min(endDot + 1, idx + 200);
  return text.slice(start, end).trim();
}

// Q4 trigger from job posts: a compliance role, or any job naming a framework.
export function complianceJobFacts(jobs: Job[]): Fact[] {
  const out: Fact[] = [];
  for (const j of jobs) {
    if (COMPLIANCE_TITLE.test(j.title)) {
      const m = j.text.match(FRAMEWORK_TEXT);
      out.push({
        question: "Q4", field: "compliance_job", value: `Hiring: ${j.title}`,
        quote: m ? sentenceAround(j.text, m.index!) : j.title, sourceUrl: j.url, rung: "api", verified: true,
      });
    } else {
      const m = j.text.match(FRAMEWORK_TEXT);
      if (m) out.push({ question: "Q4", field: "compliance_job", value: `${j.title} mentions ${m[0]}`, quote: sentenceAround(j.text, m.index!), sourceUrl: j.url, rung: "api", verified: true });
    }
    if (out.length >= 3) break;
  }
  return out;
}

const CLOUDS: [RegExp, string][] = [[/\b(aws|amazon web services)\b/i, "AWS"], [/\b(gcp|google cloud)\b/i, "GCP"], [/\bazure\b/i, "Azure"]];

export function cloudFromJobs(jobs: Job[]): Fact | null {
  for (const j of jobs) {
    for (const [re, name] of CLOUDS) {
      const m = j.text.match(re);
      if (m) return { question: "Q8", field: "cloud", value: name, quote: sentenceAround(j.text, m.index!), sourceUrl: j.url, rung: "api", verified: true };
    }
  }
  return null;
}
