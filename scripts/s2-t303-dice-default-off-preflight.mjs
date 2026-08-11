#!/usr/bin/env node
import { NEXT_ACTION, T303Stop, verifyPackage } from "./lib/s2-t303-dice-default-off-final.mjs";

try {
  await verifyPackage();
  process.stdout.write(`${NEXT_ACTION}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof T303Stop || typeof error?.code === "string" ? error.code : "STOP_S2_T303_PREFLIGHT_UNSAFE"}\n`);
  process.exitCode = 1;
}
