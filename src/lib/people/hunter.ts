// Hunter.io (FR-5). Domain search costs 1 search credit, verification 1 verification credit.
// The account endpoint is free and is checked before every search (quota guard, FR-5.4).
import type { Candidate } from "./pick";

export const QUOTA_FLOOR = { searches: 5, verifications: 10 };

type HttpFn = (url: string, init?: RequestInit) => Promise<Response>;

export type Quota = { searchesLeft: number; verificationsLeft: number };

export class Hunter {
  constructor(private apiKey: string, private http: HttpFn = fetch, private onCall: (kind: "hunter_search" | "hunter_verify", remaining?: number) => Promise<void> = async () => {}) {}

  private async get(path: string): Promise<unknown> {
    const res = await this.http(`https://api.hunter.io/v2/${path}`, { headers: { "X-API-KEY": this.apiKey }, signal: AbortSignal.timeout(20_000) });
    if (res.status === 429) throw new Error("Hunter rate limit");
    if (!res.ok) throw new Error(`Hunter HTTP ${res.status}`);
    return res.json();
  }

  async quota(): Promise<Quota> {
    const d = (await this.get("account")) as { data: { requests: { searches: { used: number; available: number }; verifications: { used: number; available: number } } } };
    const r = d.data.requests;
    return { searchesLeft: r.searches.available - r.searches.used, verificationsLeft: r.verifications.available - r.verifications.used };
  }

  async domainSearch(domain: string): Promise<{ candidates: Candidate[]; remaining?: number }> {
    const q = await this.quota();
    if (q.searchesLeft < QUOTA_FLOOR.searches) throw new QuotaError(`Only ${q.searchesLeft} Hunter searches left this month`);
    const d = (await this.get(`domain-search?domain=${encodeURIComponent(domain)}&limit=10&type=personal`)) as { data: { emails: HunterEmail[] } };
    await this.onCall("hunter_search", q.searchesLeft - 1);
    return { candidates: parseEmails(d.data.emails ?? []), remaining: q.searchesLeft - 1 };
  }

  async verify(email: string): Promise<{ status: string; score: number }> {
    const q = await this.quota();
    if (q.verificationsLeft < QUOTA_FLOOR.verifications) throw new QuotaError(`Only ${q.verificationsLeft} Hunter verifications left this month`);
    const d = (await this.get(`email-verifier?email=${encodeURIComponent(email)}`)) as { data: { status: string; score: number } };
    await this.onCall("hunter_verify", q.verificationsLeft - 1);
    return { status: d.data.status, score: d.data.score };
  }
}

export class QuotaError extends Error {}

type HunterEmail = { value: string; first_name: string | null; last_name: string | null; position: string | null; confidence: number };

export function parseEmails(emails: HunterEmail[]): Candidate[] {
  return emails
    .filter((e) => e.value && e.first_name)
    .map((e) => ({ email: e.value, firstName: e.first_name ?? "", lastName: e.last_name ?? "", position: e.position ?? "", confidence: e.confidence ?? 0 }));
}

// FR-5.3: accept 'valid', or 'accept_all' with confidence >= 80.
export function acceptable(v: { status: string; score: number }, confidence: number): boolean {
  return v.status === "valid" || (v.status === "accept_all" && confidence >= 80);
}
