import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { validateMobileModuleSpecifiers } from "./lib/mobile-native-import-resolution.mjs";

const EXPECTED_ROOT = "/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work";
const EXPECTED_REF = "bmqhwofmdgebpcihjlnb";
const EXPECTED_ORIGIN = "https://bmqhwofmdgebpcihjlnb.supabase.co";
const VISUAL_COMMITS = ["a52586a", "df90ce0", "fe35650"];
const PORT = process.env.LUMIS_EXPO_PORT ?? "8081";

try {
  stopUnless(process.cwd() === EXPECTED_ROOT, "WORKTREE_MISMATCH");
  stopUnless(PORT === "8081" || PORT === "8082", "PORT_INVALID");
  const head = git("rev-parse", "HEAD");
  stopUnless(/^[0-9a-f]{40}$/u.test(head), "HEAD_INVALID");
  stopUnless(git("status", "--porcelain", "--untracked-files=no") === "", "TREE_DIRTY");
  for (const commit of VISUAL_COMMITS) {
    stopUnless(spawnSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"]).status === 0, "VISUAL_ANCESTRY_MISSING");
  }
  const mobileRoot = path.join(EXPECTED_ROOT, "apps/mobile");
  stopUnless(validateMobileModuleSpecifiers({ source: collectMobileSource(mobileRoot), mobileRoot }).ok, "NATIVE_MODULE_UNRESOLVED");
  const app = readFileSync(path.join(mobileRoot, "App.tsx"), "utf8");
  const hub = readFileSync(path.join(mobileRoot, "src/dev/FounderTestHub.tsx"), "utf8");
  for (const marker of ["buildStatus", "persona", "careCircle", "reflectionDeletion", "profileTest"]) {
    stopUnless(app.includes(`founderTestRoute === "${marker}"`), "FOUNDER_ROUTE_MISSING");
  }
  stopUnless(hub.includes("Founder Test Hub") && hub.includes("Care Circle"), "FOUNDER_ROUTE_MISSING");
  const environment = parseEnvironment(readFileSync(path.join(mobileRoot, ".env"), "utf8"));
  stopUnless(environment.SUPABASE_PROJECT_REF === EXPECTED_REF, "PUBLIC_CONFIG_MISMATCH");
  stopUnless(environment.EXPO_PUBLIC_SUPABASE_URL === EXPECTED_ORIGIN, "PUBLIC_CONFIG_MISMATCH");
  const key = environment.EXPO_PUBLIC_SUPABASE_KEY ?? "";
  stopUnless((key.startsWith("sb_publishable_") || key.split(".").length === 3) && !/sb_secret_|service_role|sbp_/iu.test(key), "PUBLIC_CONFIG_UNSAFE");

  const metro = inspectMetro(PORT, head);
  const careCircle = validateReceipt() ? "live_ready_receipt_verified" : "local_rehearsal_available";
  const nextAction = metro === "stopped"
    ? "pnpm start:normal-expo"
    : metro === "current"
      ? "Open Founder Tests in the connected Expo Go bundle"
      : "Stop the owning Metro terminal yourself, then run pnpm start:normal-expo";
  process.stdout.write([
    "FOUNDER_MOBILE_DOCTOR_PASS",
    `source_commit=${head}`,
    "tracked_tree=clean",
    "visual_ancestry=verified",
    "native_modules=resolved",
    "founder_routes=present",
    "public_staging_config=classified",
    `metro=${metro}`,
    `care_circle=${careCircle}`,
    `next_action=${nextAction}`,
  ].join("\n") + "\n");
} catch (error) {
  const code = error instanceof Error && /^STOP_S2_T129_[A-Z0-9_]+$/u.test(error.message)
    ? error.message : "STOP_S2_T129_UNSAFE_FAILURE";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}

function collectMobileSource(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist-qa" || entry.name === ".tmp") continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (/\.(?:ts|tsx|js|jsx)$/u.test(entry.name)) files.push(target);
    }
  };
  visit(root);
  return files.sort().map((file) => readFileSync(file, "utf8")).join("\n");
}

function inspectMetro(port, head) {
  const result = spawnSync("lsof", [`-tiTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" });
  if (result.status !== 0 || result.stdout.trim() === "") return "stopped";
  const pids = result.stdout.trim().split(/\s+/u);
  if (pids.length !== 1) return "restart_required";
  const cwdResult = spawnSync("lsof", ["-a", "-p", pids[0], "-d", "cwd", "-Fn"], { encoding: "utf8" });
  const cwd = cwdResult.stdout.split("\n").find((line) => line.startsWith("n"))?.slice(1);
  if (cwd !== EXPECTED_ROOT && cwd !== path.join(EXPECTED_ROOT, "apps/mobile")) return "another_project";
  const markerPath = path.join(EXPECTED_ROOT, ".lumis-local/normal-expo-session.json");
  if (!existsSync(markerPath)) return "restart_required";
  try {
    const marker = JSON.parse(readFileSync(markerPath, "utf8"));
    return marker.source_commit === head && marker.port === Number(port) ? "current" : "restart_required";
  } catch {
    return "restart_required";
  }
}

function validateReceipt() {
  const receipt = path.join(EXPECTED_ROOT, ".lumis-local/care-circle-founder-receipt.json");
  if (!existsSync(receipt)) return false;
  return spawnSync(process.execPath, ["scripts/s2-care-circle-founder-receipt.mjs", "--validate", receipt], {
    cwd: EXPECTED_ROOT, stdio: "ignore",
  }).status === 0;
}

function parseEnvironment(content) {
  return Object.fromEntries(content.split(/\r?\n/u).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
    const separator = line.indexOf("=");
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}
function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}
function stopUnless(condition, code) {
  if (!condition) throw new Error(`STOP_S2_T129_${code}`);
}
