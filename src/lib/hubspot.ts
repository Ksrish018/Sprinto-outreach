import "server-only";
import { env } from "./env";
import { record } from "./ledger";

// FR-2.3: skip any domain HubSpot already knows as a company.
export async function domainsInHubspot(domains: string[], runId?: number): Promise<Set<string>> {
  const known = new Set<string>();
  for (let i = 0; i < domains.length; i += 100) {
    const batch = domains.slice(i, i + 100);
    const res = await fetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${env().HUBSPOT_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "domain", operator: "IN", values: batch }] }], properties: ["domain"], limit: 100 }),
      signal: AbortSignal.timeout(15_000),
    });
    await record("hubspot", "companies/search", { runId });
    if (!res.ok) throw new Error(`HubSpot search HTTP ${res.status}`);
    const data = (await res.json()) as { results: { properties: { domain?: string } }[] };
    for (const r of data.results) if (r.properties.domain) known.add(r.properties.domain.toLowerCase().replace(/^www\./, ""));
  }
  return known;
}
