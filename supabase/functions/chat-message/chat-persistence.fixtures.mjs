import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const edgeSource = readFileSync("supabase/functions/chat-message/index.ts", "utf8");
const mobileChatSource = readFileSync("apps/mobile/src/services/chat.ts", "utf8");
const migrationSource = readFileSync(
  "supabase/migrations/0011_explicit_reflection_thread.sql",
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
  /where id = p_thread_id[\s\S]*and user_id = p_user_id[\s\S]*and chart_version = p_chart_version/i,
  "explicit reflection thread must be owned by the user and match the active chart version"
);
assert.match(
  migrationSource,
  /REFLECTION_THREAD_NOT_AVAILABLE/i,
  "an unavailable explicit reflection thread must fail instead of falling back"
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
assert.match(
  edgeSource,
  /p_thread_id: body\.thread_id \?\? null/,
  "Edge Function must pass the selected Past Reflection thread to the RPC"
);
assert.match(
  mobileChatSource,
  /thread_id: input\.threadId \?\? null/,
  "mobile chat must send the selected Past Reflection thread"
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
