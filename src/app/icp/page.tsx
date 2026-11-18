import Link from "next/link";
import { ConfirmIcpButton } from "@/components/ConfirmIcpButton";
import { PageHeader } from "@/components/PageHeader";
import ui from "@/components/ui.module.css";
import { RANK_RULES } from "@/lib/feeds/rank";
import { FEEDS } from "@/lib/feeds/sources";
import { getCurrentIcp, getIcpConfirmation, getSuppression } from "@/lib/queries";

export const metadata = { title: "ICP · Sprinto Outreach" };

const LABELS: Record<string, string> = {
  audit_prep: "Preparing for an audit (trigger)",
  enterprise_pressure: "Enterprise customers pushing them (trigger)",
  funding_a_to_c: "Raised Series A to C",
  client_size: "Has large, named clients",
  regulated_industry: "Regulated industry",
  cloud_stack: "Runs on a public cloud",
  geography: "Geography fits Sprinto's markets",
};

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export default async function Icp() {
  const [icp, confirmed, suppression] = await Promise.all([getCurrentIcp(), getIcpConfirmation(), getSuppression()]);
  const t = icp?.thresholds ?? {};
  const current = confirmed && icp && confirmed.version === icp.id;

  return (
    <>
      <PageHeader title="ICP" meta="Who we target, where we find them and how each company is judged. Confirm it before the week's run." />
      <div className={ui.page}>
        <section className={ui.card} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <span className="label" style={{ color: "var(--text3)" }}>ICP v{icp?.id} · {icp?.note}</span>
            <p style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 17, margin: "8px 0 0" }}>
              <span className={`${ui.dot} ${current ? ui.dotOk : ui.dotWarn}`} />
              {current ? `Confirmed by the Growth Lead on ${day(confirmed.at)}` : confirmed ? `An older version (v${confirmed.version}) was confirmed; this one is not yet` : "Not confirmed yet"}
            </p>
          </div>
          {icp && <ConfirmIcpButton version={icp.id} />}
        </section>

        <section className={ui.card}>
          <h2 className={ui.cardTitle}>Who we target</h2>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: "var(--text1)" }}>
            A <b>B2B SaaS</b> company with <b>{t.employees_min ?? 20} to {t.employees_max ?? 500} employees</b>, usually <b>Series A to C</b>,
            that does <b>not yet use a compliance tool</b>, and is either <b>preparing for an audit</b> (SOC 2, ISO 27001, GRC hires)
            or <b>under pressure from enterprise customers</b> (SSO, enterprise plan, security reviews).
          </p>
        </section>

        <div className={ui.grid}>
          <section className={ui.card}>
            <h2 className={ui.cardTitle}>Gates: all three must pass</h2>
            <table className={ui.table}>
              <tbody>
                <tr><td><b>B2B SaaS</b><div className="caption">Sells software to businesses: pricing, demo, app login, SSO</div></td></tr>
                <tr><td><b>Right size</b><div className="caption">{t.employees_min ?? 20} to {t.employees_max ?? 500} employees; below {t.employees_drop_below ?? 10} or above {t.employees_drop_above ?? 1000} is a No-go</div></td></tr>
                <tr><td><b>Not already served</b><div className="caption">No Vanta, Drata, Secureframe, Sprinto or similar trust center; not a Sprinto customer</div></td></tr>
              </tbody>
            </table>
          </section>

          <section className={ui.card}>
            <h2 className={ui.cardTitle}>Score out of 100</h2>
            <table className={ui.table}>
              <tbody>
                {icp && Object.entries(icp.weights).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                  <tr key={k}><td>{LABELS[k] ?? k}</td><td className={ui.right}>{v}</td></tr>
                ))}
                <tr><td style={{ color: "var(--text1)", fontWeight: 600 }}>Go: all gates, one trigger, score at least</td><td className={ui.right} style={{ color: "var(--text1)", fontWeight: 600 }}>{t.go_score ?? 50}</td></tr>
              </tbody>
            </table>
            <p className="caption" style={{ marginBottom: 0 }}>Human review when one missing fact would decide it. No-go when even a perfect answer could not reach {t.go_score ?? 50}.</p>
          </section>
        </div>

        <div className={ui.grid}>
          <section className={ui.card}>
            <h2 className={ui.cardTitle}>Where we find them</h2>
            <p className="caption" style={{ marginTop: 0 }}>Funding news, read every day at 06:00 IST. Each headline becomes a company, then a quick check drops anyone already on a compliance tool before research.</p>
            <table className={ui.table}>
              <thead><tr><th>News feed</th><th>Region</th></tr></thead>
              <tbody>
                {FEEDS.map((f) => (
                  <tr key={f.id}><td><a className={ui.link} href={f.url} target="_blank" rel="noreferrer noopener">{f.name}</a></td><td>{f.region}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="caption" style={{ marginBottom: 0 }}>Backups when the pool is empty: web search through Gemini, or a list of domains you paste on <Link className={ui.link} href="/">This week</Link>.</p>
          </section>

          <section className={ui.card}>
            <h2 className={ui.cardTitle}>Who gets researched first</h2>
            <p className="caption" style={{ marginTop: 0 }}>Every company in the pool gets points; each run researches the top 30.</p>
            <table className={ui.table}>
              <tbody>
                {RANK_RULES.map(([rule, pts]) => (
                  <tr key={rule}><td>{rule}</td><td className={ui.right}>+{pts}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="caption" style={{ marginBottom: 0 }}>Dropped before research: not B2B SaaS, Series D and later, debt or grants, already on a compliance tool, researched in the last 90 days, already in HubSpot.</p>
          </section>
        </div>

        <section className={ui.card}>
          <h2 className={ui.cardTitle}>Never prospected</h2>
          <p className="caption" style={{ marginTop: 0 }}>Sprinto itself, competitors and existing Sprinto customers. Always skipped.</p>
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
    </>
  );
}
