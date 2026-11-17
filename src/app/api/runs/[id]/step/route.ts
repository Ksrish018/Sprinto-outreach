import { NextResponse } from "next/server";
import { processNext, runProgress } from "@/lib/runs";

export const maxDuration = 300;

// Process one company of a run (FR-1.5): each company is its own short step, so runs survive time limits.
export async function POST(_req: Request, ctx: RouteContext<"/api/runs/[id]/step">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Bad run id" }, { status: 400 });
  const done = await processNext(id);
  const progress = await runProgress(id);
  return NextResponse.json({ done, progress });
}

export async function GET(_req: Request, ctx: RouteContext<"/api/runs/[id]/step">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Bad run id" }, { status: 400 });
  return NextResponse.json({ progress: await runProgress(id) });
}
