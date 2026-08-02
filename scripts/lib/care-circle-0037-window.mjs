import { createHash } from "node:crypto";

export function checkpointDigest(value) {
  return createHash("sha256").update(JSON.stringify({
    version: value.version,
    project_ref: value.project_ref,
    completed: value.completed,
    evidence_sha256: value.evidence_sha256,
  })).digest("hex");
}

export function validateCheckpoint(value, control) {
  if (!value || typeof value !== "object" || Array.isArray(value)) stop("CHECKPOINT_INVALID");
  const keys = Object.keys(value).sort();
  if (JSON.stringify(keys) !== JSON.stringify(["completed", "digest", "evidence_sha256", "project_ref", "version"])) stop("CHECKPOINT_FIELDS_INVALID");
  if (value.version !== 1 || value.project_ref !== control.project_ref) stop("CHECKPOINT_SCOPE_INVALID");
  if (!Array.isArray(value.completed) || !Array.isArray(value.evidence_sha256) || value.completed.length !== value.evidence_sha256.length) stop("CHECKPOINT_SHAPE_INVALID");
  if (value.completed.some((stage, index) => stage !== control.stages[index])) stop("CHECKPOINT_ORDER_INVALID");
  if (value.evidence_sha256.some((hash) => !/^[0-9a-f]{64}$/u.test(hash))) stop("CHECKPOINT_EVIDENCE_INVALID");
  if (value.digest !== checkpointDigest(value)) stop("CHECKPOINT_DIGEST_INVALID");
  return value;
}

export function appendCheckpoint(current, stage, evidenceSha256, control) {
  const checkpoint = current ?? {
    version: 1, project_ref: control.project_ref, completed: [], evidence_sha256: [],
  };
  if (stage !== control.stages[checkpoint.completed.length]) stop("STAGE_SEQUENCE_INVALID");
  if (!/^[0-9a-f]{64}$/u.test(evidenceSha256)) stop("EVIDENCE_SHA_INVALID");
  const next = {
    version: 1,
    project_ref: control.project_ref,
    completed: [...checkpoint.completed, stage],
    evidence_sha256: [...checkpoint.evidence_sha256, evidenceSha256],
  };
  return { ...next, digest: checkpointDigest(next) };
}

export function nextStage(checkpoint, control) {
  return control.stages[checkpoint?.completed.length ?? 0] ?? null;
}

function stop(code) { throw new Error(`STOP_S2_T143_${code}`); }
