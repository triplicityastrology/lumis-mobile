import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/0035_app_language_preference.sql", "utf8");
const initialMigration = readFileSync("supabase/migrations/0001_initial_schema.sql", "utf8");
const personaPolicyMigration = readFileSync(
  "supabase/migrations/0017_persona_policy_and_entitlement_events.sql",
  "utf8"
);
const accountState = readFileSync("apps/mobile/src/services/accountState.ts", "utf8");
const mobileChat = readFileSync("apps/mobile/src/services/chat.ts", "utf8");
const mobileApp = readFileSync("apps/mobile/App.tsx", "utf8");
const edgeChat = readFileSync("supabase/functions/chat-message/index.ts", "utf8");
const sharedLanguage = readFileSync("packages/shared/src/config/app-language.ts", "utf8");
const sharedRouter = readFileSync("packages/shared/src/config/chat-router.ts", "utf8");

assert.match(sharedLanguage, /APP_LANGUAGE_PREFERENCES = \["en", "zh-Hant"\] as const/);
assert.match(migration, /add constraint users_lang_allowed check \(lang in \('en', 'zh-Hant'\)\)/i);
assert.match(migration, /language_preference_set_at timestamptz/i);
assert.match(migration, /language_preference_set_at = null[\s\S]*where lang not in \('en', 'zh-Hant'\)/i);
assert.match(migration, /v_user_id uuid := auth\.uid\(\)/i);
assert.doesNotMatch(migration, /p_user_id/i);
assert.match(migration, /if v_user_id is null[\s\S]*LANGUAGE_PREFERENCE_AUTH_REQUIRED/i);
assert.match(migration, /where id = v_user_id[\s\S]*and deleted_at is null/i);
assert.match(
  initialMigration,
  /create policy "users can read own user row" on public\.users[\s\S]*for select using \(id = auth\.uid\(\)\)/i
);
assert.match(
  personaPolicyMigration,
  /drop policy if exists "users can update own user row" on public\.users/i,
  "language writes must use the narrow RPC rather than broad table updates"
);
assert.match(
  migration,
  /revoke all on function public\.update_app_language_preference\(text\)[\s\S]*from public, anon/i
);
assert.match(
  migration,
  /grant execute on function public\.update_app_language_preference\(text\)[\s\S]*to authenticated/i
);
assert.match(accountState, /buddy_avatar_key, lang, language_preference_set_at/);
assert.match(
  accountState,
  /user\.language_preference_set_at && isAppLanguagePreference\(user\.lang\) \? user\.lang : null/
);
assert.match(mobileApp, /setAppLanguagePreference\(accountState\.appLanguagePreference\)/);
assert.match(
  mobileChat,
  /getSolarReturnScopeResponse\(input\.message, input\.appLanguagePreference\)/
);
assert.match(mobileChat, /getSafetyResponse\(input\.message, input\.appLanguagePreference\)/);
assert.match(
  edgeChat,
  /\.from\("users"\)[\s\S]*\.select\("lang, language_preference_set_at"\)[\s\S]*\.eq\("id", userId\)/
);
assert.doesNotMatch(edgeChat, /app_language|language_preference\??:/i);
assert.match(edgeChat, /getSolarReturnScopeResponse\(message, appLanguagePreference\)/);
assert.match(edgeChat, /getSafetyResponse\(message, appLanguagePreference\)/);
assert.match(
  sharedLanguage,
  /isAppLanguagePreference\(preference\) \? preference : detectRequestLanguage\(message\)/
);
assert.match(
  sharedRouter,
  /SAFETY_RESPONSE_EN[\s\S]*SAFETY_RESPONSE_ZH_HANT[\s\S]*getSafetyResponse/
);
assert.doesNotMatch(
  `${sharedLanguage}\n${sharedRouter}\n${mobileChat}\n${edgeChat}`,
  /translate|translation|generateContent|chat\.completions|responses\.create/i
);

console.log("app language preference contract checks passed");
