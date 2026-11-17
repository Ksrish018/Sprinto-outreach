import type { ReactNode } from "react";
import ui from "./ui.module.css";

// The plum run header: one of the only two full plum surfaces allowed (SKILL.md principle 2).
export function PageHeader({ title, meta, children }: { title: ReactNode; meta?: ReactNode; children?: ReactNode }) {
  return (
    <header className={ui.header}>
      <div>
        <h1 className={ui.title}>{title}</h1>
        {meta && <div className={ui.headerMeta}>{meta}</div>}
      </div>
      {children}
    </header>
  );
}
