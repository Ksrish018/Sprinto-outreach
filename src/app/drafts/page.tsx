import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { OutcomeTag } from "@/components/OutcomeTag";
import { PageHeader } from "@/components/PageHeader";
import { SyncButton } from "@/components/SyncButton";
import ui from "@/components/ui.module.css";
import { SPRINTO_FACTS } from "@/lib/draft/check";
import { getDrafts } from "@/lib/queries";
import styles from "./drafts.module.css";

const STATUS: Record<string, { label: string; dot: string }> = {
  drafted: { label: "In the app only", dot: ui.dotWarn },
  in_gmail: { label: "Waiting in Gmail", dot: ui.dotWarn },
  sent_edited: { label: "Sent, edited", dot: ui.dotOk },
  sent_as_is: { label: "Sent as written", dot: ui.dotOk },
  discarded: { label: "Discarded", dot: ui.dotMuted },
  blocked: { label: "Blocked by checks", dot: ui.dotError },
};

export default async function Drafts({ searchParams }: PageProps<"/drafts">) {
  const { id } = await searchParams;
  const drafts = await getDrafts();
  if (!drafts.length) {
    return (
      <>
        <PageHeader title="Drafts and Why" />
        <div className={ui.page}>
          <EmptyState title="No drafts yet" action={<Link href="/" className={`${ui.btn} ${ui.btnSecondary}`}>Start a run</Link>}>
            Every Go company gets a draft addressed to the right person, built on one sourced fact, with the reasons beside it.
          </EmptyState>
        </div>
      </>
    );
  }
  const sel = drafts.find((d) => String(d.id) === id) ?? drafts[0];
  const s = STATUS[sel.status] ?? { label: sel.status, dot: ui.dotMuted };

  return (
    <>
      <PageHeader title="Drafts and Why" meta={`${drafts.length} drafts · edit and send in Gmail; every edit teaches the next draft`}>
        <SyncButton />
      </PageHeader>
      <div className={styles.workspace}>
        <nav className={styles.list} aria-label="Drafts">
          {drafts.map((d) => {
            const st = STATUS[d.status] ?? { label: d.status, dot: ui.dotMuted };
            return (
              <Link key={d.id} href={`/drafts?id=${d.id}`} className={d.id === sel.id ? `${styles.row} ${styles.selected}` : styles.row} aria-current={d.id === sel.id ? "true" : undefined}>
                <span className={styles.name}>{d.company ?? d.domain}</span>
                <span className={styles.who}>{d.contact_name ?? "No person"}{d.contact_title ? ` · ${d.contact_title}` : ""}</span>
                <span className={styles.status}><span className={`${ui.dot} ${st.dot}`} />{st.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.detail}>
          <article className={ui.card}>
            <h2 className={ui.sectionTitle}>{sel.company ?? sel.domain}</h2>
            <div className="caption"><span className="mono">{sel.domain}</span>{sel.stage ? ` · ${sel.stage}` : ""}</div>
            <div className={ui.row} style={{ margin: "12px 0 18px", gap: 6 }}>
              <OutcomeTag outcome={sel.outcome} />
              {sel.segment && <span className={`${ui.tag} ${ui.tagMuted}`}>{sel.segment.replace(":", " × ").replace("_", " ")}</span>}
              <span className={styles.status}><span className={`${ui.dot} ${s.dot}`} />{s.label}</span>
            </div>
            {sel.status === "blocked" && (
              <p className={ui.errorText} role="alert">Blocked after {sel.claim_map.attempts} attempts: {sel.claim_map.problems.join("; ")}. This draft will not go to Gmail.</p>
            )}
            <div className={styles.email}>
              <div className={styles.head}>
                <span><b>To</b> you (pilot)</span>
                <span><b>Subject</b> {sel.subject}</span>
              </div>
              <div className={styles.pilot}>Pilot: would go to {sel.contact_name} &lt;{sel.contact_email}&gt;, {sel.contact_title}, {sel.company ?? sel.domain}</div>
              <div className={`${styles.part} ${styles.hook}`}><span className="label">Hook</span>{sel.hook}</div>
              <div className={styles.part}><span className="label">Body</span>{sel.body}</div>
              <div className={styles.part}><span className="label">CTA</span>{sel.cta}</div>
            </div>
          </article>

          <aside className={`${ui.card} ${ui.framed}`} aria-label="Why this email">
            <span className={ui.cornerB} />
            <h2 className={ui.cardTitle}>Why</h2>
            <section className={styles.sec}>
              <span className="label">Why this company</span>
              <p className={styles.p}>Score {sel.score} of 100 · <Link className={ui.link} href={`/companies/${sel.company_id}`}>full dossier</Link></p>
              <ul className={styles.ul}>{(sel.reasons ?? []).slice(0, 4).map((r, i) => <li key={i}>{r.text}</li>)}</ul>
            </section>
            <section className={styles.sec}>
              <span className="label">Why this person</span>
              <p className={styles.p}>{sel.pick_reason}. Hunter confidence {sel.hunter_confidence}, email verified.</p>
            </section>
            <section className={styles.sec}>
              <span className="label">Why this email</span>
              <p className={styles.p}>Hook: {sel.hook_value}</p>
              {sel.hook_quote && <div className={ui.quote}>&ldquo;{sel.hook_quote}&rdquo;</div>}
              {sel.hook_url && <a className="mono" href={sel.hook_url} target="_blank" rel="noreferrer noopener" style={{ fontSize: 11.5, color: "var(--text3)", wordBreak: "break-all" }}>{sel.hook_url}</a>}
              <p className={styles.p} style={{ marginTop: 10 }}>Two pains for this role:</p>
              <ul className={styles.ul}>{sel.pains.map((p) => <li key={p.id}>{p.text}</li>)}</ul>
            </section>
            <section className={styles.sec}>
              <span className="label">Every claim and its source</span>
              <ul className={styles.ul}>
                {sel.claim_map.claims.map((c, i) => (
                  <li key={i}>{c.sentence} <span className="caption">({c.source.startsWith("S") ? `Sprinto: ${SPRINTO_FACTS[c.source] ? "sprinto.com" : "unknown"}` : `fact ${c.source}`})</span></li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
