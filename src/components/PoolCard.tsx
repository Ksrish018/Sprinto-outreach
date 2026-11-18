import type { PoolFunnel } from "@/lib/feeds/pool";
import { ReadFeedsButton } from "./ReadFeedsButton";
import ui from "./ui.module.css";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) + " IST" : "never");

// Steps ③ and ④ as a funnel: how many headlines became companies worth researching.
export function PoolCard({ pool }: { pool: PoolFunnel }) {
  const s = (k: string) => pool.byStatus[k] ?? 0;
  const steps: [string, number, string][] = [
    ["Funding headlines", pool.funding7d, "last 7 days, all feeds"],
    ["Companies found", pool.leads, "in the pool, all time"],
    ["Not B2B SaaS or out of ICP", s("excluded"), "dropped before any page fetch"],
    ["Already on a compliance tool", s("compliant"), "Vanta, Drata, Secureframe and others"],
    ["Website unreadable", s("unreachable"), "or the guessed site was wrong"],
    ["Waiting for pre-check", s("new"), "checked on the next read"],
    ["Ready to research", s("ready"), "ranked; the next run takes the top 30"],
    ["Taken by a run", s("queued") + s("researched"), "queued or researched"],
  ];
  return (
    <section className={ui.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 className={ui.cardTitle} style={{ marginBottom: 4 }}>Company pool</h2>
          <p className="caption" style={{ margin: 0 }}>News feeds are read every day at 06:00 IST. Last read: {fmt(pool.lastRead)}.</p>
        </div>
        <ReadFeedsButton />
      </div>
      <table className={ui.table} style={{ marginTop: 12 }}>
        <tbody>
          {steps.map(([label, n, note]) => (
            <tr key={label}>
              <td><b style={{ color: "var(--text1)" }}>{label}</b><div className="caption">{note}</div></td>
              <td className={ui.right} style={{ fontSize: 18, color: "var(--text1)" }}>{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {pool.feeds.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary className="caption" style={{ cursor: "pointer" }}>Yield per feed (last read)</summary>
          <table className={ui.table}>
            <thead><tr><th>Feed</th><th className={ui.right}>Items</th><th className={ui.right}>Funding</th><th className={ui.right}>New companies</th></tr></thead>
            <tbody>
              {pool.feeds.map((f) => (
                <tr key={f.feed}>
                  <td className="mono">{f.feed}{!f.ok && <span className={ui.errorText}> failed</span>}</td>
                  <td className={ui.right}>{f.items}</td><td className={ui.right}>{f.funding}</td><td className={ui.right}>{f.new_leads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}
