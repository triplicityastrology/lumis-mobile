import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const edgeSource = readFileSync("supabase/functions/chat-message/index.ts", "utf8");
const migrationSource = readFileSync(
  "supabase/migrations/0009_chat_turn_persistence_rpc.sql",
  "utf8"
);

assert.match(
  migrationSource,
  /create or replace function public\.persist_scaffold_chat_turn/i,
  "chat persistence RPC must exist"
);
assert.match(
  migrationSource,
  /and is_active = true/i,
  "RPC must require the active profile"
);
assert.match(
  migrationSource,
  /insert into public\.chat_threads[\s\S]*insert into public\.chat_messages[\s\S]*insert into public\.chat_messages[\s\S]*update public\.chat_threads/i,
  "RPC must atomically create or update a thread, save both messages, and update the thread"
);
assert.match(
  migrationSource,
  /grant execute on function public\.persist_scaffold_chat_turn[\s\S]*to service_role/i,
  "RPC must be executable by service_role"
);
assert.match(
  migrationSource,
  /revoke all on function public\.persist_scaffold_chat_turn[\s\S]*from public/i,
  "RPC must not be publicly executable"
);

assert.match(
  edgeSource,
  /\.rpc\("persist_scaffold_chat_turn"/,
  "Edge Function must call the transactional RPC"
);
assert.doesNotMatch(
  edgeSource,
  /\.from\("chat_threads"\)\s*\.[\s\S]*(insert|update)/,
  "Edge Function must not directly write chat_threads"
);
assert.doesNotMatch(
  edgeSource,
  /\.from\("chat_messages"\)\s*\.[\s\S]*insert/,
  "Edge Function must not directly insert chat_messages"
);
assert.match(
  edgeSource,
  /\.eq\("is_active", true\)/,
  "Edge Function must query only the active profile"
);
assert.doesNotMatch(
  edgeSource,
  /fallback/i,
  "Edge Function must not contain inactive-profile fallback logic"
);
assert.match(
  edgeSource,
  /buildChartContextFromProfile/,
  "Edge Function must derive chart context from the active stored profile"
);
assert.match(
  edgeSource,
  /console\.error\("CHAT_PERSISTENCE_FAILED"/,
  "Detailed persistence failures should be logged backend-side"
);
assert.doesNotMatch(
  edgeSource,
  /error instanceof Error \? error\.message/,
  "Edge Function must not return raw database errors to mobile"
);

console.log("chat persistence fixture checks passed");
