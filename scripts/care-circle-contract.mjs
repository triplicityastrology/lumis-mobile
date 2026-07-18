import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const scaffold = readFileSync("supabase/migrations/0003_care_notifications_usage.sql", "utf8");
const correction = readFileSync(
  "supabase/migrations/0018_remove_misleading_care_max_index.sql",
  "utf8"
);

assert.match(scaffold, /create unique index if not exists care_relationships_active_pair_idx/i);
assert.match(correction, /drop index if exists public\.care_relationships_max_five_active_carers_idx/i);
assert.match(correction, /This does not enforce a maximum carer count/i);
assert.doesNotMatch(correction, /create unique index[^;]+max_five/is);

console.log("Care Circle schema contract checks passed");
