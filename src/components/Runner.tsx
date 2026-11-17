"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ui from "./ui.module.css";

type Progress = { run: { status: string }; byStatus: Record<string, number> };

// Drives a running run one company at a time while this page is open (FR-1.5, FR-1.6).
export function Runner({ runId, running }: { runId: number; running: boolean }) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!running || paused) return;
    // Each effect run owns its loop; claiming a company is atomic on the server, so an overlap is harmless.
    let stop = false;
    (async () => {
      while (!stop) {
        try {
          const res = await fetch(`/api/runs/${runId}/step`, { method: "POST" });
          const data = (await res.json()) as { done: { domain: string; outcome: string } | null; progress: Progress };
          setError(null);
          if (data.done) setLast(`${data.done.domain}: ${data.done.outcome.replace("_", " ")}`);
          setLeft((data.progress.byStatus.queued ?? 0) + (data.progress.byStatus.researching ?? 0));
          router.refresh();
          if (data.progress.run.status !== "running") break;
        } catch {
          setError("Lost connection; retrying in 5 seconds.");
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    })();
    return () => {
      stop = true;
    };
  }, [runId, running, paused, router]);

  if (!running) return null;
  return (
    <div className={ui.notice} role="status" aria-live="polite" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span className={`${ui.dot} ${paused ? ui.dotMuted : ui.dotWarn}`} />
      <span>
        {paused ? "Paused." : "Researching one company at a time."} {left !== null && `${left} left.`} {last && `Last: ${last}.`}
      </span>
      {error && <span className={ui.errorText}>{error}</span>}
      <button type="button" className={`${ui.btn} ${ui.btnSecondary}`} onClick={() => setPaused((p) => !p)} style={{ marginLeft: "auto" }}>
        {paused ? "Resume" : "Pause"}
      </button>
    </div>
  );
}
