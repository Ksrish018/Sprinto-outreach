import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { syncGmail } from "@/lib/sync";

export const maxDuration = 300;

// Daily 08:00 IST. Requires the cron secret (T-SEC-4).
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env().CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await syncGmail());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message.slice(0, 120) }, { status: 500 });
  }
}
