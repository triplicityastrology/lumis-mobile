#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { validateFounderTrustAnchor, verifyFounderPublicKey } from "./lib/s2-t313-founder-trust-anchor.mjs";

const read = (path) => readFileSync(path, "utf8");
const chain = [
  "scripts/lib/s2-t287-dice-v4-deployment-authorization.mjs",
  "scripts/lib/s2-t308-v4-receipt-deployment-day.mjs",
  "scripts/s2-t308-v4-receipt-intake.mjs",
  "scripts/run-s2-t308-v4-deployment-day.zsh",
  "supabase/tests/s2-t287-default-off-deployment-authorization-request-v4.schema.json",
  "supabase/tests/s2-t287-founder-default-off-deployment-authorization-v4.schema.json",
].map(read).join("\n");

assert.match(chain, /Lumis Founder Deployment Approver/u);
assert.match(chain, /issuer_public_key_spki_sha256/u);
assert.match(chain, /issuer_signature_base64/u);
assert.match(chain, /issuer_key_id/u);
assert.match(chain, /trust_anchor_owner/u);
assert.doesNotMatch(chain, /microsoft_signing_key_sha256|microsoft_signature_base64|--microsoft-public-key/u);
assert.match(chain, /authorization_window_seconds[^\n]*900|window_seconds[^\n]*900/u);
assert.match(chain, /single_use/u);
assert.match(chain, /rollback/u);
assert.match(chain, /provider_calls_authorized[^\n]*0/u);

const trustAnchor = validateFounderTrustAnchor(JSON.parse(read("config/s2-t313-founder-signer-trust-anchor.json")));
assert.equal(trustAnchor.issuer, "Lumis Founder Deployment Approver");
assert.equal(trustAnchor.trust_anchor_owner, "Founder");
assert.equal(trustAnchor.operational_signing_authorized, false);
const unrelated = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" });
assert.throws(() => verifyFounderPublicKey({ control: trustAnchor, publicKeyPem: unrelated, request: trustAnchor }), /STOP_S2_T313_PUBLIC_KEY_FINGERPRINT_MISMATCH/u);
const receipt = JSON.parse(read("config/evidence/s2-t313-founder-key-generation-receipt.json"));
assert.equal(receipt.private_key_material_recorded, false);
assert.equal(receipt.private_path_recorded, false);
assert.equal(receipt.operational_signatures_created, 0);
assert.equal(receipt.remote_calls, 0);

const inert = spawnSync(process.execPath, ["scripts/s2-t313-founder-ed25519-key-setup.mjs"], { encoding: "utf8" });
assert.equal(inert.status, 0);
assert.equal(inert.stdout, "WAITING_FOR_EXPLICIT_FOUNDER_KEY_CREATION_APPROVAL\n");
const denied = spawnSync(process.execPath, ["scripts/s2-t313-founder-ed25519-key-setup.mjs", "--execute=true", "--approval=not-approved", "--output=/Users/Shared/lumis-founder/private.pem", "--issuer-key-id=founder-ed25519-primary-2026"], { encoding: "utf8" });
assert.notEqual(denied.status, 0);
assert.equal(denied.stderr, "STOP_S2_T313_EXPLICIT_FOUNDER_APPROVAL_REQUIRED\n");
const verifyInert = spawnSync(process.execPath, ["scripts/s2-t313-founder-trust-anchor-verify.mjs"], { encoding: "utf8" });
assert.equal(verifyInert.status, 0);
assert.equal(verifyInert.stdout, "SUPPLY_FOUNDER_CUSTODY_PUBLIC_KEY\n");

process.stdout.write("S2_T313_FOUNDER_SIGNER_CONTRACT_OK\n");
