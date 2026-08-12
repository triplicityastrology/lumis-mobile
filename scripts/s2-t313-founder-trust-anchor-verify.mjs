#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { T313TrustAnchorStop, verifyFounderPublicKey } from "./lib/s2-t313-founder-trust-anchor.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/u, "").split("=");
  return [key, value.join("=")];
}));
if (!args["issuer-public-key"]) {
  process.stdout.write("SUPPLY_FOUNDER_CUSTODY_PUBLIC_KEY\n");
  process.exit(0);
}
try {
  const control = JSON.parse(await readFile("config/s2-t313-founder-signer-trust-anchor.json", "utf8"));
  const request = {
    issuer_key_id: control.issuer_key_id,
    issuer_public_key_spki_sha256: control.issuer_public_key_spki_sha256,
    trust_anchor_owner: control.trust_anchor_owner,
  };
  verifyFounderPublicKey({ control, publicKeyPem: await readFile(args["issuer-public-key"], "utf8"), request });
  process.stdout.write("FOUNDER_CUSTODY_PUBLIC_FINGERPRINT_VERIFIED\n");
} catch (error) {
  process.stderr.write(`${error instanceof T313TrustAnchorStop ? error.code : "STOP_S2_T313_PUBLIC_KEY_INVALID"}\n`);
  process.exitCode = 1;
}
