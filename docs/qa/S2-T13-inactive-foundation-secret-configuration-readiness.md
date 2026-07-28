# S2-T13 Inactive Foundation Secret and Configuration Readiness

**Version:** 0.1
**Date:** 2026-07-28
**Environment:** staging-readiness only
**Required project ref:** `bmqhwofmdgebpcihjlnb`
**Status:** local, inert, names-only control

## Purpose

This control checks whether the expected configuration names have been declared
in a future staging checklist. It does not read, print, hash, copy, compare, or
transmit secret values. It makes no network call and changes no configuration.

The current Care Circle and Notifications screens remain static previews.
Neither backend foundation is activated by this control.

## Required names

Care Circle:

- `CARE_CIRCLE_PAIRING_SECRET`

Inactive notification registration:

- `NOTIFICATION_TOKEN_ENCRYPTION_KEY`

Supabase Edge runtime names used by both inactive functions:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The pairing secret must eventually satisfy the reviewed Care Circle operation
contract. The notification key must eventually decode to exactly 32 bytes for
AES-GCM. This checker deliberately cannot inspect either condition because doing
so would require handling values.

## Safe local check

The repository command passes configuration names, not values:

```bash
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work"

/Users/rubyku/.local/node22/bin/pnpm test:inactive-foundation-config-readiness
```

Expected output contains the staging project ref, each approved configuration
name, and `declared` or `missing`. It contains names and status only.

The checker:

- rejects every project ref except `bmqhwofmdgebpcihjlnb`;
- rejects unknown configuration names;
- rejects any `--execute` argument;
- does not read environment variables or files;
- does not invoke Supabase, Cloudflare, Expo, a shell, or a provider;
- does not deploy functions, apply migrations, or change dashboards.

## Future manual staging prerequisite

A separately authorised operator may later use the Supabase Dashboard to inspect
the Edge Function secret-name list visually. Verify only whether each required
name exists. Do not open, copy, rotate, compare, or record values. Evidence may
say only:

```text
environment=staging
project_ref=bmqhwofmdgebpcihjlnb
configuration_name=<approved name>
status=present|missing
```

Do not take screenshots that could include project members, URLs, values, or
other configuration. If a required name is absent, record `missing` and stop.
Secret creation or rotation requires a separate founder-approved runbook.

## Explicit non-activation boundary

No notification provider credentials, Expo push configuration, APNs keys, FCM
keys, scheduler settings, delivery queue, permission prompt, registration UI,
or notification delivery may be created or enabled. These settings must remain
absent.

No pairing-code UI, QR scanner, Care Circle linking UI, reminder, check-in,
emergency behavior, or Care Circle activation may be enabled.

The only permitted notification registry keys remain
`care_circle_check_in` and `care_circle_reminder`, both disabled by default.

## Failure and recovery

This control is read-only, so rollback is not applicable. A failed check does
not justify creating a value. Correct the checklist name or obtain separate
authorization for future configuration work, then rerun the inert source check.

Unknown or production project refs always fail closed. Never weaken the project
guard for convenience.

## Evidence boundary

Allowed:

- staging label and exact staging project ref;
- approved configuration name;
- `present`, `missing`, `declared`, or safe stable failure code;
- local contract pass/fail.

Forbidden:

- secret/configuration values or derived forms;
- hashes, lengths, prefixes, comparisons, or clipboard contents;
- URLs, tokens, user data, request/response bodies, or provider output;
- CLI/dashboard raw output.

This document is readiness guidance only. It does not authorize deployment,
migration application, provider setup, or product activation.
