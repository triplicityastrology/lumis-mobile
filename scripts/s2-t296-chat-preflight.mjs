import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { repositoryIdentity } from "./lib/s2-t296-chat-operational.mjs";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const seal = JSON.parse(read("config/s2-t296-chat-operational-seal.json"));
const { package_binding_sha256: binding, ...bound } = seal;
if (sha(JSON.stringify(bound)) !== binding) throw new Error("STOP_S2_T296_PACKAGE_DRIFT");
for (const [file, digest] of Object.entries(seal.source_sha256)) if (sha(read(file)) !== digest) throw new Error(`STOP_S2_T296_SOURCE_DRIFT:${file}`);
repositoryIdentity(root);
if (seal.accepted_dice_evidence_sha256 === null) {
  console.log("WAITING_FOR_ACCEPTED_T287_T289_DICE_EVIDENCE");
} else if (seal.compiled_authorities.deployment_authorization_sha256 === null) {
  console.log("OBTAIN_MICROSOFT_CHAT_DEFAULT_OFF_DEPLOYMENT_AUTHORIZATION");
} else {
  console.log("READY_FOR_SEPARATELY_AUTHORIZED_CHAT_OPERATION_REVIEW");
}
console.log("NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
console.log("NO_AZURE_TRAFFIC_AUTHORITY");
console.log("remote_calls=0 provider_calls=0 persistence_writes=0 units_charged=0");
