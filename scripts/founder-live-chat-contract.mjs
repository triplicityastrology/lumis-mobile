import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = process.cwd();
const read = (path) => readFileSync(`${root}/${path}`, "utf8");
const app = read("apps/mobile/App.tsx");
const baseApp = execFileSync("git", ["show", "0bc9ababb5aac2a88573a617e3732ace227acd6d:apps/mobile/App.tsx"], { encoding: "utf8" });
const mobile = read("apps/mobile/src/services/founderLiveChat.ts");
const server = read("supabase/functions/_shared/founder-chat-window-v1.ts");
const control = JSON.parse(read("config/founder-live-chat-candidate.json"));
const evidencePath = "/Volumes/LumisDevSSD/Development/Evidence/S2-T345-Technical-80-Live/technical-80-metadata-receipt.json";
const evidenceSha = createHash("sha256").update(readFileSync(evidencePath)).digest("hex");

const chatPixels = (source) => source.slice(
  source.indexOf("  return (\n    <KeyboardAvoidingView", source.indexOf("function ChatShellScreen")),
  source.indexOf("function ReflectionHistoryScreen"),
);
assert.equal(chatPixels(app), chatPixels(baseApp), "signed Chat render pixels unchanged");
assert.match(app, /FOUNDER_LIVE_CHAT_INTEGRATION_ENABLED[\s\S]*sendFounderLiveChatProductMessage/);
assert.match(app, /FOUNDER_LIVE_CHAT_INTEGRATION_ENABLED\s*\? await sendFounderLiveChatProductMessage/);
assert.match(mobile, /typeof __DEV__ !== "undefined"/);
assert.match(mobile, /EXPO_PUBLIC_FOUNDER_CHAT_LIVE_MODE === "1"/);
assert.match(mobile, /EXPO_PUBLIC_FOUNDER_CHAT_DICE_EVIDENCE_SHA256/);
assert.match(mobile, /EXPO_PUBLIC_FOUNDER_CHAT_RUN_ID/);
assert.doesNotMatch(mobile, /chat-founder-/);
assert.match(mobile, /if \(!FOUNDER_LIVE_CHAT_INTEGRATION_ENABLED \|\| !FOUNDER_LIVE_CHAT_TRAFFIC_ENABLED\)/);
assert.ok(mobile.indexOf("FOUNDER_LIVE_CHAT_INTEGRATION_ENABLED") < mobile.indexOf("input.createTransport().invoke"));
assert.doesNotMatch(mobile, /gpt-5|services\.ai\.azure|AZURE_API_KEY|api-key/i);
assert.match(server, /FOUNDER_CHAT_SYNTHETIC_WINDOW_12_ONLY/);
const edge = read("supabase/functions/chat-synthetic/edge-handler-v1.ts");
const providerConstruction = edge.lastIndexOf("readChatAzureServerConfig");
assert.ok(edge.indexOf("LUMIS_CHAT_AI_ENABLED") < providerConstruction);
assert.ok(edge.indexOf("LUMIS_CHAT_TRAFFIC_AUTHORIZED") < providerConstruction);
assert.equal(evidenceSha, control.accepted_dice_technical_80_receipt_sha256);
assert.equal(control.authority.normal_chat, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(control.authority.azure_traffic, "NO_AZURE_TRAFFIC_AUTHORITY");
assert.equal(control.source_switches.mobile_integration_default, false);
assert.equal(control.source_switches.mobile_traffic_default, false);
assert.equal(control.source_switches.server_ai_default, false);
assert.equal(control.source_switches.server_traffic_default, false);
console.log("FOUNDER_LIVE_CHAT_CONTRACT_OK");
