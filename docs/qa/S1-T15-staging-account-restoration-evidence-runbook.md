# S1-T15 Staging Account-Restoration Evidence Runbook

Status: prepared only; do not run until PM releases the hosted check.

This runbook is staging-only. It does not deploy a migration, change dashboard
configuration, enable a fixture fallback, or modify an existing founder account.
The hosted proof creates run-scoped disposable users, uses the real signed chart
path, prints only check names and a run ID, and removes the disposable users in
`finally`.

## Protected target

- Supabase project ref: `bmqhwofmdgebpcihjlnb`
- Environment: Lumis staging only
- Required key: dedicated, independently revocable `sb_secret_` QA key
- The key is entered through hidden Terminal input. Never paste it into chat,
  source files, `.env`, screenshots, shell history, or evidence.

The command refuses another project ref and rejects a legacy `service_role` JWT.

## Local source proof

This is safe to run before PM releases hosted testing:

```bash
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work"

PATH="/Users/rubyku/.local/node22/bin:$PATH" \
"/Users/rubyku/.local/node22/bin/pnpm" \
test:account-restoration-evidence
```

It verifies that:

- restoration queries use the authenticated user ID;
- chart, active version, Persona name/style/avatar, focus, and Past Reflections
  are restored together;
- only confirmed absence of both birth/chart records becomes `empty`;
- a temporary query failure routes to a retryable restore failure;
- signed-in restoration cannot fall through to local demo/fixture state;
- repeat onboarding, same-email restoration, and cross-user RLS checks remain in
  the hosted proof;
- the hosted runner is staging-locked and uses hidden key input.

## Future hosted proof

Run this only after PM releases S1-T15:

```bash
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work"

export SUPABASE_PROJECT_REF="bmqhwofmdgebpcihjlnb"

PATH="/Users/rubyku/.local/node22/bin:$PATH" \
"/Users/rubyku/.local/node22/bin/pnpm" \
test:staging-account-restore:secure

unset SUPABASE_PROJECT_REF
```

Terminal will ask for the dedicated `sb_secret_` QA key using hidden input. The
proof intentionally runs the existing `prof2` staging scope because account
restoration depends on real transactional onboarding, chart versions, and RLS.
It does not run account deletion or external-destination delivery.

Required redacted evidence:

1. Exact pushed commit SHA.
2. Hosted QA run ID.
3. The named checks for repeat onboarding rejection, same-email restoration,
   active chart-version consistency, Persona/focus persistence, cross-user RLS
   denial, no-active-profile failure, and zero partial writes.
4. Final cleanup result.

Do not record disposable emails, user UUIDs, birth details, chart payloads,
tokens, keys, callback URLs, or raw provider responses.

## Interrupted-run cleanup

If Terminal stops after printing a run ID, use the exact run ID shown:

```bash
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work"

export SUPABASE_PROJECT_REF="bmqhwofmdgebpcihjlnb"

PATH="/Users/rubyku/.local/node22/bin:$PATH" \
"/Users/rubyku/.local/node22/bin/pnpm" \
test:staging-backend:cleanup -- REPLACE_WITH_RUN_ID

unset SUPABASE_PROJECT_REF
```

The cleanup command again requests the dedicated key through hidden input.

## Pass criteria

- One disposable account reloads its existing chart, active version, Persona,
  focus, and Past Reflections after same-account sign-in.
- The second disposable account cannot read the first account's chart data.
- A confirmed-empty account is the only state eligible for onboarding.
- Temporary profile failure remains a retryable restoration failure.
- Repeat onboarding returns `PROFILE_ALREADY_EXISTS` without another chart.
- Cleanup removes every run-scoped disposable user.

No production deployment or founder-account testing is authorized by this
runbook.
