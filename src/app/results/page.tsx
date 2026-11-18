import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { OutcomeTag } from "@/components/OutcomeTag";
import { PageHeader } from "@/components/PageHeader";
import ui from "@/components/ui.module.css";
import { getSentLog } from "@/lib/queries";

export const metadata = { title: "Results · Sprinto Outreach" };

const OUTCOME = {
  accepted: { label: "Sent as written", dot: ui.dotOk },
  edited: { label: "Sent, edited", dot: ui.dotOk },
  discarded: { label: "Discarded", dot: ui.dotMuted },
} as const;

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "–";

export default async function Results() {
  const rows = await getSentLog();
  const sent = rows.filter((r) => r.outcome !== "discarded");
  const stats = [
    { n: sent.length, label: "Sent" },
    { n: rows.filter((r) => r.outcome === "accepted").length, label: "As written" },
    { n: rows.filter((r) => r.outcome === "edited").length, label: "Edited" },
    { n: rows.filter((r) => r.outcome === "discarded").length, label: "Discarded" },
  ];

  return (
    <>
      <PageHeader title="Results" meta="Every email that left Gmail, with the company, person, score and hook it was built on.">
        <div className={ui.stats}>
          {stats.map((s) => (
            <div key={s.label} className={ui.stat}>
              <b>{s.n}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </PageHeader>
      <div className={ui.page}>
        {!rows.length ? (
          <EmptyState title="No emails sent yet" action={<Link href="/drafts" className={`${ui.btn} ${ui.btnSecondary}`}>Open drafts</Link>}>
            Send a draft from your Gmail, then press Sync with Gmail on Drafts and Why. It appears here with what it was built on.
          </EmptyState>
        ) : (
          <section className={ui.card}>
            <h2 className={ui.cardTitle}>Sent log</h2>
            <div className={ui.scrollX}>
            <table className={ui.table} style={{ minWidth: 640 }}>
              <thead>
                <tr><th>Company</th><th>Person</th><th>Decision</th><th>Hook</th><th>Outcome</th><th className={ui.right}>Sent (IST)</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const o = OUTCOME[r.outcome];
                  return (
                    <tr key={r.draft_id}>
                      <td><Link className={ui.link} href={`/companies/${r.company_id}`}>{r.company}</Link></td>
                      <td>{r.contact ?? "–"}{r.title && <div className="caption">{r.title}</div>}</td>
                      <td>{r.decision ? <OutcomeTag outcome={r.decision} /> : "–"}{r.score != null && <div className="caption">score {r.score}</div>}</td>
                      <td>{r.hook}<div className="caption"><Link className={ui.link} href={`/drafts?id=${r.draft_id}`}>why this email</Link></div></td>
                      <td><span className={`${ui.dot} ${o.dot}`} /> {o.label}</td>
                      <td className={ui.right}>{when(r.sent_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </section>
        )}
        <p className={ui.notice}>
          Replies, meetings and deals are not tracked here yet. In the pilot every email goes to your own inbox, so there are no real replies to
          count. In real use they come from HubSpot, matched to each email in this log.
        </p>
      </div>
    </>
  );
}
