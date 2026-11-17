import "server-only";
import { env } from "./env";
import { record } from "./ledger";

// Gmail (FR-9): create drafts addressed only to SEND_TO_EMAIL, and read what was sent (FR-8.3).
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailAuthError extends Error {}

let cached: { token: string; until: number; scope: string } | null = null;

async function token(): Promise<string> {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const e = env();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: e.GMAIL_CLIENT_ID, client_secret: e.GMAIL_CLIENT_SECRET, refresh_token: e.GMAIL_REFRESH_TOKEN, grant_type: "refresh_token" }),
  });
  if (!res.ok) throw new GmailAuthError("Gmail token expired or revoked: reconnect Gmail");
  const d = (await res.json()) as { access_token: string; expires_in: number; scope?: string };
  cached = { token: d.access_token, until: Date.now() + d.expires_in * 1000, scope: d.scope ?? "" };
  return d.access_token;
}

async function call<T>(path: string, init: RequestInit = {}, runId?: number): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", ...init.headers } });
  await record("gmail", path.split("?")[0].replace(/\/[A-Za-z0-9_-]{10,}/g, "/:id"), { runId });
  if (res.status === 401 || res.status === 403) throw new GmailAuthError("Gmail permission missing: reconnect Gmail with draft access");
  if (!res.ok) throw new Error(`Gmail HTTP ${res.status}`);
  return (res.status === 204 ? null : res.json()) as T;
}

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// The recipient is never a parameter: it is always SEND_TO_EMAIL (FR-9.1, T-SEC-3).
export function buildMime(subject: string, text: string): string {
  const to = env().SEND_TO_EMAIL;
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
  return [`To: ${to}`, `Subject: ${encodedSubject}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: 8bit", "", text].join("\r\n");
}

export async function createDraft(subject: string, text: string, runId?: number): Promise<{ draftId: string; threadId: string; messageId: string }> {
  const d = await call<{ id: string; message: { id: string; threadId: string } }>("/drafts", { method: "POST", body: JSON.stringify({ message: { raw: b64url(buildMime(subject, text)) } }) }, runId);
  return { draftId: d.id, threadId: d.message.threadId, messageId: d.message.id };
}

export async function draftExists(draftId: string): Promise<boolean> {
  try {
    await call(`/drafts/${draftId}?format=minimal`);
    return true;
  } catch (err) {
    if (err instanceof Error && /HTTP 404/.test(err.message)) return false;
    throw err;
  }
}

type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };

function textOf(p: Part): string {
  if (p.mimeType === "text/plain" && p.body?.data) return Buffer.from(p.body.data, "base64url").toString("utf8");
  for (const c of p.parts ?? []) {
    const t = textOf(c);
    if (t) return t;
  }
  return "";
}

// The sent message in a draft's thread, if the Growth Lead sent it.
export async function sentInThread(threadId: string): Promise<{ id: string; text: string; sentAt: string } | null> {
  const t = await call<{ messages?: { id: string; labelIds?: string[]; internalDate: string; payload: Part }[] }>(`/threads/${threadId}?format=full`);
  const sent = (t.messages ?? []).find((m) => m.labelIds?.includes("SENT"));
  if (!sent) return null;
  return { id: sent.id, text: textOf(sent.payload), sentAt: new Date(Number(sent.internalDate)).toISOString() };
}

export async function canDraft(): Promise<boolean> {
  await token();
  return /gmail\.(compose|modify)/.test(cached?.scope ?? "");
}
