import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import ui from "@/components/ui.module.css";

export default function Page() {
  return (
    <>
      <PageHeader title="Results" />
      <div className={ui.page}>
        <EmptyState title="Nothing here yet">
          Replies, meetings, deal stages and revenue from HubSpot for every sent email. Arrives in milestone M5.
        </EmptyState>
      </div>
    </>
  );
}
