# Backend Runtime Guardrails - 2026-07-21

## Implemented In Source

- Chat `client_msg_id` idempotency with atomic duplicate replay and content-conflict rejection.
- One normal `monthly_balance` row per canonical `(user_id, billing_period_key)`. Legacy rows use `calendar:YYYY-MM`; RevenueCat must later use a stable provider-period key. Duplicate cleanup never sums accidental double grants.
- `/profile` fixed-window limit: 5 new-profile attempts per 10 minutes per user.
- `/chat-message` fixed-window limit: 30 attempts per minute per user.
- `chat_messages(user_id, created_at desc)` usage-accounting index.
- Provider-call outcome ledger for generated charts that fail onboarding persistence.
- Safe Worker telemetry (`generated`/`already_generated` plus provider-call count) so signed simultaneous-request QA can prove provider-call suppression without exposing provider payloads.
- Completed external-sync payload PII redaction. Failed-final PII remains backend-only for manual replay for 30 days, then is redacted while operational metadata remains visible.
- Request IDs, payload-free runtime events, health snapshot, threshold alerts, and retention cleanup.
- Database-local daily external-sync failure report and operational cleanup schedules.
- GitHub Actions typecheck, regression-suite, and production web-export evidence.
- Shared route-credit drift guard for the approved `1/3/5/5/5/1/1` table.

## Intentionally Disabled

- Real AI responses and credit charging remain `scaffold_no_charge`.
- Hourly Salesforce/Google delivery scheduling remains disabled until staging credentials and destination QA pass.
- Production RevenueCat webhooks remain disabled.

## Existing Verified Source Safeguards

- Signed Cloudflare Worker timeout, exact replay, changed-body conflict, simultaneous duplicate handling, and seven-day Durable Object result expiry.
- Entitlement event payload-integrity conflict and deterministic equal-time ordering.
- Website/mobile chart calculation parity remains through the existing signed Worker wrapper.

## Hosted Verification Still Required

- Apply migrations `0020` and `0021`, then deploy `profile` and `chat-message`.
- Run the dedicated-secret staging suite for idempotency, RLS, rate-limit, and migration behavior.
- Inspect `cron.job` and `cron.job_run_details` for retention, alert, and daily-report executions.
- Do not activate hourly external delivery until Salesforce sandbox and the staging Google Sheet pass QA.

## Still Open By Product Decision Or Later Milestone

- Trusted golden-chart expected values and accuracy signoff.
- Production birthplace plus historical-timezone resolver beyond the three-city beta table.
- Real AI, atomic charging, RevenueCat activation, Care Circle backend, DEL-1 deletion, and native navigation split.
