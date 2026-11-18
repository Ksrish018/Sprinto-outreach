import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// The Growth Lead confirms the ICP shown on the ICP page. Recorded in the audit log with the version confirmed.
export async function POST() {
  const [icp] = (await sql()`select id from icp_versions order by id desc limit 1`) as { id: number }[];
  if (!icp) return NextResponse.json({ error: "No ICP version found." }, { status: 404 });
  await sql()`insert into audit_log (actor, action, entity, after) values ('growth_lead', 'confirm_icp', ${`icp_versions:${icp.id}`}, ${JSON.stringify({ version: icp.id })}::jsonb)`;
  return NextResponse.json({ confirmed: icp.id });
}
