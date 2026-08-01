import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("apps/mobile/App.tsx", "utf8");
const service = readFileSync("apps/mobile/src/services/reflections.ts", "utf8");
const migration = readFileSync("supabase/migrations/0036_owner_safe_reflection_deletion.sql", "utf8");

assert.match(app, /accessibilityLabel=\{`Delete reflection /);
assert.match(app, /Delete Past Reflection/);
assert.match(app, /deleteOwnedReflection/);
assert.match(app, /deletingReflectionId === thread\.id/);
assert.match(app, /setReflectionThreads\(\(threads\) => threads\.filter/);
assert.match(app, /saveDemoSession\(profileData, chartProfile, personaStyle, \[\], remainingCredits\)/);
assert.match(service, /delete_owned_reflection/);
assert.doesNotMatch(service, /error\.message|console\.|JSON\.stringify/);
assert.match(migration, /where id = p_thread_id\s+and user_id = v_user_id/);
assert.match(migration, /references public\.chat_threads\(id\) on delete cascade|delete from public\.chat_threads/);
assert.match(migration, /primary key \(user_id, client_request_id\)/);
assert.match(migration, /REFLECTION_REQUEST_CONFLICT/);
assert.match(migration, /revoke all on table public\.reflection_deletion_requests from anon, authenticated/);

process.stdout.write("owner-safe Past Reflections deletion contract passed\n");
