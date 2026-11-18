"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ui from "./ui.module.css";

export function ConfirmIcpButton({ version }: { version: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
      <button
        type="button"
        className={`${ui.btn} ${ui.btnPrimary}`}
        aria-disabled={busy}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          const res = await fetch("/api/icp/confirm", { method: "POST" });
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          setMsg(d.error ?? `ICP v${version} confirmed`);
          setBusy(false);
          router.refresh();
        }}
      >
        {busy ? "Saving…" : `Confirm ICP v${version}`}
      </button>
      {msg && <span role="status" className="caption">{msg}</span>}
    </div>
  );
}
