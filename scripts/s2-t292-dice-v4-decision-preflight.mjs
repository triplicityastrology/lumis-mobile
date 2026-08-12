#!/usr/bin/env node
import { DecisionStop, NEXT_DECISION, createReviewPacket, verifyReady } from "./lib/s2-t292-dice-v4-decision-packet.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...parts] = arg.replace(/^--/u, "").split("=");
  return [key, parts.join("=") || true];
}));

try {
  if (typeof args["request-id"] === "string" || typeof args["issuer-public-key-spki-sha256"] === "string" || typeof args["issuer-key-id"] === "string") {
    if (typeof args["request-id"] !== "string" || typeof args["issuer-public-key-spki-sha256"] !== "string" || typeof args["issuer-key-id"] !== "string") throw new DecisionStop("STOP_S2_T292_DECISION_PACKET_INVALID");
    process.stdout.write(`${JSON.stringify(await createReviewPacket({ requestId: args["request-id"], issuerPublicKeySpkiSha256: args["issuer-public-key-spki-sha256"], issuerKeyId: args["issuer-key-id"] }), null, 2)}\n`);
  } else {
    await verifyReady();
    process.stdout.write(`${NEXT_DECISION}\n`);
  }
} catch (error) {
  process.stderr.write(`${error instanceof DecisionStop || typeof error?.code === "string" ? error.code : "STOP_S2_T292_PREFLIGHT_UNSAFE"}\n`);
  process.exitCode = 1;
}
