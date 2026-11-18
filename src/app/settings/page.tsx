import Link from "next/link";
import ui from "@/components/ui.module.css";
import { PageHeader } from "@/components/PageHeader";
import { connectionPresence } from "@/lib/env";
import { checkConnections, type CheckResult } from "@/lib/connections";

export default async function Settings({ searchParams }: PageProps<"/settings">) {
  const { test } = await searchParams;
  const presence = connectionPresence();
  const results = test === "1" ? await checkConnections() : null;

  const rows: { name: string; configured: boolean; result?: CheckResult }[] = [
    { name: "Neon", configured: presence.neon },
    { name: "Gemini", configured: presence.gemini },
    { name: "Hunter.io", configured: presence.hunter },
    { name: "HubSpot", configured: presence.hubspot },
    { name: "Gmail", configured: presence.gmail },
  ].map((r) => ({ ...r, result: results?.find((x) => x.name === r.name) }));

  return (
    <>
      <PageHeader title="Settings" meta="Connections to every tool. Key values are never shown." />
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

        <p className={ui.notice}>
          ICP rules, news feeds and the suppression list now live on the <Link className={ui.link} href="/icp">ICP page</Link>, where the Growth Lead confirms them.
        </p>
      </div>
    </>
  );
}
