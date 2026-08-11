#!/usr/bin/env node
import { T307Stop, verifyRelease } from "./lib/s2-t307-dice-release-candidate.mjs";

try {
  const { control, seal, head } = verifyRelease();
  process.stdout.write(`${JSON.stringify({
    status: control.status,
    source_commit: head,
    package_sha256: seal.package_sha256,
    missing_external_receipts: control.required_external_receipts,
    remote_calls: 0,
    authority_status: [control.normal_chat_authority, control.azure_traffic_authority]
  })}\n`);
  process.exitCode = 2;
} catch (error) {
  process.stderr.write(`${error instanceof T307Stop ? error.code : "STOP_S2_T307_READINESS_UNSAFE"}\n`);
  process.exitCode = 1;
}
