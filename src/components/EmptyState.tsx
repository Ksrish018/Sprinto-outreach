import type { ReactNode } from "react";
import ui from "./ui.module.css";

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className={`${ui.card} ${ui.empty}`}>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </section>
  );
}
