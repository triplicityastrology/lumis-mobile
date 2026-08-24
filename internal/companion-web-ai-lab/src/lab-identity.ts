// Executable-identity authorization for the Founder-only free-text Companion Lab.
//
// Scope: FOUNDER_INTERNAL_CHAT_LAB_FREE_TEXT_STAGING. This is NOT a per-question or 900-second usage
// window. It binds the *running executable identity*: the final commit, the final Git tree, a
// source-complete package checksum, the Founder-only reviewer, the staging environment, the fixed
// prompt/system version, the Azure deployment identity, and the immediate disable control.
//
// The immutable identity receipt is generated AFTER the final commit exists (avoiding commit
// self-reference). At runtime the server verifies the receipt's commit/tree/package against the
// CLEAN runtime worktree BEFORE any Azure key or client is accessed.

import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  CHAT_AZURE_DEPLOYMENT, CHAT_AZURE_MODEL, CHAT_AZURE_MODEL_VERSION, CHAT_AZURE_APPROVED_HOSTNAME,
} from "./lab-constants.ts";
import { COMPANION_SYNTHETIC_PROMPT_VERSION } from "../../../supabase/functions/_shared/companion-synthetic-prompt-v1.ts";
import { PERSONA_PROMPT_PIPELINE_VERSION } from "../../../supabase/functions/_shared/persona-prompt-pipeline-v1.ts";
import { COMPANION_VOICE_NATURALNESS_VERSION } from "../../../supabase/functions/_shared/companion-voice-and-naturalness-v1.ts";
import { COMPANION_SYNTHESIS_VERSION } from "../../../supabase/functions/_shared/companion-synthesis-v1.ts";
import { resolveProviderRuntime, type ProviderRuntime } from "./lab-provider.ts";

export const LAB_SCOPE = "FOUNDER_INTERNAL_CHAT_LAB_FREE_TEXT_STAGING" as const;
export const LAB_REVIEWER = "founder" as const;
export const LAB_ENVIRONMENT = "staging" as const;
export const LAB_DISABLE_CONTROL = "LUMIS_AI_ENABLED" as const;
export const LAB_PROMPT_VERSION = `${COMPANION_SYNTHETIC_PROMPT_VERSION}+persona_${PERSONA_PROMPT_PIPELINE_VERSION}+voice_${COMPANION_VOICE_NATURALNESS_VERSION}+arch_${COMPANION_SYNTHESIS_VERSION}` as const;
export const IDENTITY_RECEIPT_SCHEMA = "lumis_companion_web_ai_lab_executable_identity_receipt_v1" as const;
export const LAB_SOURCE_GLOB = "internal/companion-web-ai-lab" as const;

export function worktreeRoot(): string {
  return (process.env.LAB_WORKTREE_ROOT ?? "").trim() || process.cwd();
}

// Argument-safe git: fixed argv arrays via execFileSync (no shell, no string interpolation), so a
// crafted root/glob can never be interpreted as shell. Never logs argv or output.
function git(root: string, argv: readonly string[]): string {
  try { return execFileSync("git", [...argv], { cwd: root, encoding: "utf8" }).trim(); }
  catch { throw new Error("LAB_IDENTITY_GIT_UNAVAILABLE"); }
}

// Source-complete package checksum over the Lab's tracked source (excludes .tmp / node_modules /
// the untracked identity receipt by construction, since it hashes only tracked files).
export function computePackageChecksum(root: string = worktreeRoot()): string {
  const listing = git(root, ["ls-files", "--", LAB_SOURCE_GLOB]);
  const files = listing.split("\n").map((f) => f.trim()).filter(Boolean).sort();
  const manifest = files.map((rel) => ({ path: rel, sha256: createHash("sha256").update(readFileSync(`${root}/${rel}`, "utf8")).digest("hex") }));
  return createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
}

export type RuntimeIdentity = { commit: string; tree: string; clean: boolean; packageChecksum: string };
export function runtimeIdentity(root: string = worktreeRoot()): RuntimeIdentity {
  return {
    commit: git(root, ["rev-parse", "HEAD"]),
    tree: git(root, ["rev-parse", "HEAD^{tree}"]),
    clean: git(root, ["status", "--porcelain"]) === "",
    packageChecksum: computePackageChecksum(root),
  };
}

