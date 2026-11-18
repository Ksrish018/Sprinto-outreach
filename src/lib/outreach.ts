import "server-only";
import { sql } from "./db";
import { env } from "./env";
import { Gemini } from "./gemini";
import { GmailAuthError, createDraft } from "./gmail";
import { composeEmail } from "./memory/diff";
import { retrieve, situationText } from "./memory/store";
import { record } from "./ledger";
import { type DraftFact, pickHook, writeDraft } from "./draft/write";
import { type Trigger, pickPains } from "./draft/pains";
import { Hunter, QuotaError, acceptable } from "./people/hunter";
import { pickReason, preferredRoles, rankCandidates } from "./people/pick";
import { parseEmployees } from "./research/evidence";

const MAX_VERIFICATIONS = 2; // per company, to protect the free quota
const DAILY_CAP = 20; // Gmail drafts per day (D5)

type FactRow = { id: number; question_id: string; field: string; value: string; quote: string; verified: boolean };

async function flag(runId: number, companyId: number, text: string, outcome?: "human") {
  await sql()`update decisions set flags = flags || ${JSON.stringify([text])}::jsonb,
    outcome = coalesce(${outcome ?? null}, outcome)
    where run_id = ${runId} and company_id = ${companyId}`;
}

// Steps 4 to 6 of the case for one Go company: find the person, pick two pains, write and check the draft.
export async function personAndDraft(runId: number, companyId: number): Promise<string> {
  const q = sql();
  const [c] = (await q`select c.domain, c.name, d.triggers from companies c
    join decisions d on d.company_id = c.id and d.run_id = ${runId} where c.id = ${companyId}`) as { domain: string; name: string | null; triggers: { audit_prep: boolean; enterprise_pressure: boolean } }[];
  const facts = (await q`select id, question_id, field, value, quote, verified from facts where company_id = ${companyId} and run_id = ${runId}`) as FactRow[];

  const emp = facts.filter((f) => f.question_id === "Q3").map((f) => parseEmployees(f.value)).find(Boolean);
  const employees = emp ? Math.round((emp.min + emp.max) / 2) : 100;

  // FR-5: Hunter only for Go companies, behind the quota guard.
  const hunter = new Hunter(env().HUNTER_API_KEY, fetch, (kind, remaining) => record(kind, kind === "hunter_search" ? "domain-search" : "email-verifier", { runId }, 1, remaining));
  let ranked;
  try {
    const { candidates } = await hunter.domainSearch(c.domain);
    ranked = rankCandidates(candidates, preferredRoles(employees, c.triggers.enterprise_pressure));
  } catch (err) {
    if (err instanceof QuotaError) {
      await flag(runId, companyId, `Needs person: ${err.message}`);
      return "needs_person";
    }
    throw err;
  }

  let chosen: (typeof ranked)[number] | null = null;
  let verifyStatus = "";
  for (const cand of ranked.slice(0, MAX_VERIFICATIONS)) {
    const v = await hunter.verify(cand.email);
    if (acceptable(v, cand.confidence)) {
      chosen = cand;
      verifyStatus = v.status;
      break;
    }
  }
  if (!chosen) {
    await flag(runId, companyId, "No reachable person: no verified email for the right role", "human");
    return "no_person";
  }

  const [contact] = (await q`insert into contacts (company_id, name, title, email, hunter_confidence, verify_status, pick_reason)
    values (${companyId}, ${`${chosen.firstName} ${chosen.lastName}`.trim()}, ${chosen.position}, ${chosen.email}, ${chosen.confidence}, ${verifyStatus}, ${pickReason(employees, chosen)})
    returning id`) as { id: number }[];

  // FR-6 and FR-7.
  const verified: DraftFact[] = facts.filter((f) => f.verified).map((f) => ({ id: `F${f.id}`, question: f.question_id, field: f.field, value: f.value, quote: f.quote, verified: true }));
  const hook = pickHook(verified);
  if (!hook) {
    await flag(runId, companyId, "No verified fact strong enough for a hook", "human");
    return "no_hook";
  }
  const triggers: Trigger[] = [...(c.triggers.audit_prep ? ["audit_prep" as const] : []), ...(c.triggers.enterprise_pressure ? ["enterprise" as const] : [])];
  const pains = pickPains(chosen.group, triggers, {
    holdsCert: facts.some((f) => f.question_id === "Q2" && f.field === "certifications"),
    hiringCompliance: facts.some((f) => f.question_id === "Q4" && f.field === "compliance_job"),
  });
  const stage = facts.find((f) => f.question_id === "Q6" && f.field === "funding_round")?.value ?? null;
  const segment = `${chosen.group}:${triggers[0] ?? "none"}`;

  // Retrieve -> Apply (Loop 3): the closest past corrections for this role and situation, or nothing below the floor.
  const industry = facts.find((f) => f.question_id === "Q7" && f.field === "industry")?.value ?? null;
  const situation = situationText({ roleGroup: chosen.group, trigger: triggers[0] ?? "none", stage, industry, employees, company: c.name ?? c.domain });
  const memory = await retrieve(chosen.group, situation, runId).catch(() => []);

  const g = new Gemini({ apiKey: env().GEMINI_API_KEY, model: env().GEMINI_MODEL, onCall: (kind) => record(kind, "generateContent", { runId }) });
  const out = await writeDraft(g, {
    company: c.name ?? c.domain, person: { firstName: chosen.firstName, position: chosen.position }, hook, facts: verified, pains,
    corrections: memory.map((m) => ({ before: m.before, after: m.after, reason: m.reason })),
  });

  const [draft] = (await q`insert into drafts (company_id, contact_id, run_id, subject, hook, body, cta, hook_fact_id, claim_map, pains, segment, stage, memory_ids, status)
    values (${companyId}, ${contact.id}, ${runId}, ${out.draft.subject}, ${out.draft.hook}, ${out.draft.body}, ${out.draft.cta},
      ${Number(hook.id.slice(1))}, ${JSON.stringify({ claims: out.draft.claims, problems: out.problems, attempts: out.attempts })},
      ${JSON.stringify(pains.map((p) => ({ id: p.id, text: p.text })))}, ${segment}, ${stage}, ${memory.map((m) => m.id)}, ${out.ok ? "drafted" : "blocked"})
    on conflict (company_id, run_id) do update set subject = excluded.subject, hook = excluded.hook, body = excluded.body, cta = excluded.cta,
      claim_map = excluded.claim_map, pains = excluded.pains, status = excluded.status, contact_id = excluded.contact_id, memory_ids = excluded.memory_ids
    returning id`) as { id: number }[];
  if (!out.ok) {
    await flag(runId, companyId, `Draft failed checks twice: ${out.problems[0]}`, "human");
    return "blocked";
  }

  // Act: a Gmail draft to our own inbox, never sent by the system (FR-9). The kill switch blocks it (FR-11.1).
  const [kill] = (await q`select is_on from kill_state where id = 1`) as { is_on: boolean }[];
  if (kill?.is_on) {
    await flag(runId, companyId, "Kill switch on: draft kept in the app, not sent to Gmail");
    return "drafted";
  }
  const [{ today }] = (await q`select count(*)::int as today from drafts where status <> 'drafted' and status <> 'blocked' and created_at > now() - interval '1 day'`) as { today: number }[];
  if (today >= DAILY_CAP) {
    await flag(runId, companyId, `Daily cap of ${DAILY_CAP} Gmail drafts reached`);
    return "drafted";
  }
  try {
    const pilot = `Pilot: would go to ${chosen.firstName} ${chosen.lastName} <${chosen.email}>, ${chosen.position}, ${c.name ?? c.domain}`.replace(/\s+/g, " ");
    const gd = await createDraft(out.draft.subject, composeEmail(pilot, out.draft, env().SENDER_NAME), runId);
    await q`update drafts set gmail_draft_id = ${gd.draftId}, thread_id = ${gd.threadId}, status = 'in_gmail' where id = ${draft.id}`;
    return "in_gmail";
  } catch (err) {
    await flag(runId, companyId, err instanceof GmailAuthError ? `Gmail: ${err.message}` : `Gmail draft failed: ${(err as Error).message.slice(0, 80)}`);
    return "drafted";
  }
}
