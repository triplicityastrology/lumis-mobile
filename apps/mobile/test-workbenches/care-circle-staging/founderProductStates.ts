export const CARE_CIRCLE_FOUNDER_PRODUCT_STATES = ["landing", "code_ready", "code_copied", "carer_entry", "pending_no_authority", "caree_decision", "active", "paused", "resumed", "self_remove", "cleanup", "expired", "invalid"] as const;
export type CareCircleFounderProductState = (typeof CARE_CIRCLE_FOUNDER_PRODUCT_STATES)[number];
export const CARE_CIRCLE_FOUNDER_STATE_LABELS: Record<CareCircleFounderProductState, string> = {
  landing: "Care Circle home", code_ready: "Code ready", code_copied: "Code copied",
  carer_entry: "Carer code entry", pending_no_authority: "Pending, no authority",
  caree_decision: "Caree decision", active: "Active", paused: "Paused", resumed: "Resumed",
  self_remove: "Carer self-removal", cleanup: "Removed and clean", expired: "Expired code", invalid: "Invalid code",
};
export function founderProductStateRole(state: CareCircleFounderProductState): "caree" | "carer" {
  return ["carer_entry", "pending_no_authority", "active", "self_remove", "invalid"].includes(state) ? "carer" : "caree";
}
