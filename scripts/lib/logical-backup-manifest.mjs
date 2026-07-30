import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const APPROVED_REF = "bmqhwofmdgebpcihjlnb";
const APPROVED_CLI_VERSION = "2.109.1";
const APPROVED_COMPONENTS = Object.freeze([
  "roles.sql",
  "schema.sql",
  "data.sql",
]);
const MOUNT_PATTERN =
  /^\/Volumes\/LumisStagingBackup-\d{8}T\d{6}Z$/;

export function validateManifestRequest(input) {
  if (input.projectRef !== APPROVED_REF) {
    throw safeError("MANIFEST_STAGING_PROJECT_REQUIRED");
  }
  if (input.supabaseCliVersion !== APPROVED_CLI_VERSION) {
    throw safeError("MANIFEST_CLI_VERSION_MISMATCH");
  }
  if (!/^\d{2}$/.test(input.postgresMajor ?? "")) {
    throw safeError("MANIFEST_POSTGRES_MAJOR_INVALID");
  }
  if (!/^[0-9a-f]{40}$/.test(input.sourceCommit ?? "")) {
    throw safeError("MANIFEST_SOURCE_COMMIT_INVALID");
  }
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(
      input.backupUtcTimestamp ?? ""
    )
  ) {
    throw safeError("MANIFEST_TIMESTAMP_INVALID");
  }

  const componentRoot = path.resolve(input.componentRoot ?? "");
  if (!MOUNT_PATTERN.test(componentRoot)) {
    throw safeError("MANIFEST_ENCRYPTED_MOUNT_REQUIRED");
  }
  const output = path.resolve(input.output ?? "");
  if (output !== path.join(componentRoot, "manifest.json")) {
    throw safeError("MANIFEST_OUTPUT_PATH_INVALID");
  }

  return {
    backupUtcTimestamp: input.backupUtcTimestamp,
    componentRoot,
    output,
    postgresMajor: input.postgresMajor,
    projectRef: APPROVED_REF,
    sourceCommit: input.sourceCommit,
    supabaseCliVersion: APPROVED_CLI_VERSION,
  };
}

export async function writeLogicalBackupManifest(input) {
  const request = validateManifestRequest(input);
  const components = [];

  for (const filename of APPROVED_COMPONENTS) {
    const componentPath = path.join(request.componentRoot, filename);
    if (!existsSync(componentPath) || !statSync(componentPath).isFile()) {
      throw safeError("MANIFEST_COMPONENT_MISSING");
    }
    const byteSize = statSync(componentPath).size;
    if (byteSize <= 0) {
      throw safeError("MANIFEST_COMPONENT_EMPTY");
    }
    components.push({
      byte_size: byteSize,
      filename,
      sha256: await sha256File(componentPath),
    });
  }

  const manifest = {
    backup_utc_timestamp: request.backupUtcTimestamp,
    components,
    postgres_major: request.postgresMajor,
    project_ref: request.projectRef,
    source_commit: request.sourceCommit,
    supabase_cli_version: request.supabaseCliVersion,
  };
  writeFileSync(
    request.output,
    `${JSON.stringify(manifest, null, 2)}\n`,
    { encoding: "utf8", flag: "wx", mode: 0o600 }
  );
  return manifest;
}

async function sha256File(filename) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filename)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

function safeError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}
