import "server-only";
import { env } from "./env";
import { sql } from "./db";

export type CheckResult = { name: string; ok: boolean; detail: string };

const TIMEOUT_MS = 10_000;

// Every check uses a free, read-only endpoint so testing never spends quota.
// Details never include key values or raw error bodies.
async function probe(name: string, run: () => Promise<string>): Promise<CheckResult> {
  try {
    return { name, ok: true, detail: await run() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "failed";
    return { name, ok: false, detail: msg.replace(/[A-Za-z0-9_-]{24,}/g, "[hidden]") };
  }
}

async function getJson(url: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) {
    // OAuth errors carry a short code (e.g. invalid_grant); surface only that.
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
    if (body?.error === "invalid_grant") {
      throw new Error("Gmail token expired or revoked: reconnect Gmail (publish the Google app to 'In production' first)");
    }
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

export async function checkConnections(): Promise<CheckResult[]> {
  const e = env();
  return Promise.all([
    probe("Neon", async () => {
      const rows = (await sql()`select count(*)::int as n from schema_migrations`) as { n: number }[];
      return `${rows[0].n} migrations applied`;
    }),
    probe("Gemini", async () => {
      const data = (await getJson("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
        headers: { "x-goog-api-key": e.GEMINI_API_KEY },
      })) as { models: { name: string }[] };
      const names = data.models.map((m) => m.name);
      const model = names.includes(`models/${e.GEMINI_MODEL}`) ? e.GEMINI_MODEL : "model missing";
      const embed = names.includes(`models/${e.GEMINI_EMBEDDING_MODEL}`) ? "embeddings ok" : "embedding model missing";
      return `${model}, ${embed}`;
    }),
    probe("Hunter.io", async () => {
      const data = (await getJson("https://api.hunter.io/v2/account", {
        headers: { "X-API-KEY": e.HUNTER_API_KEY },
      })) as { data: { requests: { searches: { used: number; available: number } } } };
      const s = data.data.requests.searches;
      return `${s.available - s.used} of ${s.available} searches left this month`;
    }),
    probe("HubSpot", async () => {
      await getJson("https://api.hubapi.com/crm/v3/objects/companies?limit=1", {
        headers: { Authorization: `Bearer ${e.HUBSPOT_ACCESS_TOKEN}` },
      });
      return "companies readable";
    }),
    probe("Gmail", async () => {
      const token = (await getJson("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: e.GMAIL_CLIENT_ID,
          client_secret: e.GMAIL_CLIENT_SECRET,
          refresh_token: e.GMAIL_REFRESH_TOKEN,
          grant_type: "refresh_token",
        }),
      })) as { scope?: string };
      const scopes = token.scope ?? "";
      const canDraft = scopes.includes("gmail.compose") || scopes.includes("gmail.modify");
      return canDraft ? "can create drafts" : "connected; draft permission needed before M5";
    }),
  ]);
}
