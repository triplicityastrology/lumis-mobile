const APPROVED_PROJECT_REF = "bmqhwofmdgebpcihjlnb";
const APPROVED_CLI_VERSION = "2.109.1";
const REQUIRED_ANCESTOR = "4269765d1656bb0980ec7b00a3d0b56b818bf8c9";
const REQUIRED_MIGRATIONS = [
  ["0032_care_circle_backend_foundation.sql", "9d5dfdeab0975c9c8d923495bd5a17fa26ea5c26ef05ba4f036ac506b087a79e"],
  ["0033_inactive_notification_foundation.sql", "0996ecd9fcf6e4fb2b083d980e69a0c2dd042107bc8e753fdd43f79d0bcb0a1d"],
  ["0034_reusable_care_pairing_operations.sql", "466821a3a92a1f75543cf265d2d2c4e3dcb3f850ee79efd77df3269cd4797ceb"]
];
const REQUIRED_EDGE_FILES = [
  ["supabase/functions/care-circle/index.ts", "ecf5a066e7eef4c5b18ef996d029a2dbeacf70a589845a1d49e9e88a981b49e2"],
  ["supabase/functions/care-circle/operation-boundary.ts", "33046b779a55f4e901d993bad6e6907995bfb497c8eda585dbd1f6d68ec3a7d8"],
  ["supabase/functions/_shared/cors.ts", "e4ea6680fbb157a84a060c26f31b5795f9fbea00d239cbf78a2a3596bf7ef3f9"]
];
const REQUIRED_HISTORY_COLUMNS = [
  ["version", "text", "text", "NO", 1],
  ["statements", "ARRAY", "_text", "YES", 2],
  ["name", "text", "text", "YES", 3]
];

export const finalParityConstants = Object.freeze({
  approvedProjectRef: APPROVED_PROJECT_REF,
  approvedCliVersion: APPROVED_CLI_VERSION,
  requiredAncestor: REQUIRED_ANCESTOR,
  requiredMigrations: REQUIRED_MIGRATIONS,
  requiredEdgeFiles: REQUIRED_EDGE_FILES,
  requiredHistoryColumns: REQUIRED_HISTORY_COLUMNS
});

export function validateFinalParity(snapshot) {
  stopUnless(snapshot.projectRef === APPROVED_PROJECT_REF, "WRONG_PROJECT");
  stopUnless(snapshot.cliVersion === APPROVED_CLI_VERSION, "CLI_PIN_MISMATCH");
  stopUnless(snapshot.ancestorPresent === true, "APPROVED_ANCESTRY_MISSING");
  stopUnless(snapshot.dirtyPaths.length === 0, "WORKTREE_NOT_CLEAN");
  stopUnless(snapshot.linkedRef === null || snapshot.linkedRef === APPROVED_PROJECT_REF, "LINKED_PROJECT_MISMATCH");

  assertExactEntries(snapshot.migrations, REQUIRED_MIGRATIONS, "MIGRATION");
  assertExactEntries(snapshot.dashboardSources, REQUIRED_MIGRATIONS, "DASHBOARD_SOURCE");
  assertExactEntries(snapshot.edgeFiles, REQUIRED_EDGE_FILES, "EDGE_BUNDLE");
  stopUnless(snapshot.dashboardPacketVersions.join(",") === "0032,0033,0034", "DASHBOARD_ORDER_INVALID");
  stopUnless(snapshot.dashboardPacketParity === true, "DASHBOARD_PACKET_STALE");
  assertExactHistoryColumns(snapshot.historyColumns, REQUIRED_HISTORY_COLUMNS);
  stopUnless(snapshot.historyInsertsVerified === true, "HISTORY_INSERT_UNSAFE");
  stopUnless(snapshot.networkCalls === 0, "NETWORK_BOUNDARY_VIOLATION");
  return { ok: true };
}

function assertExactHistoryColumns(actual, expected) {
  stopUnless(actual.length === expected.length, "HISTORY_METADATA_UNSAFE");
  for (let index = 0; index < expected.length; index += 1) {
    stopUnless(
      JSON.stringify(actual[index]) === JSON.stringify(expected[index]),
      "HISTORY_METADATA_UNSAFE"
    );
  }
}

function assertExactEntries(actual, expected, prefix) {
  stopUnless(actual.length === expected.length, `${prefix}_SET_INVALID`);
  for (let index = 0; index < expected.length; index += 1) {
    const [expectedName, expectedHash] = expected[index];
    const [actualName, actualHash] = actual[index] ?? [];
    stopUnless(actualName === expectedName, `${prefix}_ORDER_INVALID`);
    stopUnless(actualHash === expectedHash, `${prefix}_CHECKSUM_MISMATCH`);
  }
}

function stopUnless(condition, code) {
  if (!condition) throw new Error(`STOP_S2_T74_${code}`);
}
