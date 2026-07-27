import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const STAGING_PROJECT_REF = "bmqhwofmdgebpcihjlnb";
class SafeReadinessError extends Error {}

try {
  const args = parseArgs(process.argv.slice(2));
  requireStagingProject(args.projectRef);
  verifyActiveMobileProject(args.projectRef);
  verifyLinkedCliProject(args.projectRef);

  const siteUrl = requireSiteUrl(process.env.LUMIS_STAGING_AUTH_SITE_URL);
  const redirects = requireRedirectAllowList(
    process.env.LUMIS_STAGING_AUTH_REDIRECT_URLS
  );

  process.stdout.write("Lumis staging Auth readiness check passed.\n");
  process.stdout.write("- Active mobile project: staging confirmed.\n");
  process.stdout.write("- Auth Site URL: valid staging URL shape.\n");
  process.stdout.write(
    `- Redirect allow-list: ${redirects.length} valid mobile callback shape(s).\n`
  );
  process.stdout.write(
    args.smtpMode === "custom"
      ? "- Email delivery: custom staging SMTP confirmed from the Auth dashboard.\n"
      : "- Email delivery: built-in provider selected; its project email rate limit applies.\n"
  );
  process.stdout.write(
    "- PKCE QA must start inside Lumis with its normal secure-link action; this tool does not generate links.\n"
  );

  void siteUrl;
} catch (error) {
  process.stderr.write(
    error instanceof SafeReadinessError
      ? `${error.message}\n`
      : "The staging readiness check failed safely without changing Auth configuration.\n"
  );
  process.exitCode = 1;
}

function parseArgs(values) {
  let projectRef = "";
  let smtpMode = "";

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--project-ref") {
      projectRef = values[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (value === "--smtp-mode") {
      smtpMode = values[index + 1] ?? "";
      index += 1;
      continue;
    }
    fail("Unknown argument. Use --project-ref and --smtp-mode.");
  }

  if (!projectRef) fail("An explicit --project-ref is required.");
  if (smtpMode !== "custom" && smtpMode !== "builtin") {
    fail("--smtp-mode must be custom or builtin, matching the staging Auth dashboard.");
  }

  return { projectRef, smtpMode };
}

function requireStagingProject(projectRef) {
  if (projectRef !== STAGING_PROJECT_REF) {
    fail("Refusing to run: this readiness check is locked to Lumis staging.");
  }
}

function verifyActiveMobileProject(projectRef) {
  const envPath = path.resolve("apps/mobile/.env");
  if (!existsSync(envPath)) {
    fail("apps/mobile/.env is missing; the active mobile project cannot be verified.");
  }

  const env = parseEnvFile(readFileSync(envPath, "utf8"));
  const configuredUrl = env.EXPO_PUBLIC_SUPABASE_URL;
  if (!configuredUrl) {
    fail("EXPO_PUBLIC_SUPABASE_URL is missing from the active mobile environment.");
  }

  let configuredRef;
  try {
    configuredRef = new URL(configuredUrl).hostname.split(".")[0];
  } catch {
    fail("The active mobile Supabase URL is malformed.");
  }

  if (configuredRef !== projectRef) {
    fail("The active mobile environment does not point to Lumis staging.");
  }
}

function verifyLinkedCliProject(projectRef) {
  const linkedRefPath = path.resolve("supabase/.temp/project-ref");
  if (!existsSync(linkedRefPath)) return;

  const linkedRef = readFileSync(linkedRefPath, "utf8").trim();
  if (linkedRef !== projectRef) {
    fail("The linked Supabase CLI project does not match Lumis staging.");
  }
}

function requireSiteUrl(value) {
  let url;
  try {
    url = new URL(value?.trim() ?? "");
  } catch {
    fail("LUMIS_STAGING_AUTH_SITE_URL must match the staging Auth dashboard value.");
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    fail("The staging Auth Site URL has an unsafe or unsupported shape.");
  }
  return url;
}

function requireRedirectAllowList(value) {
  const redirects = (value ?? "")
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (redirects.length === 0) {
    fail(
      "LUMIS_STAGING_AUTH_REDIRECT_URLS must contain the staging mobile callback allow-list."
    );
  }

  for (const redirect of redirects) {
    if (!isAllowedMobileCallbackShape(redirect)) {
      fail("The staging redirect allow-list contains an unsupported callback shape.");
    }
  }
  return redirects;
}

function isAllowedMobileCallbackShape(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.search || url.hash || url.username || url.password) return false;

  const isLocalHost =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1";
  const isExpoCallback =
    (url.protocol === "exp:" || url.protocol === "exps:") &&
    Boolean(url.hostname) &&
    !isLocalHost &&
    url.pathname.endsWith("/--/auth/callback");
  const isLumisCallback =
    url.protocol === "lumis:" &&
    url.hostname === "auth" &&
    url.pathname === "/callback";

  return isExpoCallback || isLumisCallback;
}

function parseEnvFile(contents) {
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        const value = line
          .slice(separator + 1)
          .trim()
          .replace(/^(['"])(.*)\1$/, "$2");
        return [key, value];
      })
  );
}

function fail(message) {
  throw new SafeReadinessError(message);
}
