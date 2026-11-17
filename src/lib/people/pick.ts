// FR-5.2: who to email depends on company size; enterprise pressure adds the sales leader as second choice.

export type Candidate = {
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  confidence: number;
};

export type RoleGroup = "founder" | "engineering" | "security" | "sales";

const ROLE: Record<RoleGroup, RegExp> = {
  founder: /\b(co-?founder|founder|ceo|chief executive)\b/i,
  engineering: /\b(cto|chief technology|vp,? (of )?engineering|vice president,? engineering|head of engineering|engineering director|director of engineering)\b/i,
  security: /\b(ciso|chief (information )?security|head of (information )?security|vp,? (of )?security|security lead|grc|governance,? risk|compliance (lead|manager|director|head)|head of compliance)\b/i,
  sales: /\b(cro|chief revenue|vp,? (of )?sales|head of sales|sales director|director of sales)\b/i,
};

// Preferred order of role groups for a company size (Evidence Map, PRD FR-5.2).
export function preferredRoles(employees: number, enterprisePressure: boolean): RoleGroup[] {
  let order: RoleGroup[];
  if (employees < 50) order = ["founder", "engineering"];
  else if (employees <= 200) order = ["engineering", "security", "founder"];
  else order = ["security", "engineering"];
  if (enterprisePressure) order = [...order.slice(0, 1), "sales", ...order.slice(1)];
  return order;
}

export function roleGroupOf(position: string): RoleGroup | null {
  for (const g of ["security", "engineering", "founder", "sales"] as RoleGroup[]) if (ROLE[g].test(position)) return g;
  return null;
}

// Ranked candidates: role order first, then Hunter confidence. People in no preferred role are left out.
export function rankCandidates(cands: Candidate[], order: RoleGroup[]): (Candidate & { group: RoleGroup })[] {
  return cands
    .map((c) => ({ ...c, group: roleGroupOf(c.position ?? "") }))
    .filter((c): c is Candidate & { group: RoleGroup } => c.group !== null && order.includes(c.group) && Boolean(c.email && c.firstName))
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || b.confidence - a.confidence);
}

export function pickReason(employees: number, c: { group: RoleGroup; position: string }): string {
  const band = employees < 50 ? "under 50" : employees <= 200 ? "50 to 200" : "200 to 500";
  return `${employees} employees (${band}) → ${c.group} role: ${c.position}`;
}
