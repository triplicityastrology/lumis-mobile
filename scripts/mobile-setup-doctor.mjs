import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import os from "node:os";

const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
const mobilePackage = JSON.parse(await readFile("apps/mobile/package.json", "utf8"));
const installedExpo = JSON.parse(await readFile("apps/mobile/node_modules/expo/package.json", "utf8"));
const mobileEnvironment = parseEnvironment(await readFile("apps/mobile/.env", "utf8"));
const issues = [];

check(process.versions.node.split(".")[0] === "22", `Node 22 is required; found ${process.versions.node}.`);
check(rootPackage.packageManager === "pnpm@9.15.0", "Root packageManager must remain pnpm@9.15.0.");
check(mobilePackage.dependencies.expo === "^54.0.36", "Mobile Expo dependency is not the approved SDK 54 version.");
check(mobilePackage.dependencies["react-native"] === "0.81.5", "React Native is not the approved SDK 54 version.");
check(mobilePackage.dependencies.react === "19.1.0", "React is not the approved SDK 54 version.");
check(installedExpo.version.startsWith("54."), `Installed Expo must be SDK 54; found ${installedExpo.version}.`);
check(
  mobileEnvironment.EXPO_PUBLIC_SUPABASE_URL === "https://bmqhwofmdgebpcihjlnb.supabase.co",
  "apps/mobile/.env does not target the Lumis staging Supabase project."
);
check(
  mobileEnvironment.EXPO_PUBLIC_SUPABASE_KEY?.startsWith("sb_publishable_"),
  "apps/mobile/.env is missing the staging publishable key."
);
check(
  mobileEnvironment.EXPO_PUBLIC_DICE_RITUAL === "1",
  "EXPO_PUBLIC_DICE_RITUAL must be 1 for the current device-test build."
);

for (const forbiddenName of [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_PASSWORD",
  "CHART_WORKER_SIGNING_SECRET",
  "ASTRO_API_KEY"
]) {
  check(!mobileEnvironment[forbiddenName], `${forbiddenName} must not be present in apps/mobile/.env.`);
}

for (const [name, value] of Object.entries(mobileEnvironment)) {
  check(!String(value).startsWith("sb_secret_"), `${name} contains a backend-only Supabase secret key.`);
  check(!String(value).startsWith("sbp_"), `${name} contains a Supabase personal access token.`);
}

assert.equal(
  issues.length,
  0,
  `Lumis mobile setup needs attention:\n${issues.map((issue) => `- ${issue}`).join("\n")}`
);

const addresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((entry) => entry?.family === "IPv4" && !entry.internal)
  .map((entry) => entry.address);

console.log("Lumis mobile setup is ready.");
console.log(`Node ${process.versions.node}; Expo ${installedExpo.version}; React Native ${mobilePackage.dependencies["react-native"]}.`);
console.log(`LAN address${addresses.length === 1 ? "" : "es"}: ${addresses.join(", ") || "none detected"}.`);
console.log("Start iPhone testing with: pnpm --dir apps/mobile exec expo start --lan --port 8081 --clear");
console.log("If office Wi-Fi blocks LAN traffic, replace --lan with --tunnel.");

function parseEnvironment(content) {
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      })
  );
}

function check(condition, message) {
  if (!condition) issues.push(message);
}
