import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "apps/mobile/index.ts",
  "apps/mobile/src/dev/FounderDiceTechnicalControlRoom.tsx",
  "apps/mobile/src/dev/diceTechnicalControlRoomFixture.ts",
  "apps/mobile/src/types/env.d.ts",
  "config/s2-t294-dice-80-control-room.json",
  "docs/qa/S2-T294-dice-technical-control-room.md",
  "package.json",
  "scripts/lib/s2-t294-dice-control-room.mjs",
  "scripts/s2-t294-dice-control-room.mjs",
  "scripts/s2-t294-dice-control-room-emulator.mjs",
  "scripts/s2-t294-dice-control-room-contract.mjs",
  "scripts/start-s2-t294-dice-control-room-web.sh",
  "supabase/tests/s2-t294-run-journal.schema.json",
  "supabase/tests/s2-t294-redacted-review.schema.json"
];
const sha = (value) => createHash("sha256").update(value).digest("hex");
const hashes = Object.fromEntries(files.map((path) => [path, sha(readFileSync(path))]));
const packageSha = sha(Object.entries(hashes).map(([path, digest]) => `${path}:${digest}\n`).join(""));
const manifest = { schema: "s2_t294_dice_80_control_room_manifest_v1", base_commit: "4b2c8c7578773b59b04d4e44ef4ca2dc57b7555f", package_sha256: packageSha, execution_mode: "inert_without_three_independently_accepted_receipts", local_rehearsal_is_live_proof: false, files: hashes, authority_status: ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"] };
writeFileSync("config/s2-t294-dice-80-control-room-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`S2_T294_PACKAGE_SEALED ${packageSha}`);
