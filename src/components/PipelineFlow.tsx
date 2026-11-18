"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowsClockwise,
  Buildings,
  EnvelopeSimple,
  ListChecks,
  MagnifyingGlass,
  Pause,
  PencilSimpleLine,
  Play,
  UserFocus,
} from "@phosphor-icons/react";
import { STEPS, type StepCounts, type StepId } from "@/lib/pipeline-steps";
import { StepVisual } from "./StepVisual";
import s from "./PipelineFlow.module.css";

const ICON: Record<StepId, typeof Buildings> = {
  find: MagnifyingGlass,
  research: Buildings,
  qualify: ListChecks,
  person: UserFocus,
  draft: PencilSimpleLine,
  review: EnvelopeSimple,
  learn: ArrowsClockwise,
};

// Tokens are companies moving through the pipeline: some drop out, as in a real run.
const TOKENS = [
  { kind: "pass", delay: 0 },
  { kind: "dropFind", delay: 1.4 },
  { kind: "dropQualify", delay: 2.8 },
  { kind: "pass", delay: 4.2 },
  { kind: "dropQualify", delay: 5.6 },
  { kind: "dropResearch", delay: 7 },
] as const;

const DROP_LABEL: Record<string, string> = { dropFind: "Skipped", dropResearch: "Failed", dropQualify: "No-go" };

export function PipelineFlow({ counts, compact = false }: { counts?: StepCounts; compact?: boolean }) {
  const [active, setActive] = useState<StepId>("find");
  const [playing, setPlaying] = useState(!compact);

  useEffect(() => {
    if (!playing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setActive((cur) => STEPS[(STEPS.findIndex((x) => x.id === cur) + 1) % STEPS.length].id);
    }, 6000);
    return () => clearInterval(t);
  }, [playing]);

  const step = STEPS.find((x) => x.id === active)!;
  const live = counts?.[active];

  return (
    <section className={`${s.wrap} ${compact ? s.compact : ""}`} aria-label="How the pipeline works">
      <div className={s.top}>
        <div>
          <span className="label" style={{ color: "var(--text3)" }}>{compact ? "This run, step by step" : "The pipeline"}</span>
          <p className={s.lede}>{compact ? "Click a step to see what happened to these companies there." : "Seven steps from a web search to an email you approve. Click any step."}</p>
        </div>
        <button type="button" className={s.play} onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
          {playing ? <Pause size={14} weight="fill" aria-hidden /> : <Play size={14} weight="fill" aria-hidden />}
          {playing ? "Pause tour" : "Play tour"}
        </button>
      </div>

      <div className={s.rail}>
        <div className={s.track} aria-hidden>
          <span className={s.trackFill} />
          {TOKENS.map((t, i) => (
            <span key={i} className={`${s.token} ${s[t.kind]}`} style={{ animationDelay: `${t.delay}s` }}>
              <span className={s.dot} style={{ animationDelay: `${t.delay}s` }} />
              {t.kind !== "pass" && <span className={s.dropLabel} style={{ animationDelay: `${t.delay}s` }}>{DROP_LABEL[t.kind]}</span>}
            </span>
          ))}
        </div>
        <ol className={s.nodes}>
          {STEPS.map((x) => {
            const Icon = ICON[x.id];
            const c = counts?.[x.id];
            const on = x.id === active;
            return (
              <li key={x.id}>
                <button
                  type="button"
                  className={`${s.node} ${on ? s.nodeOn : ""}`}
                  aria-current={on ? "step" : undefined}
                  onClick={() => {
                    setActive(x.id);
                    setPlaying(false);
                  }}
                >
                  <span className={s.bubble}>
                    <Icon size={20} weight={on ? "fill" : "regular"} aria-hidden />
                    {x.id === "learn" && <span className={s.loopBack} aria-hidden />}
                  </span>
                  <span className={s.nodeN}>{x.n}</span>
                  <span className={s.nodeTitle}>{x.title}</span>
                  {c && <span className={s.nodeCount}><b>{c.value}</b> {c.label}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className={s.detail} key={active}>
        <div className={s.visual}>
          <StepVisual id={active} />
        </div>
        <div className={s.text}>
          <h3 className={s.h}>
            <span className={s.hN}>Step {step.n}</span> {step.title}
          </h3>
          <p className={s.short}>{step.short}</p>
          {live && (
            <p className={s.live}>
              <b>{live.value}</b> {live.label}{live.sub ? ` · ${live.sub}` : ""}
            </p>
          )}
          {!compact && (
            <ul className={s.what}>
              {step.what.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          <div className={s.rules}>
            {step.rules.map((r) => <span key={r} className={s.rule}>{r}</span>)}
          </div>
          <p className={s.empty}><b>If this step comes back empty:</b> {step.empty}</p>
          <Link className={s.check} href={step.check.href}>Check it yourself: {step.check.label} →</Link>
        </div>
      </div>
    </section>
  );
}
