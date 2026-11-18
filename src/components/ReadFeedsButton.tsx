"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ui from "./ui.module.css";

type Res = { read?: { feeds: number; funding: number; newHeadlines: number; newLeads: number; failedFeeds: string[] }; checked?: { checked: number; ready: number; compliant: number }; error?: string };

export function ReadFeedsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
      <button
        type="button"
        className={`${ui.btn} ${ui.btnSecondary}`}
        aria-disabled={busy}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setMsg("Reading news feeds and checking new companies. This can take up to 4 minutes.");
          const res = await fetch("/api/feeds", { method: "POST" });
          const d = (await res.json().catch(() => ({ error: "No response" }))) as Res;
          setMsg(
            d.error ??
              `${d.read?.feeds} feeds · ${d.read?.funding} funding headlines · ${d.read?.newHeadlines} new · ${d.read?.newLeads} new companies · ` +
                `${d.checked?.checked} checked: ${d.checked?.ready} ready, ${d.checked?.compliant} already on a tool` +
                (d.read?.failedFeeds.length ? ` · failed: ${d.read.failedFeeds.join(", ")}` : ""),
          );
          setBusy(false);
          router.refresh();
        }}
      >
        {busy ? "Reading…" : "Read feeds now"}
      </button>
      {msg && <span role="status" className="caption" style={{ maxWidth: 420, textAlign: "right" }}>{msg}</span>}
    </div>
  );
}
