#!/usr/bin/env node
import { createHash, generateKeyPairSync } from "node:crypto";
import { mkdir, open, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

const APPROVAL = "FOUNDER_APPROVES_LOCAL_ED25519_KEY_CREATION";
const STOP = (code) => { process.stderr.write(`${code}\n`); process.exit(1); };
const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/u, "").split("=");
  return [key, value.join("=")];
}));

if (!args.execute) {
  process.stdout.write("WAITING_FOR_EXPLICIT_FOUNDER_KEY_CREATION_APPROVAL\n");
  process.exit(0);
}
if (args.approval !== APPROVAL) STOP("STOP_S2_T313_EXPLICIT_FOUNDER_APPROVAL_REQUIRED");
if (!isAbsolute(args.output ?? "") || !/^founder-ed25519-[a-z0-9-]{8,48}$/u.test(args["issuer-key-id"] ?? "")) STOP("STOP_S2_T313_KEY_DESTINATION_INVALID");

const output = resolve(args.output);
const root = await realpath(process.cwd());
const cloudMarkers = ["/CloudStorage/", "/Dropbox/", "/OneDrive/", "/Google Drive/", "/Mobile App/"];
if (output.startsWith(`${root}/`) || cloudMarkers.some((marker) => output.includes(marker))) STOP("STOP_S2_T313_KEY_DESTINATION_UNSAFE");

await mkdir(dirname(output), { recursive: true, mode: 0o700 });
const parentMode = (await stat(dirname(output))).mode & 0o777;
if ((parentMode & 0o077) !== 0) STOP("STOP_S2_T313_KEY_DIRECTORY_NOT_OWNER_ONLY");

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const privatePem = privateKey.export({ type: "pkcs8", format: "pem" });
const publicPem = publicKey.export({ type: "spki", format: "pem" });
const privateHandle = await open(output, "wx", 0o600).catch(() => STOP("STOP_S2_T313_KEY_ALREADY_EXISTS"));
try { await privateHandle.writeFile(privatePem); } finally { await privateHandle.close(); }
const publicPath = `${output}.public.pem`;
const publicHandle = await open(publicPath, "wx", 0o600).catch(() => STOP("STOP_S2_T313_PUBLIC_KEY_ALREADY_EXISTS"));
try { await publicHandle.writeFile(publicPem); } finally { await publicHandle.close(); }
const fingerprint = createHash("sha256").update(publicKey.export({ type: "spki", format: "der" })).digest("hex");
process.stdout.write(`${JSON.stringify({ issuer: "Lumis Founder Deployment Approver", trust_anchor_owner: "Founder", issuer_key_id: args["issuer-key-id"], issuer_public_key_spki_sha256: fingerprint, public_key_path: publicPath })}\n`);
