#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const contract = spawnSync(process.execPath, ["scripts/s2-t315-authorization-day-contract.mjs"], { encoding: "utf8", env: { PATH: process.env.PATH ?? "" } });
if (contract.status !== 0) { process.stderr.write(contract.stderr || contract.stdout); process.exit(contract.status ?? 1); }
const rehearsal = spawnSync(process.execPath, ["scripts/s2-t304-dice-80-results-emulator.mjs"], { encoding: "utf8", env: { PATH: process.env.PATH ?? "" } });
if (rehearsal.status !== 0) { process.stderr.write(rehearsal.stderr || rehearsal.stdout); process.exit(rehearsal.status ?? 1); }
const receipt = JSON.parse(readFileSync(".tmp/s2-t304-emulator/rehearsal-receipt.json", "utf8"));
if (receipt.cases !== 80 || receipt.en !== 40 || receipt.zh_hant !== 40 || receipt.attempts > 160 || receipt.peak_concurrency > 2 || receipt.cost_ceiling_usd !== 0.128 || receipt.provider_disabled_verified !== true || receipt.remote_calls !== 0) {
  process.stderr.write("STOP_S2_T315_ZERO_NETWORK_REHEARSAL_INVALID\n");
  process.exit(1);
}
console.log(`S2_T315_ZERO_NETWORK_REHEARSAL_OK cases=80 en=40 zh_hant=40 attempts=${receipt.attempts} concurrency=${receipt.peak_concurrency} input=800 output=300 cost_ceiling_usd=0.128 disabled=true remote_calls=0`);
