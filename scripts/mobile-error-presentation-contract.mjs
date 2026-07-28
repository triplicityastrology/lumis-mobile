import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  app: await readFile("apps/mobile/App.tsx", "utf8"),
  auth: await readFile("apps/mobile/src/services/auth.ts", "utf8"),
  authScreen: await readFile("apps/mobile/src/screens/LumisAuthScreen.tsx", "utf8"),
  authSystemKit: await readFile("apps/mobile/src/components/AuthSystemKit.tsx", "utf8"),
  chat: await readFile("apps/mobile/src/services/chat.ts", "utf8"),
  dice: await readFile("apps/mobile/src/services/diceThrows.ts", "utf8"),
  errors: await readFile("apps/mobile/src/services/userFacingErrors.ts", "utf8"),
  profile: await readFile("apps/mobile/src/services/profile.ts", "utf8")
};

for (const surface of [
  "auth_send",
  "auth_restore",
  "auth_logout",
  "chart_create",
  "persona_save",
  "chat_send",
  "dice_save"
]) {
  assert.match(
    files.errors,
    new RegExp(`${surface}:`),
    `${surface} must have a specific safe failure message`
  );
}

assert.doesNotMatch(
  files.errors,
  /return\s+(?:error|caught)\.message/,
  "the central presentation boundary cannot return an untrusted Error.message"
);
assert.match(files.errors, /classification === "rate_limited"/);
assert.match(files.errors, /classification === "invalid_link"/);
assert.match(files.errors, /classification === "network"/);

for (const [name, source] of [
  ["App", files.app],
  ["Auth screen", files.authScreen],
  ["Auth system kit", files.authSystemKit]
]) {
  assert.doesNotMatch(
    source,
    /instanceof Error\s*\?\s*[A-Za-z_$][\w$]*\.message/,
    `${name} cannot render an arbitrary caught Error.message`
  );
}

for (const context of [
  "auth_send",
  "auth_restore",
  "auth_logout",
  "chart_create",
  "persona_save",
  "chat_send"
]) {
  assert.match(
    `${files.app}\n${files.authScreen}\n${files.authSystemKit}`,
    new RegExp(`safeUserErrorMessage\\([^\\n]+, "${context}"\\)`),
    `${context} must cross the safe presentation boundary`
  );
}

assert.doesNotMatch(
  files.auth,
  /function formatAuthErrorMessage[\s\S]*?return message;/,
  "unknown Supabase Auth text cannot be returned to the user"
);
assert.doesNotMatch(files.chat, /throw new Error\(error\.message\)/);
assert.doesNotMatch(files.dice, /message:\s*error\.message/);
assert.doesNotMatch(files.profile, /data\.error\?\.message/);
assert.match(files.profile, /safeBirthDetailsChangeMessage\(data\.error\?\.code\)/);
for (const code of ["49001", "49002", "PROFILE_AUTH_REQUIRED", "PROFILE_CONFIGURATION_REQUIRED"]) {
  assert.match(files.profile, new RegExp(`code === "${code}"`));
}

for (const forbidden of [
  "Edge Function returned a non-2xx status code",
  "TypeError: Network request failed",
  "Failed to fetch"
]) {
  for (const [name, source] of Object.entries(files)) {
    assert.doesNotMatch(
      source,
      new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `${name} cannot contain a raw technical failure string`
    );
  }
}

console.log("mobile technical-error presentation contract checks passed");
