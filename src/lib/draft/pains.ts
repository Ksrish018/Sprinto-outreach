// FR-6: two pains from a fixed library keyed by role x trigger x stage. The model never invents a pain.
import type { RoleGroup } from "../people/pick";

export type Trigger = "audit_prep" | "enterprise";

export type Pain = { id: string; text: string; roles: RoleGroup[]; triggers: Trigger[]; needsCert?: boolean; needsJob?: boolean };

export const PAINS: Pain[] = [
  { id: "audit_eats_eng_time", text: "audit prep pulls engineers off the product for weeks", roles: ["engineering", "founder"], triggers: ["audit_prep"] },
  { id: "manual_evidence", text: "evidence collection is manual: screenshots, spreadsheets and chasing owners", roles: ["engineering", "security"], triggers: ["audit_prep"] },
  { id: "new_hire_ramp", text: "a new compliance hire spends the first months building the evidence trail instead of running the program", roles: ["security", "engineering", "founder"], triggers: ["audit_prep"], needsJob: true },
  { id: "first_cert_no_owner", text: "nobody owns compliance yet, so the first certification feels open-ended", roles: ["founder"], triggers: ["audit_prep"] },
  { id: "deals_stall_reviews", text: "enterprise deals stall in security reviews while the report is not ready", roles: ["founder", "sales"], triggers: ["enterprise"] },
  { id: "questionnaires_drain", text: "security questionnaires eat hours of senior engineering time every week", roles: ["engineering", "security", "sales"], triggers: ["enterprise"] },
  { id: "next_framework_overlap", text: "adding the next framework on top of SOC 2 means duplicated controls and overlapping audits", roles: ["security", "engineering"], triggers: ["audit_prep", "enterprise"], needsCert: true },
  { id: "drift_between_audits", text: "controls drift between audits and nobody notices until the auditor does", roles: ["security", "engineering"], triggers: ["audit_prep", "enterprise"] },
];

export function pickPains(role: RoleGroup, triggers: Trigger[], ctx: { holdsCert: boolean; hiringCompliance: boolean }): Pain[] {
  const fits = PAINS.filter((p) =>
    p.roles.includes(role) && p.triggers.some((t) => triggers.includes(t)) &&
    (!p.needsCert || ctx.holdsCert) && (!p.needsJob || ctx.hiringCompliance));
  // Most specific first: pains that need a matching fact beat generic ones.
  const ranked = [...fits].sort((a, b) => Number(Boolean(b.needsJob || b.needsCert)) - Number(Boolean(a.needsJob || a.needsCert)));
  return ranked.slice(0, 2);
}
