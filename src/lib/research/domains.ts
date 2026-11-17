// FR-1.3: normalise a pasted list of domains.
export function normaliseDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[/?#\s]/)[0].replace(/:\d+$/, "").replace(/\.$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) || s.split(".").some((p) => !p || p.startsWith("-") || p.endsWith("-"))) return null;
  return s;
}

export function parseDomainList(text: string, max = 50): { domains: string[]; invalid: string[]; truncated: boolean } {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const domains: string[] = [];
  const invalid: string[] = [];
  for (const p of parts) {
    const d = normaliseDomain(p);
    if (!d) invalid.push(p);
    else if (!domains.includes(d)) domains.push(d);
  }
  return { domains: domains.slice(0, max), invalid, truncated: domains.length > max };
}
