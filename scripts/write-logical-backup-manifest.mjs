import {
  validateManifestRequest,
  writeLogicalBackupManifest,
} from "./lib/logical-backup-manifest.mjs";

const args = parseArgs(process.argv.slice(2));

if (!args.write) {
  stop("MANIFEST_WRITE_NOT_AUTHORIZED");
}

try {
  validateManifestRequest(args);
  await writeLogicalBackupManifest(args);
  process.stdout.write("logical_backup_manifest=written metadata_only=true\n");
} catch (error) {
  stop(error?.code ?? "MANIFEST_WRITE_FAILED");
}

function parseArgs(values) {
  const read = (name) => {
    const index = values.indexOf(name);
    return index >= 0 ? values[index + 1] : undefined;
  };
  return {
    backupUtcTimestamp: read("--backup-utc-timestamp"),
    componentRoot: read("--component-root"),
    output: read("--output"),
    postgresMajor: read("--postgres-major"),
    projectRef: read("--project-ref"),
    sourceCommit: read("--source-commit"),
    supabaseCliVersion: read("--supabase-cli-version"),
    write: values.includes("--write"),
  };
}

function stop(code) {
  process.stderr.write(`logical_backup_manifest=failed code=${code}\n`);
  process.exit(1);
}
