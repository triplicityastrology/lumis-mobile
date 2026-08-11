import { readFileSync } from "node:fs";
import path from "node:path";
import { loadJson, repositoryIdentity, validateDeploymentAuthorization, validateMigrationAuthorization, validateTrafficAuthorization } from "./lib/s2-t296-chat-operational.mjs";

const root = process.cwd();
const scope = process.argv[2];
const receiptPath = process.argv[3];
if (!scope) {
  await import("./s2-t296-chat-preflight.mjs");
  process.exit(0);
}
if (!receiptPath) throw new Error("STOP_S2_T296_AUTHORIZATION_PATH_REQUIRED");
const seal = loadJson(root, "config/s2-t296-chat-operational-seal.json");
const identity = repositoryIdentity(root);
const value = JSON.parse(readFileSync(path.resolve(root, receiptPath), "utf8"));
if (scope === "deployment") validateDeploymentAuthorization(value, seal, identity);
else if (scope === "migration") validateMigrationAuthorization(value, seal, identity);
else if (scope === "traffic") validateTrafficAuthorization(value, seal, identity);
else throw new Error("STOP_S2_T296_UNKNOWN_SCOPE");
console.log(`S2_T296_${scope.toUpperCase()}_AUTHORIZATION_VALID_LOCAL_ONLY`);
console.log("READY_FOR_SEPARATE_REVIEWED_REMOTE_OPERATOR");
console.log("NO_REMOTE_COMMAND_EXECUTED");
