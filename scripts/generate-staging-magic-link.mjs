import { spawn } from "node:child_process";
import { once } from "node:events";

import { createClient } from "@supabase/supabase-js";

const STAGING_PROJECT_REF = "bmqhwofmdgebpcihjlnb";
class SafeHelperError extends Error {}

try {
  const args = parseArgs(process.argv.slice(2));
  requireExactStagingProject(args.projectRef);

  const email = requireEmail(process.env.LUMIS_STAGING_QA_EMAIL);
  const redirectUrl = requireAllowedRedirect(
    process.env.LUMIS_STAGING_QA_REDIRECT_URL
  );

  if (args.dryRun) {
    process.stdout.write(
      "Dry run passed: staging project, email, and mobile redirect guards are valid. No network request was made.\n"
    );
    process.exit(0);
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    fail(
      "SUPABASE_SERVICE_ROLE_KEY is required through the local environment for the live staging command."
    );
  }

  const supabase = createClient(
    `https://${STAGING_PROJECT_REF}.supabase.co`,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false
      }
    }
  );

  const { data, error } = await supabase.auth.admin.generateLink({
    email,
    options: { redirectTo: redirectUrl },
    type: "magiclink"
  });

  const actionLink = data?.properties?.action_link;
  if (error || !actionLink) {
    fail(
      "Unable to generate the staging link. Verify the hidden staging key and Auth configuration."
    );
  }

  await copySecretToClipboard(actionLink);
  process.stdout.write(
    "One-time staging magic link copied to the local clipboard. The link was not printed or stored by this helper.\n"
  );
} catch (error) {
  if (error instanceof SafeHelperError) {
    process.stderr.write(`${error.message}\n`);
  } else {
    process.stderr.write(
      "The staging helper failed safely. No link or credential was printed.\n"
    );
  }
  process.exitCode = 1;
}

function parseArgs(values) {
  let projectRef = "";
  let dryRun = false;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (value === "--project-ref") {
      projectRef = values[index + 1] ?? "";
      index += 1;
      continue;
    }
    fail("Unknown argument. Use --project-ref and optionally --dry-run.");
  }

  if (!projectRef) {
    fail("An explicit --project-ref is required.");
  }

  return { dryRun, projectRef };
}

function requireExactStagingProject(projectRef) {
  if (projectRef !== STAGING_PROJECT_REF) {
    fail("Refusing to run: this helper is locked to the Lumis staging project.");
  }
}

function requireEmail(value) {
  const email = value?.trim().toLowerCase() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail("LUMIS_STAGING_QA_EMAIL must contain one valid staging test email.");
  }
  return email;
}

function requireAllowedRedirect(value) {
  let url;
  try {
    url = new URL(value ?? "");
  } catch {
    fail(
      "LUMIS_STAGING_QA_REDIRECT_URL must be a valid Expo or Lumis development callback."
    );
  }

  const isLocalHost =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1";
  const isExpoCallback =
    (url.protocol === "exp:" || url.protocol === "exps:") &&
    Boolean(url.hostname) &&
    !isLocalHost &&
    url.pathname.endsWith("/--/auth/callback");
  const isLumisDevelopmentCallback =
    url.protocol === "lumis:" &&
    url.hostname === "auth" &&
    url.pathname === "/callback";

  if (!isExpoCallback && !isLumisDevelopmentCallback) {
    fail(
      "The redirect must be a non-local Expo Go callback or lumis://auth/callback."
    );
  }

  if (url.search || url.hash || url.username || url.password) {
    fail("The redirect callback cannot contain credentials, query data, or fragments.");
  }

  return url.toString();
}

async function copySecretToClipboard(value) {
  const clipboard = spawn("pbcopy", [], {
    stdio: ["pipe", "ignore", "ignore"]
  });
  clipboard.stdin.end(value);

  const [exitCode] = await once(clipboard, "close");
  if (exitCode !== 0) {
    fail(
      "The link was generated but could not be copied. It was discarded without being printed."
    );
  }
}

function fail(message) {
  throw new SafeHelperError(message);
}
