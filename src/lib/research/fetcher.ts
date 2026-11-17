// Request -> parse -> clean -> classify, with robots.txt, politeness and one Jina retry (FR-3.1, 3.2, 3.7, 3.8).
import { type Cleaned, cleanHtml, cleanText } from "./clean";
import { type FailureReason, JS_RETRY_WORDS, classifyPage } from "./classify";
import { USER_AGENT, isAllowed, parseRobots } from "./robots";

export type PageResult = {
  url: string;
  finalUrl: string;
  status: number;
  via: "plain" | "jina";
  failure: FailureReason | null;
  cleaned: Cleaned | null;
  fetchCount: number; // requests this call cost against the budget
  trustTool?: { tool: string; evidence: string }; // vendor behind a trust page, read from raw HTML
};

// Trust-center vendors leave their name in scripts, iframes or "powered by" footers, which cleaning removes.
// Only checked on trust or security pages, so a marketing page comparing vendors never counts.
const VENDORS: [RegExp, string][] = [
  [/[a-z0-9.-]*vanta\.com[^"'\s<]*/i, "Vanta"],
  [/[a-z0-9.-]*drata\.com[^"'\s<]*/i, "Drata"],
  [/[a-z0-9.-]*secureframe\.com[^"'\s<]*/i, "Secureframe"],
  [/[a-z0-9.-]*sprinto\.com[^"'\s<]*/i, "Sprinto"],
  [/[a-z0-9.-]*safebase\.(io|com)[^"'\s<]*/i, "SafeBase"],
  [/[a-z0-9.-]*conveyor\.com[^"'\s<]*/i, "Conveyor"],
  [/[a-z0-9.-]*whistic\.com[^"'\s<]*/i, "Whistic"],
  [/[a-z0-9.-]*trustcloud\.ai[^"'\s<]*/i, "TrustCloud"],
];

export function isTrustAddress(url: string): boolean {
  const u = new URL(url);
  return /^(trust|security)\./i.test(u.hostname) || /^\/(trust|security)(-center)?\/?$/i.test(u.pathname);
}

export function trustVendor(url: string, html: string): PageResult["trustTool"] {
  if (!isTrustAddress(url)) return undefined;
  for (const [re, tool] of VENDORS) {
    const m = html.match(re);
    if (m) return { tool, evidence: m[0].slice(0, 120) };
  }
  return undefined;
}

export type HttpFn = (url: string, init?: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 2_000_000;
const PER_HOST_GAP_MS = 1_000;

export class Fetcher {
  private robots = new Map<string, ReturnType<typeof parseRobots>>();
  private lastHit = new Map<string, number>();

  constructor(
    private http: HttpFn,
    private onJina: () => Promise<void> = async () => {},
    private sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  private async polite(host: string) {
    const wait = (this.lastHit.get(host) ?? 0) + PER_HOST_GAP_MS - Date.now();
    if (wait > 0) await this.sleep(wait);
    this.lastHit.set(host, Date.now());
  }

  private async get(url: string): Promise<{ res: Response; body: string } | { error: FailureReason }> {
    const host = new URL(url).hostname;
    await this.polite(host);
    try {
      const res = await this.http(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5" },
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const buf = await res.arrayBuffer();
      const body = new TextDecoder().decode(buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf);
      return { res, body };
    } catch (err) {
      return { error: err instanceof Error && err.name === "TimeoutError" ? "timeout" : "http_error" };
    }
  }

  // Returns true if robots.txt allows the path. Costs one request the first time per host.
  async allowed(url: string): Promise<{ ok: boolean; cost: number }> {
    const u = new URL(url);
    if (!this.robots.has(u.host)) {
      const r = await this.get(`${u.protocol}//${u.host}/robots.txt`);
      const rules = "res" in r && r.res.ok ? parseRobots(r.body) : [];
      this.robots.set(u.host, rules);
      return { ok: isAllowed(rules, u.pathname + u.search), cost: 1 };
    }
    return { ok: isAllowed(this.robots.get(u.host)!, u.pathname + u.search), cost: 0 };
  }

  async page(url: string): Promise<PageResult> {
    const host = new URL(url).hostname;
    const robots = await this.allowed(url);
    if (!robots.ok) return { url, finalUrl: url, status: 0, via: "plain", failure: "robots", cleaned: null, fetchCount: robots.cost };

    const r = await this.get(url);
    if ("error" in r) return { url, finalUrl: url, status: 0, via: "plain", failure: r.error, cleaned: null, fetchCount: robots.cost + 1 };

    const contentType = r.res.headers.get("content-type") ?? "";
    const isHtml = /html|xml|text\/plain/i.test(contentType) || !contentType;
    const cleaned = isHtml && r.res.ok ? cleanHtml(r.body, r.res.url || url) : null;
    const failure = classifyPage({
      status: r.res.status, contentType, html: r.body, cleanedWords: cleaned?.words ?? 0,
      requestedHost: host, finalUrl: r.res.url || url,
    });

    const finalUrl = r.res.url || url;
    const trustTool = r.res.ok ? trustVendor(finalUrl, r.body) : undefined;
    // Blocks and errors are final: never retried around (FR-3.9). A full page needs no retry.
    const terminal = failure !== null && failure !== "empty";
    if (terminal || (cleaned && cleaned.words >= JS_RETRY_WORDS)) {
      return { url, finalUrl, status: r.res.status, via: "plain", failure, cleaned: terminal ? null : cleaned, fetchCount: robots.cost + 1, trustTool };
    }

    // Thin page: probably JavaScript-rendered. One retry through Jina Reader.
    await this.onJina();
    const j = await this.get(`https://r.jina.ai/${url}`);
    if ("res" in j && j.res.ok) {
      const jc = cleanText(j.body);
      if (jc.words > (cleaned?.words ?? 0)) {
        return { url, finalUrl: url, status: 200, via: "jina", failure: jc.words === 0 ? "empty" : null, cleaned: jc.words ? { ...jc, links: cleaned?.links ?? jc.links } : null, fetchCount: robots.cost + 2, trustTool };
      }
    }
    return { url, finalUrl, status: r.res.status, via: "plain", failure: cleaned?.words ? null : "empty", cleaned: cleaned?.words ? cleaned : null, fetchCount: robots.cost + 2, trustTool };
  }

  async json(url: string): Promise<unknown | null> {
    const r = await this.get(url);
    if ("error" in r || !r.res.ok) return null;
    try {
      return JSON.parse(r.body);
    } catch {
      return null;
    }
  }
}
