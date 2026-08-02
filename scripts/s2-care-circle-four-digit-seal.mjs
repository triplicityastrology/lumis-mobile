import { validateFourDigitSeal } from "./lib/care-circle-four-digit-seal.mjs";

if ((process.argv[2] ?? "--check") !== "--check") {
  process.stderr.write("STOP_S2_T146_ARGUMENTS_INVALID\n");
  process.exit(1);
}
try {
  const seal = validateFourDigitSeal();
  process.stdout.write("S2_T146_FOUR_DIGIT_PARITY_SEALED\n");
  process.stdout.write(`migration=${seal.migration_version} code_format=${seal.pairing_code_format} expiry_seconds=${seal.expiry_seconds}\n`);
  process.stdout.write(`locked_sources=${seal.locked_sources.length} network_calls=0 deployment_actions=0\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "STOP_S2_T146_UNKNOWN"}\n`);
  process.exit(1);
}
