"use client";

import { Play } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ui from "./ui.module.css";

async function start(body: object): Promise<{ id?: number; error?: string }> {
  const res = await fetch("/api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

// "Run now" sits on the plum header; it searches for new companies (FR-1.2).
export function RunNowButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
      <button
        type="button"
        className={`${ui.btn} ${ui.btnOnPlum}`}
        aria-disabled={disabled || busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const r = await start({ mode: "discovery" });
          if (r.id) router.push(`/pipeline?run=${r.id}`);
          else {
            setError(r.error ?? "Could not start the run.");
            setBusy(false);
          }
        }}
      >
        <Play size={16} aria-hidden /> {busy ? "Finding companies…" : "Run now"}
      </button>
      {error && <span style={{ fontSize: 12, color: "var(--on-plum)" }}>{error}</span>}
    </div>
  );
}

// "Run on domains" (FR-1.3): up to 50 domains, normalised and de-duplicated on the server.
export function DomainRunForm({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className={ui.card}
      style={{ display: "grid", gap: 12 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const r = await start({ mode: "domains", domains: text });
        if (r.id) router.push(`/pipeline?run=${r.id}`);
        else {
          setError(r.error ?? "Could not start the run.");
          setBusy(false);
        }
      }}
    >
      <div>
        <h2 className={ui.cardTitle}>Run on a list of domains</h2>
        <p className="caption" style={{ margin: 0 }}>Up to 50, separated by commas, spaces or new lines. Suppressed and HubSpot domains are skipped.</p>
      </div>
      <label htmlFor="domains" className="label" style={{ color: "var(--text3)" }}>Domains</label>
      <textarea id="domains" className={ui.input} rows={4} placeholder="acme.com, example.io" value={text} onChange={(e) => setText(e.target.value)} />
      <div className={ui.row}>
        <button type="submit" className={`${ui.btn} ${ui.btnPrimary}`} aria-disabled={disabled || busy || !text.trim()}>
          {busy ? "Starting…" : "Research these"}
        </button>
        {disabled && <span className="caption">A run is already in progress.</span>}
        {error && <span className={ui.errorText}>{error}</span>}
      </div>
    </form>
  );
}
