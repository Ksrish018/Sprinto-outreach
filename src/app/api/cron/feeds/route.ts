import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { refreshPool } from "@/lib/feeds/refresh";

export const maxDuration = 300;

// Daily 06:00 IST (vercel.json): steps ③ and ④ fill the company pool. Requires the cron secret (T-SEC-4).
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env().CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await refreshPool(Date.now() + 240_000, { force: true }));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message.slice(0, 120) }, { status: 500 });
  }
}
