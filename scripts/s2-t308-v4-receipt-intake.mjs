#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { NEXT_ACTION, T308Stop, validateAndClaim, verifyPackage } from "./lib/s2-t308-v4-receipt-deployment-day.mjs";
import { T313TrustAnchorStop, verifyFounderPublicKey } from "./lib/s2-t313-founder-trust-anchor.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/u, "").split("=");
  return [key, value.join("=")];
}));

try {
  if (!args.authorization && !args.request && !args["issuer-public-key"] && !args.ledger) {
    await verifyPackage(process.cwd());
    process.stdout.write(`${NEXT_ACTION}\n`);
  } else {
    for (const name of ["authorization", "request", "issuer-public-key", "ledger"]) if (!args[name]) throw new T308Stop("STOP_S2_T308_RECEIPT_INVALID");
    const request = JSON.parse(await readFile(args.request, "utf8"));
    const receipt = JSON.parse(await readFile(args.authorization, "utf8"));
    const issuerPublicKeyPem = await readFile(args["issuer-public-key"], "utf8");
    const trustAnchor = JSON.parse(await readFile("config/s2-t313-founder-signer-trust-anchor.json", "utf8"));
    verifyFounderPublicKey({ control: trustAnchor, publicKeyPem: issuerPublicKeyPem, request });
    const { authorization } = await validateAndClaim({ request, receipt, issuerPublicKeyPem, ledgerPath: args.ledger });
    process.stdout.write(`S2_T308_RECEIPT_CLAIMED deployment_id=${authorization.deploymentId}\n`);
  }
} catch (error) {
  process.stderr.write(`${error instanceof T308Stop || error instanceof T313TrustAnchorStop ? error.code : "STOP_S2_T308_RECEIPT_INVALID"}\n`);
  process.exitCode = 1;
}
