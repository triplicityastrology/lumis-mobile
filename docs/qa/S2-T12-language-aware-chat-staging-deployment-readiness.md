# S2-T12 Language-Aware Chat Staging Deployment Readiness

**Version:** 0.2
**Date:** 2026-07-28
**Environment:** staging only
**Required project ref:** `bmqhwofmdgebpcihjlnb`
**Status:** preparation only; this document does not authorise or execute deployment

## Authority and supersession

This is the single current staging authority for the language-aware fixed-template
chain. It replaces `S1-T26_Staging_Chat_Routing_Deployment_Readiness_Runbook_v0.1`.
S1-T26 must not be used because it predates migration `0035` and persisted
language-preference priority.

Reviewed implementation commit: `97c75dc` (`add app language preference foundation`).
The following SHA-256 digests pin the exact reviewed source:

| Source | SHA-256 |
|---|---|
| `supabase/migrations/0035_app_language_preference.sql` | `93c6c9e7bc3a1d912a9c2979af9678a05a8f397423d0613c98a1f50948316747` |
| `packages/shared/src/config/app-language.ts` | `2264cdcf025d2b21b39e3410adab16440360319b3609847bf0204d0de960e1c5` |
| `packages/shared/src/config/chat-router.ts` | `6e1fd4728c71adeb99434cf1a4987d98aaf0ac7d41a2604f49d62db711bf9a82` |
| `supabase/functions/chat-message/index.ts` | `73a7df7042c4b8400996092ebbc7fb9a67eb24c3185fd812918b4887a56cd7ad` |
| `apps/mobile/src/services/accountState.ts` | `bbea677ea4fbf615dd4959c2deef5c202e05c23e1d12db53d478891354b10bd1` |

Any digest mismatch stops the future staging window and requires renewed review.

## Product boundary

- Persisted app preference, when explicitly set, has priority and is exactly
  `en` or `zh-Hant`.
- When no preference has been set, request-language detection is the fallback.
- Solar Return scope and fixed safety responses use deterministic templates.
- No generated translation, model call, or mixed-language template is allowed.
- `Sr. Alvarez` remains an ordinary casual phrase and is not classified as
  Solar Return.
- No selector UI, language setting UI, billing, or production deployment is
  included.

## Privacy and configuration boundary

All configuration checks are names-only. A future operator may verify that
required configuration names exist, but must never print their values.

Never record or display URLs, secret values, tokens, user IDs, email addresses,
callback links, request headers, request/response bodies, birth data, chart data,
Persona, focus, or Past Reflections. Do not use shell tracing, `env`, `printenv`,
or `.env` file output. No Azure, OpenAI, model, or translation provider is
required or permitted for this proof.

## Future staging preflight

These steps are documentation for a separately authorised window. They are not
to be run as part of S2-T12.

1. Confirm the repository is clean and all pinned file digests match.
2. Confirm the locally linked Supabase project ref equals
   `bmqhwofmdgebpcihjlnb`; stop for every other or missing ref.
3. Confirm the active CLI account can see that exact staging project.
4. Run `pnpm typecheck`, `pnpm test:app-language`,
   `pnpm test:router`, and `pnpm test:chat-persistence`.
5. Capture names-only migration and function metadata. Do not capture logs,
   request bodies, configuration values, or source bundles as evidence.
6. Confirm a post-S2-T10 reviewed function source package is available for safe
   recovery before making any change.

## Strict future deployment order

The order is mandatory:

1. Apply migration `0035` to `bmqhwofmdgebpcihjlnb`.
2. Verify migration `0035` is listed remotely and the owner-scoped language RPC
   denies anonymous use.
3. Deploy `chat-message` from the exact reviewed source to
   `bmqhwofmdgebpcihjlnb`, preserving JWT verification.
4. Record names-only function version/status metadata.
5. Confirm an unauthenticated invocation is denied.
6. Only then run the disposable authenticated staging proof below.

Never deploy `chat-message` before migration `0035`.

## Disposable staging proof

Use two newly created disposable staging accounts. Do not use founder accounts
or existing customer data. Evidence records only neutral check names,
pass/fail, language code, safe status code, function version, migration version,
and a redacted run ID.

| Check | Setup | Expected |
|---|---|---|
| English preference priority | Account A preference `en`; Chinese Solar Return request | Fixed English scope template |
| Traditional Chinese preference priority | Account A preference `zh-Hant`; English Solar Return request | Fixed zh-Hant scope template |
| English fallback | Account B has no explicit preference; English request | Fixed English template |
| Traditional Chinese fallback | Account B has no explicit preference; Chinese request | Fixed zh-Hant template |
| Safety template priority | Repeat both preference cases with a supported fixed safety prompt | One deterministic template in saved preference |
| `Sr.` non-regression | `I spoke with Sr. Alvarez today.` | Not Solar Return scope response |
| Anonymous denial | No authenticated session | Safe authentication denial |
| Cross-user denial | Account B attempts to change/read Account A preference through protected operations | Denied |
| No generated translation | Review execution path and fixed response | No provider/model invocation |

Delete both disposable users and their owned rows after evidence capture. Record
cleanup by redacted run ID only.

Reject the proof if any response exposes implementation text, provider output,
private data, billing/cost text, or a language different from the deterministic
rule.

## Forward-only recovery

Migration `0035` is forward-only. Never drop it, delete its migration record, or
restore an older schema. If a schema defect is found, stop traffic to the
affected staging function and prepare a new reviewed corrective migration.

Function recovery may deploy only a post-S2-T10 reviewed function source that:

- reads the persisted preference safely;
- falls back to request language only when preference is absent;
- keeps fixed Solar Return and safety templates deterministic;
- retains JWT verification and cross-user boundaries;
- makes no model or translation-provider call.

Do not redeploy the prior S1-T26 snapshot or any pre-S2-T10 `chat-message`
function. If no qualifying safe function package exists, leave the current
function deployed, stop the test, and prepare a forward fix.

## Evidence and acceptance

Allowed evidence:

- staging label and exact project ref;
- reviewed commit and digests;
- migration number and names-only function metadata;
- neutral check name, safe result code, pass/fail, and redacted run ID;
- fixed template text containing no account data;
- cleanup count without identifiers.

Raw CLI logs, Supabase logs, source snapshots, request/response bodies, and
screenshots containing account data are not evidence artifacts.

This runbook does not self-approve staging or production. PM must separately
authorise execution, QA must review redacted results, and production remains out
of scope.
