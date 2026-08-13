#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "apps/mobile/App.tsx",
  "apps/mobile/src/features/dice/CustomerDiceRitualRoute.tsx",
  "apps/mobile/src/features/dice/DiceRitualScreen.tsx",
  "apps/mobile/src/features/dice/dicePreRollValidation.ts",
  "apps/mobile/src/services/diceCustomerInterpretationController.ts",
  "apps/mobile/src/services/diceFounderFixtureRegistry.ts",
  "config/s2-t337-customer-dice-rc.json",
  "scripts/start-s2-t337-customer-dice-ssd.sh"
].sort();
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const entries = files.map((path) => ({ path, sha256: sha256(readFileSync(path)) }));
const packageSha256 = sha256(entries.map(({ path, sha256: digest }) => `${path}\0${digest}\n`).join(""));
writeFileSync("config/s2-t337-customer-dice-rc-seal.json", `${JSON.stringify({
  schema: "lumis_s2_t337_customer_dice_release_candidate_seal_v1",
  base_commit: "7767b69bef7e33f6aa898ca9a0c14ca2ce3b7c12",
  package_sha256: packageSha256,
  files: entries,
}, null, 2)}\n`);
console.log(`S2_T337_PACKAGE_SHA256=${packageSha256}`);
