import assert from "node:assert/strict";
import { PROFILE_TEST_FUNCTION_SHA256, resolveProfileFounderTestBoundary } from "./profileFounderTestBoundary";

const valid = {
  enabledFlag: "1",
  deploymentReady: "1",
  functionSha256: PROFILE_TEST_FUNCTION_SHA256,
  functionVersion: "12",
  isDevelopment: true,
  projectRef: "bmqhwofmdgebpcihjlnb",
  supabaseUrl: "https://bmqhwofmdgebpcihjlnb.supabase.co/",
};

assert.deepEqual(resolveProfileFounderTestBoundary(valid), { enabled: true, functionVersion: 12 });
assert.equal(resolveProfileFounderTestBoundary({ ...valid, isDevelopment: false }).enabled, false);
assert.equal(resolveProfileFounderTestBoundary({ ...valid, projectRef: "other" }).enabled, false);
assert.equal(resolveProfileFounderTestBoundary({ ...valid, supabaseUrl: "http://bmqhwofmdgebpcihjlnb.supabase.co/" }).enabled, false);
assert.equal(resolveProfileFounderTestBoundary({ ...valid, supabaseUrl: "https://example.test/" }).enabled, false);
assert.equal(resolveProfileFounderTestBoundary({ ...valid, deploymentReady: "0" }).enabled, false);
assert.equal(resolveProfileFounderTestBoundary({ ...valid, functionSha256: "0".repeat(64) }).enabled, false);
assert.equal(resolveProfileFounderTestBoundary({ ...valid, functionVersion: "unknown" }).enabled, false);

console.log("Profile Founder test boundary fixtures passed");
