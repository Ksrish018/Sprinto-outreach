import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import ui from "@/components/ui.module.css";

export default function Page() {
  return (
    <>
      <PageHeader title="Drafts and Why" />
      <div className={ui.page}>
        <EmptyState title="Nothing here yet">
          Each Gmail draft with its Why panel: why this company, why this person, why this email, and the past corrections it used. Arrives in milestones M3 and M5.
        </EmptyState>
      </div>
    </>
  );
}
