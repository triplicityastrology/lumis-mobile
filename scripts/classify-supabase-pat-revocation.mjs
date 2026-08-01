import { readFileSync } from "node:fs";

const raw = readFileSync(0, "utf8").slice(0, 32_768);
const message = raw.toLowerCase().replace(/\s+/g, " ").trim();

const hasDeniedStatus = /\b(?:401|403)\b/.test(message);
const hasAuthDenial = /\b(?:unauthorized|forbidden|authentication denied|authorization denied|invalid (?:personal )?access token|access token (?:is )?(?:invalid|revoked|expired))\b/.test(
  message
);
const hasNonAuthFailure = /\b(?:network|timed? out|timeout|dns|econn\w*|connection|connect|socket|tls|certificate|project (?:ref )?(?:not found|invalid|unknown|mismatch)|wrong project|command not found|unknown command|failed to parse|usage:)\b/.test(
  message
);

if (hasDeniedStatus && hasAuthDenial && !hasNonAuthFailure) {
  process.stdout.write("PAT_REVOCATION_AUTH_DENIAL_CONFIRMED\n");
  process.exit(0);
}

process.exit(1);
