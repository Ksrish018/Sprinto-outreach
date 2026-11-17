import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { DomainRunForm, RunNowButton } from "@/components/RunControls";
import ui from "@/components/ui.module.css";
import { getCurrentIcp, getRun, getWeekSummary } from "@/lib/queries";
import { formatIst, nextWeeklyRun } from "@/lib/schedule";

export default async function ThisWeek() {
  const [week, icp, run] = await Promise.all([getWeekSummary(), getCurrentIcp(), getRun()]);
  const running = run?.status === "running";
  const stats = [
    { n: week.found, label: "Found" },
    { n: week.go, label: "Go" },
    { n: week.drafted, label: "In Gmail" },
    { n: week.sent, label: "Sent" },
  ];

  return (
    <>
      <PageHeader
        title={run ? <>Run {run.id} is <em>{run.status === "done" ? "ready" : run.status}</em></> : <>This week</>}
        meta={<>ICP v{icp?.id ?? 1} · next weekly run {formatIst(nextWeeklyRun())}</>}
      >
        <div className={ui.stats}>
          {stats.map((s) => (
            <div key={s.label} className={ui.stat}>
              <b>{s.n}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
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
            Run now searches for up to 20 companies that fit Sprinto&apos;s ICP and researches each one. Or paste a list of domains
            below. Gmail drafts for Go companies arrive in milestone M3.
          </EmptyState>
        )}
        <DomainRunForm disabled={running} />
      </div>
    </>
  );
}
