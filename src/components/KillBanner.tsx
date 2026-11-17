import { getKillState } from "@/lib/queries";
import ui from "./ui.module.css";

// Shown at the top of every page while the kill switch is on (FR-11.4).
export async function KillBanner() {
  // If the database cannot be reached the page still renders; drafting is blocked server-side anyway.
  const kill = await getKillState().catch(() => null);
  if (!kill) {
    return (
      <div className={ui.notice} role="alert" style={{ margin: "16px 32px 0" }}>
        Could not reach the database to read the kill switch. Nothing is drafted until it is reachable again.
      </div>
    );
  }
  if (!kill.is_on) return null;
  return (
    <div className={ui.killBanner} role="alert">
      <span className={`${ui.dot} ${ui.dotError}`} />
      <div>
        <b>Kill switch is on{kill.fired_line ? `: ${kill.fired_line}` : ""}</b>
        <p>No Gmail drafts are being created. Write by hand as before until it is resumed.</p>
      </div>
    </div>
  );
}
