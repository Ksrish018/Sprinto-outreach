import Link from "next/link";
import { notFound } from "next/navigation";
import { ApproveButton } from "@/components/ApproveButton";
import { EmptyState } from "@/components/EmptyState";
import { OutcomeTag, RungTag } from "@/components/OutcomeTag";
import { PageHeader } from "@/components/PageHeader";
import ui from "@/components/ui.module.css";
import { getDossier } from "@/lib/queries";
import { QUESTIONS, type QuestionId } from "@/lib/research/evidence";

const GATE: Record<string, string> = { saas: "B2B SaaS", not_served: "Not already served", size: "Right size" };

export default async function Company({ params }: PageProps<"/companies/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const d = await getDossier(id);
  if (!d) notFound();
  const factById = new Map(d.facts.map((f) => [f.id, f]));
  const byQuestion = Object.keys(QUESTIONS).map((q) => ({ q: q as QuestionId, facts: d.facts.filter((f) => f.question_id === q) }));

  return (
    <>
      <PageHeader title={d.company.name ?? d.company.domain} meta={<span className="mono" style={{ color: "inherit" }}>{d.company.domain}</span>} />
      <div className={ui.page}>
        {d.company.why_picked && <p className={ui.notice}>Why it was picked: {d.company.why_picked}</p>}
        {!d.decision ? (
          <EmptyState title="Not researched yet">This company is queued. Its dossier appears once research finishes.</EmptyState>
        ) : (
          <div className={ui.split}>
            <div style={{ display: "grid", gap: 24 }}>
              <section className={ui.card}>
                <h2 className={ui.cardTitle}>Evidence</h2>
                <p className="caption" style={{ marginTop: 0 }}>Every fact with the exact quote and where it came from. Search facts cannot be checked word for word and are marked.</p>
                {byQuestion.map(({ q, facts }) => (
                  <div key={q} style={{ padding: "12px 0", borderTop: "1px solid var(--border)" }}>
                    <div className={ui.row} style={{ justifyContent: "space-between" }}>
                      <b style={{ fontSize: 14 }}>{q}. {QUESTIONS[q].title}</b>
                      {!facts.length && <span className="caption">Not found</span>}
                    </div>
                    {facts.map((f) => (
                      <div key={f.id} style={{ marginTop: 10 }}>
                        <div className={ui.row} style={{ justifyContent: "space-between" }}>
                          <span style={{ fontSize: 14 }}>{f.field.replace(/_/g, " ")}: <b>{f.value}</b></span>
                          <span className={ui.row} style={{ gap: 6 }}>
                            <RungTag rung={f.source_rung} />
                            {!f.verified && <span className={`${ui.tag} ${ui.tagMuted}`}>Unverified</span>}
                          </span>
                        </div>
                        {f.quote && <div className={ui.quote}>&ldquo;{f.quote}&rdquo;</div>}
                        <a className="mono" href={f.source_url} target="_blank" rel="noreferrer noopener" style={{ fontSize: 11.5, color: "var(--text3)", wordBreak: "break-all" }}>
                          {f.source_url}
                        </a>
                      </div>
                    ))}
                  </div>
                ))}
              </section>

              <section className={ui.card}>
                <h2 className={ui.cardTitle}>Research timeline</h2>
                <p className="caption" style={{ marginTop: 0 }}>Stopped: {d.stop?.stop_reason} · {d.stop?.fetches} fetches</p>
                <table className={ui.table}>
                  <thead><tr><th>Source</th><th>Why</th><th>Result</th></tr></thead>
                  <tbody>
                    {d.timeline.map((s, i) => (
                      <tr key={i}>
                        <td><RungTag rung={s.rung} /> <span className="mono" style={{ wordBreak: "break-all" }}>{s.source}</span>{s.via === "jina" && <span className="caption"> (via Jina)</span>}</td>
                        <td>{s.why}</td>
                        <td>{s.failure ? <span className={ui.errorText}>{s.result}</span> : s.result}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>

            <aside className={`${ui.card} ${ui.framed}`}>
              <span className={ui.cornerB} />
              <h2 className={ui.cardTitle}>Decision</h2>
              <div className={ui.row} style={{ margin: "8px 0 16px" }}>
                <OutcomeTag outcome={d.decision.outcome} />
                <span className="num" style={{ fontSize: 24, fontWeight: 500 }}>{d.decision.score}</span>
                <span className="caption">of 100</span>
              </div>
              {d.decision.outcome === "human" && <ApproveButton companyId={id} />}
              <span className="label" style={{ color: "var(--text3)" }}>Gates</span>
              <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 16px", display: "grid", gap: 6 }}>
                {Object.entries(d.decision.gates).map(([k, v]) => (
                  <li key={k} className={ui.row} style={{ gap: 8, fontSize: 14 }}>
                    <span className={`${ui.dot} ${v === "pass" ? ui.dotOk : v === "fail" ? ui.dotError : ui.dotMuted}`} />
                    {GATE[k] ?? k}: {v}
                  </li>
                ))}
              </ul>
              <span className="label" style={{ color: "var(--text3)" }}>Why</span>
              <ul style={{ padding: "0 0 0 18px", margin: "6px 0 16px", display: "grid", gap: 8, fontSize: 14 }}>
                {d.decision.reasons.map((r, i) => {
                  const f = r.factId ? factById.get(r.factId) : undefined;
                  return (
                    <li key={i}>
                      {r.text}
                      {f && <div className={ui.quote}>&ldquo;{f.quote}&rdquo;</div>}
                    </li>
                  );
                })}
              </ul>
              {d.decision.flags.length > 0 && (
                <>
                  <span className="label" style={{ color: "var(--text3)" }}>Flags</span>
                  <ul style={{ padding: "0 0 0 18px", margin: "6px 0 0", fontSize: 14, color: "var(--text2)" }}>
                    {d.decision.flags.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </>
              )}
              {d.runId && <p className="caption" style={{ marginBottom: 0 }}><Link className={ui.link} href={`/pipeline?run=${d.runId}`}>Back to run {d.runId}</Link></p>}
            </aside>
          </div>
        )}
      </div>
    </>
  );
}
