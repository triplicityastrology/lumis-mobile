#!/usr/bin/env node
import { verifyOfflinePreflight, NEXT_DECISION, T298Stop } from "./lib/s2-t298-dice-v4-zero-call.mjs";

try {
  await verifyOfflinePreflight();
  process.stdout.write(`${NEXT_DECISION}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof T298Stop ? error.code : "STOP_S2_T298_PREFLIGHT_UNSAFE"}\n`);
  process.exitCode = 1;
}
