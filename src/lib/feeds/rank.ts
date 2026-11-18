// Pool ranking: which companies get researched first. Plain code, shown on the ICP page.
import type { Precheck } from "./precheck";

export type RankInput = { round: string | null; saas: string; sector: string | null; published: string | null; precheck: Precheck["verdict"] };

export const RANK_RULES = [
  ["Series A or B", 30],
  ["Series C", 20],
  ["Seed", 10],
  ["Sells software to businesses (B2B SaaS)", 25],
  ["Might be B2B SaaS (unsure)", 10],
  ["No sign of compliance yet", 25],
  ["Certified, but no compliance tool", 10],
  ["Regulated sector (fintech, health, HR, insurance, legal, data)", 10],
  ["Raised in the last 7 days", 15],
  ["Raised in the last 30 days", 5],
] as const;

const REGULATED = /fin|pay|bank|lend|insur|health|med|clinic|pharma|hr\b|payroll|hiring|recruit|legal|compliance|security|data|analytics|identity|gov/i;

// Rounds the ICP never targets: dropped from the pool, not just ranked low.
export function excludedRound(round: string | null): boolean {
  return /series d|debt|grant/i.test(round ?? "");
}

export function priority(l: RankInput, now = Date.now()): number {
  let p = 0;
  const r = l.round ?? "";
  if (/series [ab]/i.test(r)) p += 30;
  else if (/series c/i.test(r)) p += 20;
  else if (/^seed/i.test(r)) p += 10;
  if (l.saas === "yes") p += 25;
  else if (l.saas === "unsure") p += 10;
  if (l.precheck === "not_found") p += 25;
  else if (l.precheck === "certified") p += 10;
  if (REGULATED.test(l.sector ?? "")) p += 10;
  if (l.published) {
    const days = (now - Date.parse(l.published)) / 86_400_000;
    if (days <= 7) p += 15;
    else if (days <= 30) p += 5;
  }
  return p;
}