export type IdentityBindings = {
  schema: typeof IDENTITY_RECEIPT_SCHEMA;
  scope: string; reviewer: string; environment: string;
  prompt_version: string; azure_deployment: string; azure_model: string; azure_hostname: string;
  disable_control: string;
};

export function identityBindings(): IdentityBindings {
  return {
    schema: IDENTITY_RECEIPT_SCHEMA,
    scope: LAB_SCOPE, reviewer: LAB_REVIEWER, environment: LAB_ENVIRONMENT,
    prompt_version: LAB_PROMPT_VERSION,
    azure_deployment: CHAT_AZURE_DEPLOYMENT, azure_model: `${CHAT_AZURE_MODEL}@${CHAT_AZURE_MODEL_VERSION}`, azure_hostname: CHAT_AZURE_APPROVED_HOSTNAME,
    disable_control: LAB_DISABLE_CONTROL,
  };
}

export type IdentityReceipt = IdentityBindings & {
  final_commit: string; final_tree: string; package_checksum: string; generated_at: string; receipt_checksum: string;
};

const RECEIPT_KEYS = [
  "schema", "scope", "reviewer", "environment", "prompt_version", "azure_deployment", "azure_model",
  "azure_hostname", "disable_control", "final_commit", "final_tree", "package_checksum", "generated_at", "receipt_checksum",
];

function canonicalReceiptBody(r: Record<string, unknown>): string {
  const b = identityBindings();
  return JSON.stringify({
    schema: r.schema, scope: r.scope, reviewer: r.reviewer, environment: r.environment,
    prompt_version: r.prompt_version, azure_deployment: r.azure_deployment, azure_model: r.azure_model,
    azure_hostname: r.azure_hostname, disable_control: r.disable_control,
    final_commit: r.final_commit, final_tree: r.final_tree, package_checksum: r.package_checksum, generated_at: r.generated_at,
    _bindings_note: b.schema, // stable
  });
}
export function computeReceiptChecksum(r: Record<string, unknown>): string {
  return createHash("sha256").update(canonicalReceiptBody(r)).digest("hex");
}

// Generate the immutable identity receipt from the CURRENT clean runtime (post-final-commit).
// OPERATOR / GENERATOR ONLY — the server never mints; it only loads and verifies.
// `runtimeOverride` is for tests only (mint against a known identity without a real clean commit).
export function mintIdentityReceipt(runtimeOverride?: RuntimeIdentity): IdentityReceipt {
  const id = runtimeOverride ?? runtimeIdentity();
  if (!id.clean) throw new Error("LAB_IDENTITY_WORKTREE_DIRTY");
  const body = { ...identityBindings(), final_commit: id.commit, final_tree: id.tree, package_checksum: id.packageChecksum, generated_at: new Date().toISOString() };
  return { ...body, receipt_checksum: computeReceiptChecksum(body) };
}

export type VerifiedIdentity = { commit: string; tree: string; packageChecksum: string };

// Verify a receipt object against the fixed bindings and the CLEAN runtime worktree. Throws a
// stable code on any mismatch. Never accesses Azure. `runtimeOverride` is for tests only.
export function verifyIdentityReceipt(obj: unknown, runtimeOverride?: RuntimeIdentity): VerifiedIdentity {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("LAB_IDENTITY_RECEIPT_INVALID");
  const r = obj as Record<string, unknown>;
  const keys = Object.keys(r);
  if (keys.length !== RECEIPT_KEYS.length || keys.some((k) => !RECEIPT_KEYS.includes(k))) throw new Error("LAB_IDENTITY_RECEIPT_INVALID");
  if (typeof r.receipt_checksum !== "string" || computeReceiptChecksum(r) !== r.receipt_checksum) throw new Error("LAB_IDENTITY_RECEIPT_CHECKSUM_MISMATCH");
  const b = identityBindings();
  if (r.schema !== b.schema || r.scope !== b.scope || r.reviewer !== b.reviewer || r.environment !== b.environment ||
      r.prompt_version !== b.prompt_version || r.azure_deployment !== b.azure_deployment || r.azure_model !== b.azure_model ||
      r.azure_hostname !== b.azure_hostname || r.disable_control !== b.disable_control) {
    throw new Error("LAB_IDENTITY_RECEIPT_BINDING_MISMATCH");
  }
  const runtime = runtimeOverride ?? runtimeIdentity();
  if (!runtime.clean) throw new Error("LAB_IDENTITY_WORKTREE_DIRTY");
  if (r.final_commit !== runtime.commit) throw new Error("LAB_IDENTITY_COMMIT_MISMATCH");
  if (r.final_tree !== runtime.tree) throw new Error("LAB_IDENTITY_TREE_MISMATCH");
  if (r.package_checksum !== runtime.packageChecksum) throw new Error("LAB_IDENTITY_PACKAGE_MISMATCH");
  return { commit: runtime.commit, tree: runtime.tree, packageChecksum: runtime.packageChecksum };
}

