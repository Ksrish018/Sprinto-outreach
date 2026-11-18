import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PipelineFlow } from "@/components/PipelineFlow";
import ui from "@/components/ui.module.css";

export const metadata = { title: "How it works · Sprinto Outreach" };

const EMPTY = [
  ["Few companies found", "The web searches returned a small sample this time.", "Not a market signal. Run your own domain list, or wait for next week's run."],
  ["Mostly skipped", "Already researched in the last 90 days, or a Sprinto customer or competitor.", "Working as intended: nobody is contacted twice in a quarter."],
  ["Mostly No-go", "Failed a gate (not SaaS, wrong size, already uses a compliance tool) or scored under 50.", "The ICP is strict for this batch. The reasons on each company show which rule cut most."],
  ["Mostly Human review", "Research could not prove one fact that would decide it.", "Targets probably exist. Open the company and click Approve as Go if you agree."],
  ["Mostly failed", "The site blocked reading or timed out.", "A technical issue, not a market signal."],
];

const NEVER = [
  "Send an email by itself. It only creates Gmail drafts addressed to you.",
  "Use a fact it cannot point to. Every claim links to a quote or a public Sprinto fact.",
  "Let the model decide Go or No-go. Gates and the score are plain code you can read.",
  "Contact a Sprinto customer or competitor. They are on the suppression list.",
  "Spend Hunter credits on companies that are not Go.",
];

export default function HowItWorks() {
  return (
    <>
      <PageHeader title="How it works" meta="Every step the app takes, what it decides, and where you can check it" />
      <div className={ui.page}>
        <PipelineFlow />

        <div className={ui.grid}>
          <section className={ui.card}>
            <h2 className={ui.cardTitle}>When a run comes back empty</h2>
            <p className="caption" style={{ marginTop: 0 }}>
              An empty run does not mean there are no targets this week. It means none of the companies this run looked at passed every step. The counts on the Pipeline page show which step stopped them.
            </p>
            <table className={ui.table}>
              <thead><tr><th>You see</th><th>Why</th><th>What it means</th></tr></thead>
              <tbody>
                {EMPTY.map(([a, b, c]) => <tr key={a}><td><b>{a}</b></td><td>{b}</td><td>{c}</td></tr>)}
              </tbody>
            </table>
          </section>

          <section className={ui.card}>
            <h2 className={ui.cardTitle}>What the app never does</h2>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8, fontSize: 14.5, color: "var(--text2)" }}>
              {NEVER.map((n) => <li key={n}>{n}</li>)}
            </ul>
            <p className="caption" style={{ marginBottom: 0 }}>
              Check any of this yourself: <Link className={ui.link} href="/pipeline">Pipeline</Link> shows every company and why research stopped,{" "}
              <Link className={ui.link} href="/drafts">Drafts and Why</Link> shows every claim and its source, and{" "}
              <Link className={ui.link} href="/health">Health</Link> shows API spend and whether the learning loop is closing.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
