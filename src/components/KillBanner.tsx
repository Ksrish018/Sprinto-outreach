import { getKillState } from "@/lib/queries";
import ui from "./ui.module.css";

// Shown at the top of every page while the kill switch is on (FR-11.4).
export async function KillBanner() {
  const kill = await getKillState();
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
