import { NextResponse } from "next/server";
import { z } from "zod";
import { RunError, createRun } from "@/lib/runs";

export const maxDuration = 300;

const Body = z.object({
  mode: z.enum(["discovery", "domains"]),
  domains: z.string().max(5000).optional(),
});

// Start a run (FR-1.2, FR-1.3). Only one run at a time; nothing is sent by a run in this milestone.
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send mode 'discovery' or 'domains' with a domain list." }, { status: 400 });
  try {
    const id = await createRun({ trigger: parsed.data.mode === "domains" ? "domains" : "manual", domainsText: parsed.data.domains });
    return NextResponse.json({ id });
  } catch (err) {
    const status = err instanceof RunError ? 409 : 500;
    return NextResponse.json({ error: err instanceof RunError ? err.message : "Could not start the run. Check the Health page." }, { status });
  }
}
