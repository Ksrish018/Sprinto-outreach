import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import ui from "@/components/ui.module.css";

export default function Page() {
  return (
    <>
      <PageHeader title="Pipeline" />
      <div className={ui.page}>
        <EmptyState title="Nothing here yet">
          Every company from this week&apos;s run, by stage: found, researching, qualified, drafted, sent. Arrives in milestone M2.
        </EmptyState>
      </div>
    </>
  );
}
