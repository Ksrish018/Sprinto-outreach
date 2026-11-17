import ui from "@/components/ui.module.css";
import { PageHeader } from "@/components/PageHeader";
import { getKillState, getMonthLedger } from "@/lib/queries";
import { disagreementNow } from "@/lib/sync";

const QUOTA: Record<string, { label: string; limit?: number }> = {
  hunter_search: { label: "Hunter searches", limit: 50 },
  hunter_verify: { label: "Hunter verifications", limit: 100 },
  gemini: { label: "Gemini calls" },
  gemini_search: { label: "Gemini grounded searches" },
  gemini_embed: { label: "Gemini embeddings" },
  hubspot: { label: "HubSpot calls" },
  gmail: { label: "Gmail calls" },
  jina: { label: "Jina Reader pages" },
};

export default async function Health() {
  const [kill, ledger, dis] = await Promise.all([getKillState(), getMonthLedger(), disagreementNow()]);
  return (
    <>
      <PageHeader title="Health" meta="Kill switch, API spend this month, and whether every loop is closing" />
      <div className={ui.page}>
        <div className={ui.grid}>
          <section className={ui.card}>
            <span className="label" style={{ color: "var(--text3)" }}>Kill switch</span>
            <p style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, margin: "8px 0 0" }}>
              <span className={`${ui.dot} ${kill.is_on ? ui.dotError : ui.dotOk}`} />
              {kill.is_on ? `On: ${kill.fired_line ?? "manual"}` : "Off: drafting allowed"}
            </p>
          </section>
          <section className={ui.card}>
            <span className="label" style={{ color: "var(--text3)" }}>Disagreement score</span>
            <p style={{ fontSize: 18, margin: "8px 0 0" }}>{dis.n ? `${Math.round(dis.score * 100)}%` : "No sent drafts yet"}</p>
            <p className="caption" style={{ margin: "4px 0 0" }}>Last {dis.n} sent or discarded drafts. Kill line: above 50% over 20, after 2 weeks. Should fall week on week.</p>
          </section>
        </div>

        <section className={ui.card}>
          <h2 className={ui.cardTitle}>API spend this month</h2>
          {ledger.length === 0 ? (
            <p className="caption" style={{ margin: 0 }}>No live API calls recorded yet. Every call made by a run or a test is logged here.</p>
          ) : (
            <table className={ui.table}>
              <thead><tr><th>API</th><th className={ui.right}>Calls</th><th className={ui.right}>Credits</th></tr></thead>
              <tbody>
                {ledger.map((r) => (
                  <tr key={r.api}>
                    <td>{QUOTA[r.api]?.label ?? r.api}</td>
                    <td className={ui.right}>{r.calls}</td>
                    <td className={ui.right}>{QUOTA[r.api]?.limit ? `${r.credits} / ${QUOTA[r.api].limit}` : r.credits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={ui.card}>
          <h2 className={ui.cardTitle}>Loop health</h2>
          <p className="caption" style={{ marginTop: 0 }}>Checks that the learning loop closes, not just that it runs.</p>
          <table className={ui.table}>
            <tbody>
              <tr><td>Corrections stored (before/after pairs)</td><td className={ui.right}>{dis.corrections}</td></tr>
              <tr><td>Drafts that used past corrections</td><td className={ui.right}>{dis.withMemory} of {dis.drafts}</td></tr>
              <tr><td>Disagreement score (last {dis.n})</td><td className={ui.right}>{dis.n ? `${Math.round(dis.score * 100)}%` : "n/a"}</td></tr>
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
