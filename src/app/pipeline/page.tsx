import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { OutcomeTag } from "@/components/OutcomeTag";
import { PageHeader } from "@/components/PageHeader";
import { Runner } from "@/components/Runner";
import ui from "@/components/ui.module.css";
import { getPipeline, getRun } from "@/lib/queries";

const STATUS: Record<string, string> = {
  queued: "Waiting",
  researching: "Researching",
  qualified: "Decided",
  failed: "Failed",
  skipped: "Skipped",
};

export default async function Pipeline({ searchParams }: PageProps<"/pipeline">) {
  const { run: runParam } = await searchParams;
  const run = await getRun(runParam ? Number(runParam) : undefined);
  if (!run) {
    return (
      <>
        <PageHeader title="Pipeline" />
        <div className={ui.page}>
          <EmptyState title="No runs yet" action={<Link href="/" className={`${ui.btn} ${ui.btnSecondary}`}>Start a run</Link>}>
            Every company in a run appears here by stage, with its decision and the reason research stopped.
          </EmptyState>
        </div>
      </>
    );
  }
  const rows = await getPipeline(run.id);
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    const k = r.outcome ?? r.status;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title={<>Run {run.id}</>}
        meta={<>{run.trigger === "domains" ? "Domain list" : run.trigger === "cron" ? "Weekly run" : "Run now"} · {run.status} · {rows.length} companies</>}
      >
        <div className={ui.stats}>
          {[["go", "Go"], ["go_flag", "Go + flag"], ["human", "Human"], ["no_go", "No-go"]].map(([k, label]) => (
            <div key={k} className={ui.stat}>
              <b>{counts[k] ?? 0}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </PageHeader>
      <div className={ui.page}>
        <Runner runId={run.id} running={run.status === "running"} />
        {typeof run.counts.error === "string" && <p className={ui.errorText}>Run failed: {run.counts.error}</p>}
        <section className={ui.card} style={{ padding: 0, overflow: "hidden" }}>
          <table className={ui.table}>
            <thead>
              <tr><th>Company</th><th>Stage</th><th>Decision</th><th className={ui.right}>Score</th><th>Why research stopped</th><th className={ui.right}>Fetches</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.company_id}>
                  <td>
                    <Link className={ui.link} href={`/companies/${r.company_id}`}>{r.name ?? r.domain}</Link>
                    <div className="mono" style={{ color: "var(--text3)" }}>{r.domain}</div>
                  </td>
                  <td>{STATUS[r.status] ?? r.status}</td>
                  <td><OutcomeTag outcome={r.outcome} /></td>
                  <td className={ui.right}>{r.score ?? ""}</td>
                  <td style={{ maxWidth: 360 }}>{r.error ? <span className={ui.errorText}>{r.error}</span> : r.stop_reason}</td>
                  <td className={ui.right}>{r.fetches || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
