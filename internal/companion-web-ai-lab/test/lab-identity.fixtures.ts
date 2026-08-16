// Executable-identity authorization tests.
// Run: tsc -p internal/companion-web-ai-lab/tsconfig.json && node <emitted>/test/lab-identity.fixtures.js
//
// Proves: the receipt binds commit/tree/package + the fixed bindings; a WRONG commit / tree /
// package / binding fails BEFORE any Azure access (zero fetch); LUMIS_AI_ENABLED=false is an
// immediate kill switch that short-circuits before identity or Azure; and the whole check never
// contacts a provider. Uses runtime overrides so no real clean commit is needed in a dirty worktree.

import test from "node:test";
import { strict as assert } from "node:assert";
import {
  mintIdentityReceipt, verifyIdentityReceipt, computeReceiptChecksum, identityBindings,
  authorizeProvider, killSwitchEngaged, runtimeIdentity, type RuntimeIdentity,
} from "../src/lab-identity.ts";
import { existsSync } from "node:fs";

// Local throws-with-code helper: the repo's node:assert shim types `throws` with a string matcher
// only, so we assert the thrown Error's message directly.
function throwsCode(fn: () => unknown, code: string) {
  let threw: Error | null = null;
  try { fn(); } catch (e) { threw = e as Error; }
  assert.ok(threw, `expected throw ${code}`);
  assert.ok(threw!.message.includes(code), `expected ${code}, got ${threw!.message}`);
}

const SECRET = "SECRET_SENTINEL_KEY_DO_NOT_LEAK";
const enabledEnv = { LUMIS_CHAT_AI_ENABLED: "true", LUMIS_CHAT_AZURE_API_KEY: SECRET };
const CLEAN: RuntimeIdentity = { commit: "c0ffee".padEnd(40, "0"), tree: "tree01".padEnd(40, "0"), clean: true, packageChecksum: "pkg-checksum-abc" };

function spyFetch() {
  const calls: string[] = [];
  const fn = (async (url: unknown) => { calls.push(String(url)); return new Response(JSON.stringify({ output_text: "x" }), { status: 200 }); }) as unknown as typeof fetch;
  return { fn, calls };
}

test("a receipt minted from a clean runtime verifies against the same runtime", () => {
  const receipt = mintIdentityReceipt(CLEAN);
  const verified = verifyIdentityReceipt(receipt, CLEAN);
  assert.equal(verified.commit, CLEAN.commit);
  assert.equal(verified.tree, CLEAN.tree);
  assert.equal(verified.packageChecksum, CLEAN.packageChecksum);
  // The receipt carries the fixed bindings (scope/reviewer/environment/prompt/azure/disable).
  const b = identityBindings();
  assert.equal(receipt.scope, b.scope);
  assert.equal(receipt.reviewer, "founder");
  assert.equal(receipt.environment, "staging");
  assert.equal(receipt.disable_control, "LUMIS_AI_ENABLED");
  assert.equal(receipt.azure_hostname, b.azure_hostname);
});

test("minting refuses a dirty worktree", () => {
  throwsCode(() => mintIdentityReceipt({ ...CLEAN, clean: false }), "LAB_IDENTITY_WORKTREE_DIRTY");
});

test("wrong commit / tree / package each fail verification", () => {
  const receipt = mintIdentityReceipt(CLEAN);
  throwsCode(() => verifyIdentityReceipt(receipt, { ...CLEAN, commit: "deadbeef".padEnd(40, "1") }), "LAB_IDENTITY_COMMIT_MISMATCH");
  throwsCode(() => verifyIdentityReceipt(receipt, { ...CLEAN, tree: "deadbeef".padEnd(40, "2") }), "LAB_IDENTITY_TREE_MISMATCH");
  throwsCode(() => verifyIdentityReceipt(receipt, { ...CLEAN, packageChecksum: "different" }), "LAB_IDENTITY_PACKAGE_MISMATCH");
  throwsCode(() => verifyIdentityReceipt(receipt, { ...CLEAN, clean: false }), "LAB_IDENTITY_WORKTREE_DIRTY");
});

test("a tampered checksum fails; a re-checksummed tampered binding fails on bindings", () => {
  const receipt = mintIdentityReceipt(CLEAN) as unknown as Record<string, unknown>;
  // (a) tamper a field but keep the old checksum -> checksum mismatch.
  const t1 = { ...receipt, scope: "SOME_OTHER_SCOPE" };
  throwsCode(() => verifyIdentityReceipt(t1, CLEAN), "LAB_IDENTITY_RECEIPT_CHECKSUM_MISMATCH");
  // (b) tamper the scope AND recompute the checksum -> passes checksum, fails fixed-binding check.
  const t2: Record<string, unknown> = { ...receipt, scope: "SOME_OTHER_SCOPE" };
  t2.receipt_checksum = computeReceiptChecksum(t2);
  throwsCode(() => verifyIdentityReceipt(t2, CLEAN), "LAB_IDENTITY_RECEIPT_BINDING_MISMATCH");
});

