import "server-only";
import { sql } from "./db";
import { Gemini } from "./gemini";
import { env } from "./env";
import { draftExists, sentInThread } from "./gmail";
import { record } from "./ledger";
import { type Parts, delta, disagreement, splitSent } from "./memory/diff";
import { REVIEWER, embed, situationText } from "./memory/store";

const DISCARD_AFTER_DAYS = 3;
const KILL = { window: 20, maxDisagreement: 0.5, minDays: 14 };

type Open = {
  id: number; run_id: number; company_id: number; gmail_draft_id: string; thread_id: string; created_at: string;
  hook: string; body: string; cta: string; segment: string | null; stage: string | null; company: string;
};

async function inferReason(before: Parts, after: Parts, runId: number): Promise<string | null> {
  const g = new Gemini({ apiKey: env().GEMINI_API_KEY, model: env().GEMINI_MODEL, onCall: (k) => record(k, "generateContent", { runId }) });
  try {
    const r = await g.json<{ reason: string }>(
      `A sales lead edited an AI-drafted cold email before sending. In one short sentence (max 20 words), state the most likely reason for the change, as a rule for future emails.\nBefore:\n${before.hook}\n${before.body}\n${before.cta}\nAfter:\n${after.hook}\n${after.body}\n${after.cta}`,
      { type: "OBJECT", properties: { reason: { type: "STRING" } }, required: ["reason"] },
    );
    return r.reason?.slice(0, 200) ?? null;
  } catch {
    return null;
  }
}

// Signal -> Capture -> Store (FR-8.3, FR-13.1, FR-13.2) for every draft waiting in Gmail.
export async function syncGmail(): Promise<{ checked: number; sent: number; edited: number; discarded: number }> {
  const q = sql();
  const open = (await q`select dr.id, dr.run_id, dr.company_id, dr.gmail_draft_id, dr.thread_id, dr.created_at, dr.hook, dr.body, dr.cta,
      dr.segment, dr.stage, coalesce(c.name, c.domain) as company
    from drafts dr join companies c on c.id = dr.company_id
    where dr.status = 'in_gmail' and dr.thread_id is not null order by dr.id limit 50`) as Open[];
  const out = { checked: open.length, sent: 0, edited: 0, discarded: 0 };

  for (const d of open) {
    const sent = await sentInThread(d.thread_id);
    if (sent) {
      const before: Parts = { hook: d.hook, body: d.body, cta: d.cta };
      const after = splitSent(sent.text);
      const dl = delta(before, after);
      const edited = dl.changed.length > 0;
      await q`insert into sends (draft_id, gmail_message_id, thread_id, outcome, sent_at) values (${d.id}, ${sent.id}, ${d.thread_id}, ${edited ? "edited" : "accepted"}, ${sent.sentAt})
        on conflict (draft_id) do nothing`;
      await q`update drafts set status = ${edited ? "sent_edited" : "sent_as_is"} where id = ${d.id}`;
      out.sent++;
      if (edited) {
        out.edited++;
        const facts = (await q`select question_id, field, value from facts where company_id = ${d.company_id} and run_id = ${d.run_id}`) as { question_id: string; field: string; value: string }[];
        const pick = (qq: string, f: string) => facts.find((x) => x.question_id === qq && x.field === f)?.value ?? null;
        const [roleGroup, trigger] = (d.segment ?? "engineering:none").split(":");
        const employees = Number(pick("Q3", "employees")?.match(/\d+/)?.[0]) || null;
        const situation = situationText({ roleGroup, trigger, stage: d.stage, industry: pick("Q7", "industry"), employees, company: d.company });
        const reason = await inferReason(before, after, d.run_id);
        const vec = await embed(situation, d.run_id).catch(() => null);
        await q`insert into corrections (draft_id, reviewer, before_text, after_text, delta, reason, reason_source, segment, stage, role_group, industry, situation_text, embedding)
          values (${d.id}, ${REVIEWER}, ${`${before.hook}\n${before.body}\n${before.cta}`}, ${`${after.hook}\n${after.body}\n${after.cta}`}, ${JSON.stringify(dl)},
            ${reason}, ${reason ? "inferred" : null}, ${d.segment ?? "unknown"}, ${d.stage}, ${roleGroup}, ${pick("Q7", "industry")}, ${situation},
            ${vec ? `[${vec.join(",")}]` : null}::vector)`;
      }
      continue;
    }
    const exists = await draftExists(d.gmail_draft_id);
    const old = Date.now() - new Date(d.created_at).getTime() > DISCARD_AFTER_DAYS * 86_400_000;
    if (!exists || old) {
      await q`insert into sends (draft_id, thread_id, outcome) values (${d.id}, ${d.thread_id}, 'discarded') on conflict (draft_id) do nothing`;
      await q`update drafts set status = 'discarded' where id = ${d.id}`;
      out.discarded++;
    }
  }
  await checkKill();
  return out;
}

export async function disagreementNow(): Promise<{ score: number; n: number; corrections: number; withMemory: number; drafts: number }> {
  const q = sql();
  const rows = (await q`select s.outcome, coalesce((c.delta->>'overall')::float, 0) as size from sends s
    left join corrections c on c.draft_id = s.draft_id
    where s.outcome is not null order by s.id desc limit ${KILL.window}`) as { outcome: "accepted" | "edited" | "discarded"; size: number }[];
  const [m] = (await q`select (select count(*)::int from corrections) as corrections,
      (select count(*)::int from drafts where cardinality(memory_ids) > 0) as with_memory,
      (select count(*)::int from drafts) as drafts`) as { corrections: number; with_memory: number; drafts: number }[];
  return { score: disagreement(rows), n: rows.length, corrections: m.corrections, withMemory: m.with_memory, drafts: m.drafts };
}

// Kill line (FR-11.2): disagreement above 50% over the last 20 drafts, once learning has had 2 weeks.
async function checkKill() {
  const d = await disagreementNow();
  if (d.n < KILL.window || d.score <= KILL.maxDisagreement) return;
  const [first] = (await sql()`select min(created_at) as at from drafts`) as { at: string | null }[];
  if (!first.at || Date.now() - new Date(first.at).getTime() < KILL.minDays * 86_400_000) return;
  await sql()`update kill_state set is_on = true, fired_line = ${`Disagreement score ${Math.round(d.score * 100)}% over the last ${d.n} drafts`},
    numbers = ${JSON.stringify(d)}, fired_at = now() where id = 1 and is_on = false`;
}
