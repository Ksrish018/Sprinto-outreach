import { NextResponse } from "next/server";
import { GmailAuthError } from "@/lib/gmail";
import { syncGmail } from "@/lib/sync";

export const maxDuration = 300;

// "Sync with Gmail": read what was sent, edited or discarded, and learn from the edits (Loop 3).
export async function POST() {
  try {
    return NextResponse.json(await syncGmail());
  } catch (err) {
    const auth = err instanceof GmailAuthError;
    return NextResponse.json({ error: auth ? err.message : "Sync failed. Check the Health page." }, { status: auth ? 409 : 500 });
  }
}
