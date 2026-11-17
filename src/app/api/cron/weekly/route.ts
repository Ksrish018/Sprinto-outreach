import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { RunError, createRun, runUntil } from "@/lib/runs";

export const maxDuration = 300;

// Monday 09:00 IST (vercel.json). Vercel sends "Authorization: Bearer <CRON_SECRET>"; anything else is refused (T-SEC-4).
// Companies not finished inside the time limit stay queued and are picked up from the Pipeline page.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env().CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const id = await createRun({ trigger: "cron" });
    const done = await runUntil(id, Date.now() + 240_000);
    return NextResponse.json({ id, processed: done.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof RunError ? err.message : "Run failed" }, { status: err instanceof RunError ? 409 : 500 });
  }
}
