import { createClient } from "@supabase/supabase-js";

import { STAGING_PROJECT_REF, validateBirthChangeResetInput } from "./lib/staging-birth-change-reset.mjs";

try {
  const args = parseArgs(process.argv.slice(2));
  const validation = validateBirthChangeResetInput({
    projectRef: args.projectRef,
    execute: args.execute,
    confirmation: process.env.S2_T81_RESET_CONFIRMATION,
    userId: process.env.S2_T81_TARGET_USER_ID
  });
  if (validation.mode === "dry_run") {
    process.stdout.write("S2_T81_RESET_DRY_RUN_PASS\nnetwork_calls=0\nrows_changed=0\n");
  } else {
    await executeReset();
  }

  async function executeReset() {
    const secret = process.env.S2_T81_QA_SECRET_KEY;
    if (!secret?.startsWith("sb_secret_")) throw new Error("STOP_S2_T81_SECRET_REQUIRED");
    const client = createClient(`https://${STAGING_PROJECT_REF}.supabase.co`, secret, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    const { count, error } = await client
      .from("birth_data")
      .update({ successful_change_count: 0 }, { count: "exact" })
      .eq("user_id", process.env.S2_T81_TARGET_USER_ID);
    if (error || count !== 1) throw new Error("STOP_S2_T81_RESET_COUNT_INVALID");
    process.stdout.write("S2_T81_RESET_COMPLETE\nrows_changed=1\nsuccessful_change_count=0\n");
  }
} catch {
  process.stderr.write("STOP_S2_T81_RESET_FAILED\n");
  process.exitCode = 1;
} finally {
  delete process.env.S2_T81_QA_SECRET_KEY;
  delete process.env.S2_T81_TARGET_USER_ID;
  delete process.env.S2_T81_RESET_CONFIRMATION;
}

function parseArgs(values) {
  const result = { execute: false, projectRef: "" };
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === "--execute") result.execute = true;
    else if (values[index] === "--project-ref") result.projectRef = values[++index] ?? "";
    else throw new Error("STOP_S2_T81_ARGUMENT_INVALID");
  }
  return result;
}
