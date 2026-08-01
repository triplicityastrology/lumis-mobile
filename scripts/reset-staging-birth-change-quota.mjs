import { createClient } from "@supabase/supabase-js";

import {
  STAGING_PROJECT_REF,
  summarizeBirthChangeCounts,
  validateBirthChangeResetInput,
} from "./lib/staging-birth-change-reset.mjs";

try {
  const args = parseArgs(process.argv.slice(2));
  const validation = validateBirthChangeResetInput({
    projectRef: args.projectRef,
    execute: args.execute,
    countOnly: args.countOnly,
    confirmation: process.env.S2_T81_RESET_CONFIRMATION,
  });
  if (validation.mode === "dry_run") {
    process.stdout.write("S2_T81_RESET_DRY_RUN_PASS\nnetwork_calls=0\nrows_changed=0\n");
  } else if (validation.mode === "count_only") {
    await inspectCounts();
  } else {
    await resetAllCounts();
  }

  function getClient() {
    const secret = process.env.S2_T81_QA_SECRET_KEY;
    if (!secret?.startsWith("sb_secret_")) throw new Error("STOP_S2_T81_SECRET_REQUIRED");
    return createClient(`https://${STAGING_PROJECT_REF}.supabase.co`, secret, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
  }

  async function readSummary(client) {
    const { data, error } = await client
      .from("birth_data")
      .select("successful_change_count");
    if (error) throw new Error("STOP_S2_T91_COUNT_READ_FAILED");
    return summarizeBirthChangeCounts(data);
  }

  async function inspectCounts() {
    const summary = await readSummary(getClient());
    printSummary("S2_T91_COUNT_ONLY_PASS", summary);
  }

  async function resetAllCounts() {
    const client = getClient();
    const before = await readSummary(client);
    const { count, error } = await client
      .from("birth_data")
      .update({ successful_change_count: 0 }, { count: "exact" })
      .gte("successful_change_count", 0);
    if (error || count !== before.accountsTotal) throw new Error("STOP_S2_T81_RESET_COUNT_INVALID");
    const after = await readSummary(client);
    if (after.accountsTotal !== before.accountsTotal || after.count0 !== after.accountsTotal) {
      throw new Error("STOP_S2_T91_POST_VERIFY_FAILED");
    }
    printSummary("S2_T91_RESET_COMPLETE", before);
    process.stdout.write(`rows_changed=${count}\nafter_accounts_total=${after.accountsTotal}\nafter_count_0=${after.count0}\nafter_remaining_3=${after.count0}\n`);
  }

  function printSummary(status, summary) {
    process.stdout.write(`${status}\naccounts_total=${summary.accountsTotal}\ncount_0=${summary.count0}\ncount_1=${summary.count1}\ncount_2=${summary.count2}\ncount_3=${summary.count3}\naccounts_with_consumed_changes=${summary.accountsWithConsumedChanges}\n`);
  }
} catch {
  process.stderr.write("STOP_S2_T81_RESET_FAILED\n");
  process.exitCode = 1;
} finally {
  delete process.env.S2_T81_QA_SECRET_KEY;
  delete process.env.S2_T81_RESET_CONFIRMATION;
}

function parseArgs(values) {
  const result = { execute: false, countOnly: false, projectRef: "" };
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === "--execute") result.execute = true;
    else if (values[index] === "--count-only") result.countOnly = true;
    else if (values[index] === "--project-ref") result.projectRef = values[++index] ?? "";
    else throw new Error("STOP_S2_T81_ARGUMENT_INVALID");
  }
  return result;
}
