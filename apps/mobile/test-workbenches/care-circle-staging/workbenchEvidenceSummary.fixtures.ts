import {
  buildSelectableWorkbenchSummary,
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
  confirmationSource: "unconfirmed",
});
equal(confirmedCount(summary), 0, "request-ready state is not evidence");

for (const input of [
  {
    journeyStage: "caree_create_code",
    accountRole: "caree",
    evidenceName: "caree_code_ready",
    confirmationSource: "operation_result",
  },
  {
    journeyStage: "carer_submit_code",
    accountRole: "carer",
    evidenceName: "carer_pending_no_authority",
    confirmationSource: "safe_projection",
  },
  {
    journeyStage: "caree_accept",
    accountRole: "caree",
    evidenceName: "active",
    confirmationSource: "safe_projection",
  },
  {
    journeyStage: "caree_pause",
    accountRole: "caree",
    evidenceName: "paused",
    confirmationSource: "safe_projection",
  },
  {
    journeyStage: "caree_resume",
    accountRole: "caree",
    evidenceName: "active",
    confirmationSource: "safe_projection",
  },
  {
    journeyStage: "carer_remove",
    accountRole: "carer",
    evidenceName: "removed",
    confirmationSource: "safe_projection",
  },
  {
    journeyStage: "operator_cleanup_required",
    accountRole: "carer",
    evidenceName: "relationship_cleanup_complete",
    confirmationSource: "safe_projection",
  },
] as const) {
  summary = recordConfirmedWorkbenchEvidence(summary, input);
}
equal(confirmedCount(summary), 7, "confirmed journey records all safe checks");

const unchanged = recordConfirmedWorkbenchEvidence(summary, {
  journeyStage: "caree_accept",
  accountRole: "carer",
  evidenceName: "active",
  confirmationSource: "safe_projection",
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

const unconfirmedSummary = recordConfirmedWorkbenchEvidence(reset, {
  journeyStage: "carer_submit_code",
  accountRole: "carer",
  evidenceName: "carer_pending_no_authority",
  confirmationSource: "unconfirmed",
});
equal(confirmedCount(unconfirmedSummary), 0, "unrefreshed projection cannot record evidence");

const selectable = buildSelectableWorkbenchSummary({
  buildMarker: "b063cfe6d5f6392a4bf60c4ebed741a97973add8",
  evidence: summary,
});
equal(
  selectable,
  [
    "lumis_care_circle_test_summary_v1",
    "build_marker=b063cfe6d5f6392a4bf60c4ebed741a97973add8",
    "code_ready=confirmed",
    "pending_no_authority=confirmed",
    "accepted_active=confirmed",
    "paused=confirmed",
    "resumed=confirmed",
    "self_removed=confirmed",
    "relationship_cleanup=confirmed",
  ].join("\n"),
  "selectable summary has only the closed safe fields"
);
equal(
  buildSelectableWorkbenchSummary({
    buildMarker: "unsafe marker",
    evidence: reset,
  }).includes("build_marker=unavailable"),
  true,
  "unsafe build marker is not echoed"
);

let unsafeSchemaRejected = false;
try {
  buildSelectableWorkbenchSummary({
    buildMarker: "b063cfe",
    evidence: { ...reset, raw_error: true } as typeof reset,
  });
} catch {
  unsafeSchemaRejected = true;
}
equal(unsafeSchemaRejected, true, "extra evidence fields fail closed");

console.log("Care Circle workbench evidence-summary fixtures passed");

function confirmedCount(summary: Record<string, boolean>): number {
  return Object.values(summary).filter(Boolean).length;
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: assertion failed`);
}
