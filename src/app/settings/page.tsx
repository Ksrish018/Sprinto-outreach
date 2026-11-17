import Link from "next/link";
import ui from "@/components/ui.module.css";
import { PageHeader } from "@/components/PageHeader";
import { connectionPresence } from "@/lib/env";
import { checkConnections, type CheckResult } from "@/lib/connections";
import { getCurrentIcp, getSuppression } from "@/lib/queries";

const LABELS: Record<string, string> = {
  audit_prep: "Preparing for an audit (trigger)",
  enterprise_pressure: "Enterprise pressure (trigger)",
  funding_a_to_c: "Funding A to C",
  client_size: "Client size",
  regulated_industry: "Regulated industry",
  cloud_stack: "Cloud stack",
  geography: "Geography",
};

export default async function Settings({ searchParams }: PageProps<"/settings">) {
  const { test } = await searchParams;
  const presence = connectionPresence();
  const [icp, suppression, results] = await Promise.all([
    getCurrentIcp(),
    getSuppression(),
    test === "1" ? checkConnections() : Promise.resolve<CheckResult[] | null>(null),
  ]);

  const rows: { name: string; configured: boolean; result?: CheckResult }[] = [
    { name: "Neon", configured: presence.neon },
    { name: "Gemini", configured: presence.gemini },
    { name: "Hunter.io", configured: presence.hunter },
    { name: "HubSpot", configured: presence.hubspot },
    { name: "Gmail", configured: presence.gmail },
  ].map((r) => ({ ...r, result: results?.find((x) => x.name === r.name) }));

  return (
    <>
      <PageHeader title="Settings" meta="Connections, ICP rules and the suppression list. Key values are never shown." />
      <div className={ui.page}>
        <section className={ui.card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
            <h2 className={ui.sectionTitle}>Connections</h2>
            <Link href="/settings?test=1" className={`${ui.btn} ${ui.btnSecondary}`} prefetch={false}>
              Test connections
            </Link>
          </div>
          <table className={ui.table}>
            <thead>
              <tr><th>Service</th><th>Configured</th><th>Live test</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td style={{ color: "var(--text1)", fontWeight: 600 }}>{r.name}</td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span className={`${ui.dot} ${r.configured ? ui.dotOk : ui.dotError}`} />
                      {r.configured ? "Yes" : "Missing"}
                    </span>
                  </td>
                  <td>
                    {r.result ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span className={`${ui.dot} ${r.result.ok ? ui.dotOk : ui.dotError}`} />
                        {r.result.detail}
                      </span>
                    ) : (
                      <span className="caption">Not tested yet. Tests use free endpoints only.</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className={ui.grid}>
          <section className={ui.card}>
            <h2 className={ui.cardTitle}>ICP rules v{icp?.id}</h2>
            <p className="caption" style={{ marginTop: 0 }}>{icp?.note} · editing arrives in M6</p>
            <table className={ui.table}>
              <thead><tr><th>Score item</th><th className={ui.right}>Points</th></tr></thead>
              <tbody>
                {icp && Object.entries(icp.weights).map(([k, v]) => (
                  <tr key={k}><td>{LABELS[k] ?? k}</td><td className={ui.right}>{v}</td></tr>
                ))}
                <tr><td style={{ color: "var(--text1)", fontWeight: 600 }}>Go needs all gates, one trigger and a score of at least</td><td className={ui.right} style={{ color: "var(--text1)", fontWeight: 600 }}>{icp?.thresholds.go_score}</td></tr>
              </tbody>
            </table>
          </section>

          <section className={ui.card}>
            <h2 className={ui.cardTitle}>Never prospected</h2>
            <p className="caption" style={{ marginTop: 0 }}>Suppression list: always skipped in discovery and domain runs</p>
            <table className={ui.table}>
              <thead><tr><th>Domain</th><th>Reason</th></tr></thead>
              <tbody>
                {suppression.map((s) => (
                  <tr key={s.domain}><td className="mono">{s.domain}</td><td>{s.reason}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </>
  );
}