test("structurally invalid receipts are rejected", () => {
  for (const bad of [null, 42, [], {}, { schema: "x" }]) {
    throwsCode(() => verifyIdentityReceipt(bad, CLEAN), "LAB_IDENTITY_RECEIPT_INVALID");
  }
  const receipt = mintIdentityReceipt(CLEAN) as unknown as Record<string, unknown>;
  throwsCode(() => verifyIdentityReceipt({ ...receipt, extra_field: 1 }, CLEAN), "LAB_IDENTITY_RECEIPT_INVALID");
});

test("authorizeProvider: verified identity + enabled env authorizes, and constructs the adapter WITHOUT any Azure call", () => {
  const spy = spyFetch();
  const auth = authorizeProvider(enabledEnv, spy.fn, Date.now, { verifyIdentity: () => verifyIdentityReceipt(mintIdentityReceipt(CLEAN), CLEAN) });
  assert.equal(auth.ok, true);
  assert.equal(spy.calls.length, 0, "authorization never contacts Azure");
});

test("wrong identity fails BEFORE Azure access (zero fetch), even with a key present", () => {
  const spy = spyFetch();
  const auth = authorizeProvider(enabledEnv, spy.fn, Date.now, { verifyIdentity: () => { throw new Error("LAB_IDENTITY_COMMIT_MISMATCH"); } });
  assert.equal(auth.ok, false);
  if (!auth.ok) assert.equal(auth.code, "LAB_IDENTITY_COMMIT_MISMATCH");
  assert.equal(spy.calls.length, 0, "no Azure access when identity fails");
});

test("LUMIS_AI_ENABLED=false is an immediate kill switch: identity is never even consulted, zero fetch", () => {
  const spy = spyFetch();
  let identityConsulted = false;
  const env = { ...enabledEnv, LUMIS_AI_ENABLED: "false" };
  assert.equal(killSwitchEngaged(env), true);
  const auth = authorizeProvider(env, spy.fn, Date.now, { verifyIdentity: () => { identityConsulted = true; return verifyIdentityReceipt(mintIdentityReceipt(CLEAN), CLEAN); } });
  assert.equal(auth.ok, false);
  if (!auth.ok) assert.equal(auth.code, "LAB_AI_KILL_SWITCH");
  assert.equal(identityConsulted, false, "kill switch short-circuits before identity");
  assert.equal(spy.calls.length, 0);
});

test("kill switch is engaged ONLY by the exact string 'false'", () => {
  assert.equal(killSwitchEngaged({ LUMIS_AI_ENABLED: "false" }), true);
  assert.equal(killSwitchEngaged({ LUMIS_AI_ENABLED: "true" }), false);
  assert.equal(killSwitchEngaged({ LUMIS_AI_ENABLED: "0" }), false);
  assert.equal(killSwitchEngaged({}), false);
});

test("the receipt body never contains the Azure key", () => {
  const receipt = mintIdentityReceipt(CLEAN);
  assert.equal(JSON.stringify(receipt).includes(SECRET), false);
});

// --- Fixed-argv git execution (finding 1): execFileSync with fixed argv, never a shell string ---
test("runtimeIdentity runs git via fixed argv and returns valid 40-hex commit/tree", () => {
  const id = runtimeIdentity(); // real worktree; proves execFileSync('git', [..fixed..]) works
  assert.ok(/^[0-9a-f]{40}$/.test(id.commit), `commit hex: ${id.commit}`);
  assert.ok(/^[0-9a-f]{40}$/.test(id.tree), `tree hex: ${id.tree}`);
  assert.ok(/^[0-9a-f]{64}$/.test(id.packageChecksum), `pkg hex: ${id.packageChecksum}`);
});

test("a shell-metacharacter worktree root is never shell-interpreted (no injection)", () => {
  const marker = `/tmp/lab-git-injection-${process.pid}`;
  // With execFileSync (no shell) this cwd simply does not exist -> clean GIT_UNAVAILABLE. The ';'
  // and 'touch' are never interpreted, so the sentinel file must NOT be created.
  const maliciousRoot = `${marker}; touch ${marker}.pwned`;
  let threw: Error | null = null;
  try { runtimeIdentity(maliciousRoot); } catch (e) { threw = e as Error; }
  assert.ok(threw, "expected a thrown error for a non-existent/hostile root");
  assert.ok(threw!.message.includes("LAB_IDENTITY_GIT_UNAVAILABLE"), threw!.message);
  assert.equal(existsSync(`${marker}.pwned`), false, "no shell side-effect (argv is not a shell string)");
});
