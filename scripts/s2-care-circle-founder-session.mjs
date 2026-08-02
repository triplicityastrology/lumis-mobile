import { CARE_CIRCLE_FOUNDER_SESSION_STAGES, resolveFounderSessionCheckpoint } from "./lib/care-circle-founder-session.mjs";

try {
  const completed = parseArgs(process.argv.slice(2));
  const result = resolveFounderSessionCheckpoint(completed);
  process.stdout.write([
    "S2_T109_FOUNDER_SESSION_CHECKPOINT",
    `status=${result.status}`,
    `completed_count=${result.completedCount}`,
    `next=${result.next ?? "none"}`,
    `next_operator=${result.nextOperator ?? "none"}`,
    `cleanup_required=${result.cleanupRequired}`,
    `qa_key_revocation_required=${result.qaKeyRevocationRequired}`,
    "state_persisted=false network_calls=0 credentials_requested=0",
  ].join("\n") + "\n");
} catch (error) {
  const code = error instanceof Error && /^STOP_S2_T109_[A-Z0-9_]+$/.test(error.message)
    ? error.message : "STOP_S2_T109_UNKNOWN";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}

function parseArgs(values) {
  if (values.length === 0) return [];
  if (values.length !== 2 || values[0] !== "--completed") throw new Error("STOP_S2_T109_ARGUMENTS_INVALID");
  if (values[1] === "") return [];
  const completed = values[1].split(",");
  if (completed.some((value) => !CARE_CIRCLE_FOUNDER_SESSION_STAGES.includes(value))) {
    throw new Error("STOP_S2_T109_CHECKPOINT_UNKNOWN");
  }
  return completed;
}
