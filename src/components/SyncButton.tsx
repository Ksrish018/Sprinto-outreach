"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ui from "./ui.module.css";

type SyncResult = { checked?: number; sent?: number; edited?: number; discarded?: number; error?: string };

export function SyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div style={{ display: "grid", gap: 6, justifyItems: "end", marginLeft: "auto" }}>
      <button
        type="button"
        className={`${ui.btn} ${ui.btnOnPlum}`}
        aria-disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch("/api/sync", { method: "POST" });
          const d = (await res.json()) as SyncResult;
          setMsg(d.error ?? `Checked ${d.checked}: ${d.sent} sent (${d.edited} edited), ${d.discarded} discarded`);
          setBusy(false);
          router.refresh();
        }}
      >
        {busy ? "Syncing…" : "Sync with Gmail"}
      </button>
      {msg && <span role="status" style={{ fontSize: 12, color: "var(--on-plum)" }}>{msg}</span>}
    </div>
  );
}
