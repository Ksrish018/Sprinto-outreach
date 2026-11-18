import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { DomainRunForm, RunNowButton } from "@/components/RunControls";
import ui from "@/components/ui.module.css";
import { getCurrentIcp, getIcpConfirmation, getKillState, getNeedsYou, getPipeline, getRun, getRunFunnel } from "@/lib/queries";
import { formatIst, nextWeeklyRun } from "@/lib/schedule";

export default async function ThisWeek() {
  const [icp, run, confirmed, kill, needs] = await Promise.all([getCurrentIcp(), getRun(), getIcpConfirmation(), getKillState(), getNeedsYou()]);
  const [rows, funnel] = run ? await Promise.all([getPipeline(run.id), getRunFunnel(run.id)]) : [[], null];
  const running = run?.status === "running";

  // The same numbers as this run on the Pipeline page, so the two pages always agree.
  const go = rows.filter((r) => r.outcome === "go" || r.outcome === "go_flag").length;
  const stats = [
    { n: rows.length, label: "Found" },
    { n: go, label: "Go" },
    { n: funnel?.inGmail ?? 0, label: "In Gmail" },
    { n: funnel?.sent ?? 0, label: "Sent" },
  ];
  const icpConfirmed = Boolean(icp && confirmed && confirmed.version === icp.id);
  const nothing = icpConfirmed && !kill.is_on && !needs.waiting.length && !needs.review.length && !needs.appOnly;

  return (
    <>
      <PageHeader
        title={run ? <>Run {run.id} is <em>{run.status === "done" ? "ready" : run.status}</em></> : <>This week</>}
        meta={<>ICP v{icp?.id ?? 1} · next weekly run {formatIst(nextWeeklyRun())}{run && <> · numbers below are for run {run.id}</>}</>}
      >
        {run && (
          <div className={ui.stats}>
            {stats.map((s) => (
              <div key={s.label} className={ui.stat}>
                <b>{s.n}</b>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        )}
        <RunNowButton disabled={running} />
      </PageHeader>

      <div className={ui.page}>
        {running && (
          <p className={ui.notice}>
            Run {run.id} is in progress. <Link className={ui.link} href={`/pipeline?run=${run.id}`}>Follow it on the Pipeline page</Link>.
          </p>
        )}
        {!run && (
          <EmptyState title="No runs yet">
            Run now researches the top 30 companies from the news-feed pool (or a web search when the pool is empty). Or paste a list of
            domains below. Every Go company gets an email draft in your own Gmail.
          </EmptyState>
        )}

        <section className={ui.card} aria-labelledby="needs-you">
          <h2 id="needs-you" className={ui.cardTitle}>Needs you</h2>
          {nothing ? (
            <p className="caption" style={{ margin: 0 }}>Nothing is waiting on you. New companies arrive with the daily news read and the next run.</p>
          ) : (
            <table className={ui.table}>
              <tbody>
                {kill.is_on && (
                  <tr>
                    <td><span className={`${ui.dot} ${ui.dotError}`} /> <b>Kill switch is on</b><div className="caption">{kill.fired_line ?? "Drafting is stopped until someone looks."}</div></td>
                    <td className={ui.right}><Link className={ui.link} href="/health">Open Health</Link></td>
                  </tr>
                )}
                {icp && !icpConfirmed && (
                  <tr>
                    <td><span className={`${ui.dot} ${ui.dotWarn}`} /> <b>Confirm ICP v{icp.id}</b><div className="caption">Check who we target before the weekly run uses it.</div></td>
                    <td className={ui.right}><Link className={ui.link} href="/icp">Open ICP</Link></td>
                  </tr>
                )}
                {needs.waiting.map((w) => (
                  <tr key={`w${w.id}`}>
                    <td><span className={`${ui.dot} ${ui.dotWarn}`} /> <b>Review the {w.company} email in Gmail</b><div className="caption">{w.contact ? `To ${w.contact}${w.title ? `, ${w.title}` : ""}. ` : ""}Edit it, then send or delete it.</div></td>
                    <td className={ui.right}><Link className={ui.link} href={`/drafts?id=${w.id}`}>See why</Link></td>
                  </tr>
                ))}
                {needs.appOnly > 0 && (
                  <tr>
                    <td><span className={`${ui.dot} ${ui.dotWarn}`} /> <b>{needs.appOnly} draft{needs.appOnly === 1 ? "" : "s"} did not reach Gmail</b><div className="caption">Daily cap, kill switch or a Gmail connection problem. The reason is on the company.</div></td>
                    <td className={ui.right}><Link className={ui.link} href="/drafts">Open drafts</Link></td>
                  </tr>
                )}
                {needs.review.map((r) => (
                  <tr key={`r${r.company_id}`}>
                    <td><span className={`${ui.dot} ${ui.dotWarn}`} /> <b>Decide on {r.company}</b>{r.score != null && <> · score {r.score}</>}<div className="caption">{(r.why ?? "Human review: one missing fact decides it").replace(/[.\s]*$/, ".")} Approve it as Go, or leave it.</div></td>
                    <td className={ui.right}><Link className={ui.link} href={`/companies/${r.company_id}`}>Open dossier</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <DomainRunForm disabled={running} />
      </div>
    </>
  );
}
