import { Play } from "@phosphor-icons/react/dist/ssr";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import ui from "@/components/ui.module.css";
import { getCurrentIcp, getWeekSummary } from "@/lib/queries";
import { formatIst, nextWeeklyRun } from "@/lib/schedule";

export default async function ThisWeek() {
  const [week, icp] = await Promise.all([getWeekSummary(), getCurrentIcp()]);
  const stats = [
    { n: week.found, label: "Found" },
    { n: week.go, label: "Go" },
    { n: week.drafted, label: "In Gmail" },
    { n: week.sent, label: "Sent" },
  ];

  return (
    <>
      <PageHeader
        title={week.lastRun ? <>Run {week.lastRun.id} is <em>{week.lastRun.status === "done" ? "ready" : week.lastRun.status}</em></> : <>This week</>}
        meta={<>ICP v{icp?.id ?? 1} · next run {formatIst(nextWeeklyRun())}</>}
      >
        <div className={ui.stats}>
          {stats.map((s) => (
            <div key={s.label} className={ui.stat}>
              <b>{s.n}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
        <span className={`${ui.btn} ${ui.btnOnPlum}`} aria-disabled="true" title="Runs arrive in milestone M2">
          <Play size={16} aria-hidden /> Run now
        </span>
      </PageHeader>

      <div className={ui.page}>
        {week.lastRun ? null : (
          <EmptyState
            title="No runs yet"
            action={
              <span className={`${ui.btn} ${ui.btnSecondary}`} aria-disabled="true" title="Arrives in milestone M2">
                Run on a list of domains
              </span>
            }
          >
            The first weekly run will find up to 20 companies that fit Sprinto&apos;s ICP, research them, and leave Gmail drafts
            for the Go companies. Research and drafting arrive in milestones M2 and M3.
          </EmptyState>
        )}
      </div>
    </>
  );
}
