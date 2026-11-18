import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { OutcomeTag } from "@/components/OutcomeTag";
import { PipelineFlow } from "@/components/PipelineFlow";
import { PageHeader } from "@/components/PageHeader";
import { Runner } from "@/components/Runner";
import ui from "@/components/ui.module.css";
import { getPipeline, getRun, getRunFunnel } from "@/lib/queries";
import type { StepCounts } from "@/lib/pipeline-steps";

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
  const [rows, funnel] = await Promise.all([getPipeline(run.id), getRunFunnel(run.id)]);
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    const k = r.outcome ?? r.status;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const n = (k: string) => counts[k] ?? 0;
  const researched = n("go") + n("go_flag") + n("human") + n("no_go");
  const go = n("go") + n("go_flag");
  const stepCounts: StepCounts = {
    find: { value: rows.length, label: "found", sub: `${n("skipped")} skipped (customer, competitor or seen in 90 days)` },
    research: { value: researched, label: "researched", sub: `${n("failed")} failed to read, ${n("queued") + n("researching")} still waiting` },
    qualify: { value: go, label: "Go", sub: `${n("human")} Human review, ${n("no_go")} No-go` },
    person: { value: funnel.drafts, label: "with a person", sub: go > funnel.drafts ? `${go - funnel.drafts} Go without a verified person or hook` : undefined },
    draft: { value: funnel.drafts - funnel.blocked, label: funnel.drafts - funnel.blocked === 1 ? "draft" : "drafts", sub: funnel.blocked ? `${funnel.blocked} blocked by the claim checker` : undefined },
    review: { value: funnel.inGmail, label: "in Gmail" },
    learn: { value: funnel.sent, label: "sent", sub: `${funnel.edited} with your edits` },
  };
  const done = run.status === "done";
  const verdict = !done ? null
    : go > 0 ? null
    : rows.length === 0 ? "The searches found no new companies this time. That is not a market signal: run a domain list, or wait for next week."
    : n("skipped") >= rows.length / 2 ? "Most companies were skipped because they were researched in the last 90 days or are Sprinto customers. Fresh companies will come from next week's searches."
    : n("human") >= n("no_go") && n("human") > 0 ? "No company was proven Go, but some are in Human review: research could not prove one deciding fact. Open them and approve the ones you agree with."
    : n("failed") >= researched && n("failed") > 0 ? "Most sites could not be read (blocked or timed out). That is a technical issue, not a sign there are no targets."
    : "Every company researched failed a gate or scored under 50. The ICP is strict for this batch; the reasons on each company show which rule cut most.";

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
        {verdict && (
          <p className={ui.notice} role="status">
            <b>No Go companies in this run.</b> {verdict} <Link className={ui.link} href="/how-it-works">How each step decides</Link>
          </p>
        )}
        <PipelineFlow counts={stepCounts} compact />
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
