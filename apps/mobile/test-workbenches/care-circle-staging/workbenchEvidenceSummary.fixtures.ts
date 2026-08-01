import {
  createWorkbenchEvidenceSummary,
  listWorkbenchEvidence,
  recordConfirmedWorkbenchEvidence,
} from "./workbenchEvidenceSummary";

let summary = createWorkbenchEvidenceSummary();
equal(confirmedCount(summary), 0, "evidence starts empty");

summary = recordConfirmedWorkbenchEvidence(summary, {
  journeyStage: "caree_create_code",
  accountRole: "caree",
  evidenceName: "caree_ready",
});
equal(confirmedCount(summary), 0, "request-ready state is not evidence");

for (const input of [
  {
    journeyStage: "caree_create_code",
    accountRole: "caree",
    evidenceName: "caree_code_ready",
  },
  {
    journeyStage: "carer_submit_code",
    accountRole: "carer",
    evidenceName: "carer_pending_no_authority",
  },
  {
    journeyStage: "caree_accept",
    accountRole: "caree",
    evidenceName: "active",
  },
  {
    journeyStage: "caree_pause",
    accountRole: "caree",
    evidenceName: "paused",
  },
  {
    journeyStage: "caree_resume",
    accountRole: "caree",
    evidenceName: "active",
  },
  {
    journeyStage: "carer_remove",
    accountRole: "carer",
    evidenceName: "removed",
  },
  {
    journeyStage: "operator_cleanup_required",
    accountRole: "carer",
    evidenceName: "relationship_cleanup_complete",
  },
] as const) {
  summary = recordConfirmedWorkbenchEvidence(summary, input);
}
equal(confirmedCount(summary), 7, "confirmed journey records all safe checks");

const unchanged = recordConfirmedWorkbenchEvidence(summary, {
  journeyStage: "caree_accept",
  accountRole: "carer",
  evidenceName: "active",
});
equal(unchanged, summary, "wrong role cannot record Caree acceptance");

const items = listWorkbenchEvidence(summary);
equal(items.length, 7, "summary has a closed check list");
equal(
  Object.keys(items[0] ?? {}).sort().join(","),
  "confirmed,label,name",
  "summary items expose safe fields only"
);

const reset = createWorkbenchEvidenceSummary();
equal(confirmedCount(reset), 0, "reset clears evidence");

console.log("Care Circle workbench evidence-summary fixtures passed");

function confirmedCount(summary: Record<string, boolean>): number {
  return Object.values(summary).filter(Boolean).length;
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: assertion failed`);
}
