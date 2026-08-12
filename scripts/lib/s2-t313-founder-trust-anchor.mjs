import { createHash, createPublicKey } from "node:crypto";

const SHA256 = /^[a-f0-9]{64}$/u;
const KEY_ID = /^founder-ed25519-[a-z0-9-]{8,48}$/u;
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value, keys) => isRecord(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
export class T313TrustAnchorStop extends Error {
  constructor(code) { super(code); this.name = "T313TrustAnchorStop"; this.code = code; }
}
const stop = (code) => { throw new T313TrustAnchorStop(code); };

export function validateFounderTrustAnchor(control) {
  const keys = ["schema", "issuer", "trust_anchor_owner", "algorithm", "issuer_key_id", "issuer_public_key_spki_sha256", "custody_classification", "operational_signing_authorized", "deployment_authorized", "migration_authorized", "provider_traffic_authorized"];
  if (!exact(control, keys)) stop("STOP_S2_T313_TRUST_ANCHOR_INVALID");
  if (control.schema !== "s2_t313_founder_signer_trust_anchor_v1" || control.issuer !== "Lumis Founder Deployment Approver" || control.trust_anchor_owner !== "Founder" || control.algorithm !== "Ed25519" || !KEY_ID.test(control.issuer_key_id) || !SHA256.test(control.issuer_public_key_spki_sha256) || control.custody_classification !== "LOCAL_NON_CLOUD_OWNER_ONLY") stop("STOP_S2_T313_TRUST_ANCHOR_INVALID");
  if (control.operational_signing_authorized !== false || control.deployment_authorized !== false || control.migration_authorized !== false || control.provider_traffic_authorized !== false) stop("STOP_S2_T313_AUTHORITY_EXPANSION_REJECTED");
  return control;
}

export function verifyFounderPublicKey({ control, publicKeyPem, request }) {
  validateFounderTrustAnchor(control);
  if (!isRecord(request) || request.issuer_key_id !== control.issuer_key_id || request.issuer_public_key_spki_sha256 !== control.issuer_public_key_spki_sha256 || request.trust_anchor_owner !== "Founder") stop("STOP_S2_T313_REQUEST_TRUST_ANCHOR_MISMATCH");
  let publicKey;
  try { publicKey = createPublicKey(publicKeyPem); } catch { stop("STOP_S2_T313_PUBLIC_KEY_INVALID"); }
  const fingerprint = createHash("sha256").update(publicKey.export({ type: "spki", format: "der" })).digest("hex");
  if (fingerprint !== control.issuer_public_key_spki_sha256) stop("STOP_S2_T313_PUBLIC_KEY_FINGERPRINT_MISMATCH");
  return Object.freeze({ issuer: control.issuer, issuerKeyId: control.issuer_key_id, fingerprintVerified: true });
}
