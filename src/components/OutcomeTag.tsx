import ui from "./ui.module.css";

const MAP: Record<string, { label: string; dot?: string; extra?: string }> = {
  go: { label: "Go", dot: ui.dotOk },
  go_flag: { label: "Go + flag", dot: ui.dotWarn },
  human: { label: "Human review", extra: ui.tagHuman },
  no_go: { label: "No-go", extra: ui.tagMuted },
};

export function OutcomeTag({ outcome }: { outcome: string | null }) {
  if (!outcome) return null;
  const m = MAP[outcome] ?? { label: outcome, extra: ui.tagMuted };
  return (
    <span className={`${ui.tag} ${m.extra ?? ""}`}>
      {m.dot && <span className={`${ui.dot} ${m.dot}`} />}
      {m.label}
    </span>
  );
}

export function RungTag({ rung }: { rung: string }) {
  return <span className={`${ui.tag} ${ui.tagMuted} ${ui.tagMono}`}>{rung}</span>;
}
