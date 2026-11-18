import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { personAndDraft } from "@/lib/outreach";

export const maxDuration = 300;

// Human review (FR-4.4): the Growth Lead approves a Human-review company as Go.
// The override is recorded beside the original decision, then the person and draft steps run as for any Go.
export async function POST(_req: Request, ctx: RouteContext<"/api/companies/[id]/approve">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Bad company id" }, { status: 400 });
  const q = sql();
  const [d] = (await q`select id, run_id, outcome from decisions where company_id = ${id} order by id desc limit 1`) as { id: number; run_id: number; outcome: string }[];
  if (!d) return NextResponse.json({ error: "This company has no decision yet." }, { status: 404 });
  if (d.outcome !== "human") return NextResponse.json({ error: "Only Human-review companies can be approved." }, { status: 409 });
  const [existing] = (await q`select id from drafts where company_id = ${id} and run_id = ${d.run_id} limit 1`) as { id: number }[];
  if (existing) return NextResponse.json({ error: "A draft already exists for this company." }, { status: 409 });

  await q`update decisions set outcome = 'go_flag',
    override = ${JSON.stringify({ from: "human", to: "go", by: "growth_lead", at: new Date().toISOString() })}::jsonb,
    flags = flags || ${JSON.stringify(["Approved as Go by the Growth Lead after human review"])}::jsonb
    where id = ${d.id}`;
  try {
    const result = await personAndDraft(d.run_id, id);
    return NextResponse.json({ result });
  } catch (err) {
    await q`update decisions set flags = flags || ${JSON.stringify([`Person or draft step failed: ${(err as Error).message.slice(0, 120)}`])}::jsonb where id = ${d.id}`;
    return NextResponse.json({ error: "Person or draft step failed. See the flags on this page." }, { status: 500 });
  }
}
