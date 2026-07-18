import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile("supabase/migrations/0016_trusted_birth_location_resolver.sql", "utf8");
const profileFunction = await readFile("supabase/functions/profile/index.ts", "utf8");
const hostedOnboardingPath = profileFunction.slice(
  profileFunction.indexOf("Deno.serve"),
  profileFunction.indexOf("async function loadExistingProfileState")
);

assert.match(migration, /create table if not exists public\.birth_location_reference/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /revoke all on table public\.birth_location_reference from anon, authenticated/i);
assert.match(migration, /create or replace function public\.resolve_trusted_birth_location/i);
assert.match(migration, /auth\.role\(\) <> 'service_role'/i);
assert.match(migration, /abs\(reference\.lat - p_lat\) <= 0\.25/i);
assert.match(migration, /abs\(reference\.lng - p_lng\) <= 0\.25/i);
assert.match(migration, /'tz_str', resolved\.tz_str/i);
assert.match(migration, /to service_role/i);

assert.match(hostedOnboardingPath, /serviceClient\.rpc\("resolve_trusted_birth_location"/);
assert.match(hostedOnboardingPath, /chartRequest\.birth_data = \{[\s\S]*tz_str: trustedLocation\.tz_str/);
assert.match(hostedOnboardingPath, /isValidBirthDate\(body\.birth_date, new Date\(\), trustedLocation\.tz_str\)/);
assert.match(hostedOnboardingPath, /p_tz_str: trustedLocation\.tz_str/);
assert.doesNotMatch(hostedOnboardingPath, /p_tz_str: body\.tz_str/);
assert(
  hostedOnboardingPath.indexOf('serviceClient.rpc("resolve_trusted_birth_location"') <
    hostedOnboardingPath.indexOf("chartResult = await generateChart"),
  "Trusted location resolution must happen before the chart Worker call."
);

console.log("birth location trust contract checks passed");
