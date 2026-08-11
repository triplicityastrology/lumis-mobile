import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const control = JSON.parse(read("config/s2-t294-dice-80-control-room.json"));
assert.equal(control.runtime_package_sha256, "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457");
assert.equal(control.migration_proof_receipt_sha256, "0e4fcfafddf9f1bf9fb02868d895fa4c4f8164980613908bc97d08cf2ecb9b9e");
assert.deepEqual(control.receipt_order, ["accepted_v4_post_deploy_disabled_receipt", "accepted_0039_migration_receipt", "accepted_DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY_receipt"]);
assert.equal(control.resume_policy, "never_repeat_dispatched_or_completed_provider_attempts");
assert.equal(control.limits.technical_cases, 80); assert.equal(control.limits.en, 40); assert.equal(control.limits.zh_hant, 40); assert.equal(control.limits.attempts, 160); assert.equal(control.limits.concurrency, 2); assert.equal(control.limits.cost_ceiling_usd, 0.128);
assert.deepEqual(control.authority_status, ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);

const library = read("scripts/lib/s2-t294-dice-control-room.mjs");
assert.match(library, /state === "dispatched"/); assert.match(library, /STOP_S2_T294_AMBIGUOUS_DISPATCH_REQUIRES_REVIEW/); assert.match(library, /await Promise\.all\(\[worker\(\), worker\(\)\]\)/); assert.match(library, /await gateway\.disable/); assert.match(library, /provider_disabled_verified/);
const cli = read("scripts/s2-t294-dice-control-room.mjs"); assert(!/https?:\/\//.test(cli)); assert(!/fetch\(|createClient|SupabaseClient/.test(cli));
const noReceipt = spawnSync(process.execPath, ["scripts/s2-t294-dice-control-room.mjs", "preflight"], { encoding: "utf8" }); assert.equal(noReceipt.status, 2); assert.equal(JSON.parse(noReceipt.stdout).status, "WAITING_FOR_ACCEPTED_DICE_V4_POST_DEPLOY_DISABLED_RECEIPT");
const emulator = execFileSync(process.execPath, ["scripts/s2-t294-dice-control-room-emulator.mjs"], { encoding: "utf8" }); assert.match(emulator, /cases=80 en=40 zh_hant=40/); assert.match(emulator, /peak=2/); assert.match(emulator, /remote_calls=0/);

const mobile = read("apps/mobile/src/dev/FounderDiceTechnicalControlRoom.tsx"); const fixture = read("apps/mobile/src/dev/diceTechnicalControlRoomFixture.ts"); const index = read("apps/mobile/index.ts"); const launcher = read("scripts/start-s2-t294-dice-control-room-web.sh");
assert.match(mobile, /LOCAL REHEARSAL · NOT AZURE · NO AUTHORITY/); assert.match(mobile, /Show emergency stop command/); assert.match(mobile, /Resume never repeats/); assert.match(mobile, /Cost \$/); assert.match(fixture, /total: 80/); assert.match(fixture, /concurrencyLimit: 2/); assert.match(index, /EXPO_PUBLIC_DICE_T294_CONTROL_ROOM/); assert.match(launcher, /PORT:-8160/); assert.match(launcher, /expo.*export --platform web --dev/); assert(!/pkill|killall|kill -/.test(launcher));
for (const path of ["supabase/tests/s2-t294-run-journal.schema.json", "supabase/tests/s2-t294-redacted-review.schema.json"]) assert.equal(JSON.parse(read(path)).additionalProperties, false);

const manifest = JSON.parse(read("config/s2-t294-dice-80-control-room-manifest.json"));
const sha = (value) => createHash("sha256").update(value).digest("hex");
const packageInput = Object.entries(manifest.files).map(([path, expected]) => { const actual = sha(readFileSync(path)); assert.equal(actual, expected, `sealed drift: ${path}`); return `${path}:${actual}\n`; }).join("");
assert.equal(sha(packageInput), manifest.package_sha256); assert.equal(manifest.local_rehearsal_is_live_proof, false);
console.log("S2_T294_DICE_CONTROL_ROOM_CONTRACT_OK cases=80 concurrency=2 remote_calls=0");