export function identityReceiptPath(): string {
  return (process.env.LAB_IDENTITY_RECEIPT_PATH ?? "").trim();
}

export function loadAndVerifyIdentity(runtimeOverride?: RuntimeIdentity): VerifiedIdentity {
  const p = identityReceiptPath();
  if (!p || !existsSync(p)) throw new Error("LAB_IDENTITY_RECEIPT_MISSING");
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(p, "utf8")); }
  catch { throw new Error("LAB_IDENTITY_RECEIPT_INVALID"); }
  return verifyIdentityReceipt(parsed, runtimeOverride);
}

// Immediate kill switch: LUMIS_AI_ENABLED=false stops all provider access.
export function killSwitchEngaged(env: Readonly<Record<string, string | undefined>>): boolean {
  return env[LAB_DISABLE_CONTROL] === "false";
}

export type ProviderAuthorization =
  | { ok: true; runtime: Extract<ProviderRuntime, { aiEnabled: true }>; identity: VerifiedIdentity }
  | { ok: false; code: string };

// The single gate for ANY provider access (free-text conversation OR regression). Order matters:
// kill switch -> executable identity (before Azure key) -> existing server-side Azure config.
// `opts.verifyIdentity` is injectable for tests only; the server always uses the real git check.
export function authorizeProvider(
  env: Readonly<Record<string, string | undefined>>,
  fetchImpl: typeof fetch = fetch,
  nowMs: () => number = Date.now,
  opts: { verifyIdentity?: () => VerifiedIdentity } = {},
): ProviderAuthorization {
  if (killSwitchEngaged(env)) return { ok: false, code: "LAB_AI_KILL_SWITCH" };
  const verify = opts.verifyIdentity ?? (() => loadAndVerifyIdentity());
  let identity: VerifiedIdentity;
  try { identity = verify(); }
  catch (e) { return { ok: false, code: (e as Error).message }; }
  const runtime = resolveProviderRuntime(env, fetchImpl, nowMs);
  if (!runtime.aiEnabled) return { ok: false, code: runtime.code };
  return { ok: true, runtime, identity };
}

// Content-free identity status for the UI/operators (no secrets).
export function identityStatus() {
  const receiptPresent = Boolean(identityReceiptPath()) && existsSync(identityReceiptPath());
  let verified = false;
  let reason: string | null = "LAB_IDENTITY_NOT_VERIFIED";
  let runtime: RuntimeIdentity | null = null;
  try { runtime = runtimeIdentity(); } catch { runtime = null; }
  try { loadAndVerifyIdentity(); verified = true; reason = null; }
  catch (e) { reason = (e as Error).message; }
  return {
    scope: LAB_SCOPE, reviewer: LAB_REVIEWER, environment: LAB_ENVIRONMENT,
    prompt_version: LAB_PROMPT_VERSION, azure_deployment: CHAT_AZURE_DEPLOYMENT, disable_control: LAB_DISABLE_CONTROL,
    receipt_present: receiptPresent, identity_verified: verified, reason,
    runtime_commit: runtime ? runtime.commit : null, runtime_tree: runtime ? runtime.tree : null,
    runtime_clean: runtime ? runtime.clean : null, package_checksum: runtime ? runtime.packageChecksum : null,
  };
}
