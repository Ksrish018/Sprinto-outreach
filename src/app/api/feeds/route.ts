import { NextResponse } from "next/server";
import { TooSoonError, refreshPool } from "@/lib/feeds/refresh";

export const maxDuration = 300;

// "Read feeds now" on the Pipeline page. At most once every 10 minutes, so it cannot run up AI cost.
export async function POST() {
  try {
    return NextResponse.json(await refreshPool(Date.now() + 230_000));
  } catch (err) {
    if (err instanceof TooSoonError) return NextResponse.json({ error: err.message }, { status: 429 });
    return NextResponse.json({ error: "Could not read the feeds. Check the Health page." }, { status: 500 });
  }
}
