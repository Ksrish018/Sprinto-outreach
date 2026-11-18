"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ui from "./ui.module.css";

const RESULT: Record<string, string> = {
  in_gmail: "Draft is waiting in your Gmail",
  drafted: "Draft written (not in Gmail)",
  needs_person: "Hunter quota low: person not found",
  no_person: "No verified person for the right role",
  no_hook: "No verified fact strong enough for a hook",
  blocked: "Draft blocked by the claim checker",
};

export function ApproveButton({ companyId }: { companyId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div style={{ display: "grid", gap: 6, margin: "0 0 16px" }}>
      <button
        type="button"
        className={`${ui.btn} ${ui.btnPrimary}`}
        aria-disabled={busy}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setMsg("Finding the person and writing the draft. This takes up to a minute.");
          const res = await fetch(`/api/companies/${companyId}/approve`, { method: "POST" });
          const d = (await res.json().catch(() => ({}))) as { result?: string; error?: string };
          setMsg(d.error ?? RESULT[d.result ?? ""] ?? `Done: ${d.result}`);
          setBusy(false);
          router.refresh();
        }}
      >
        {busy ? "Working…" : "Approve as Go"}
      </button>
      {msg && <span role="status" className="caption">{msg}</span>}
    </div>
  );
}
