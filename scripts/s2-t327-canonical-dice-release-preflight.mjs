#!/usr/bin/env node
import { SUCCESS, validateRoot } from "./lib/s2-t327-canonical-dice-release-root.mjs";

try {
  validateRoot();
  process.stdout.write(`${SUCCESS}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "STOP_S2_T327_PREFLIGHT_UNSAFE"}\n`);
  process.exitCode = 1;
}
