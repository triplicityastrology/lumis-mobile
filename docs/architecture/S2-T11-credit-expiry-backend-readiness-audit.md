# S2-T11 Credit Expiry Backend Readiness Audit

**Version:** 0.1  
**Date:** 2026-07-28  
**Status:** source/design readiness only; not approved for migration or activation  
**Authority:** founder credit-expiry policy dated 2026-07-28  
**Audience:** Founder, PM, Technical, Finance, Privacy, and QA

## Executive Verdict

**Not ready to implement charging or billing.** The current scaffold has useful
entitlement, idempotency, and period-key foundations, but `monthly_balance` is an
aggregate snapshot. It cannot authoritatively represent individual PAYG lots,
90-day expiry, refund lineage, deterministic concurrent consumption, or an
auditable no-rollover monthly boundary.

The smallest safe future change is one forward-only, inactive ledger migration
that introduces credit lots, append-only credit transactions, safe read
projections, and service-only atomic operations. Activation must remain a later,
separate gate after provider events, finance decisions, hosted concurrency
evidence, and founder-approved Profile/PAYG expiry disclosure are ready.

This task creates no migration, charge path, billing UI, provider call, or
deployment.

## Founder Policy Restated

- Monthly included credits are allocated at the start of the authoritative
  billing period.
- Unused monthly credits expire at the next billing boundary. They never roll
  into the following period.
- Each PAYG purchase creates its own lot and expires exactly 90 days after the
  authoritative purchase timestamp.
- Future Profile balance and PAYG purchase surfaces must disclose the applicable
  expiry date.
- Dice remains cost-blind: no price, balance, credit, payment, plan, top-up, or
  purchase wording.
- Push device tokens and their 90-day inactivity cleanup are unrelated to
  credits and must never enter the credit ledger.

## Source Evidence Reviewed

- `supabase/migrations/0001_initial_schema.sql`
- `supabase/migrations/0005_starter_grant_guard.sql`
- `supabase/migrations/0014_authoritative_account_entitlements.sql`
- `supabase/migrations/0015_entitlement_provider_privacy.sql`
- `supabase/migrations/0017_persona_policy_and_entitlement_events.sql`
- `supabase/migrations/0020_backend_runtime_guardrails.sql`
- `supabase/migrations/0022_chat_idempotency_context.sql`
- `supabase/migrations/0027_entitlement_event_integrity_repair.sql`
- `supabase/migration-drafts/0031_internal_account_deletion_finalizer.sql`
- `supabase/functions/billing-webhook/index.ts`
- `supabase/functions/chat-message/index.ts`
- `packages/shared/src/config/products.ts`
- `packages/shared/src/config/account-entitlement.ts`
- `packages/shared/src/config/entitlements.ts`
- `apps/mobile/src/services/accountState.ts`
- founder policy:
  `Lumis_Credit_Expiry_Founder_Policy_2026-07-28.md`

## Current-State Findings

### Foundations That Can Be Reused

- `account_entitlements` is backend-owned and separates plan status from credit
  balance.
- `entitlement_provider_events` is append-only, digest-protected, and has
  deterministic equal-time event ordering.
- `monthly_balance.billing_period_key` prevents duplicate normal balance rows
  for one logical provider period.
- `chat_messages.client_msg_id` and the chat persistence RPC establish a stable
  request-level idempotency pattern.
- RLS already limits users to their own legacy balance reads; provider fields
  remain service-only.
- Chat is still `scaffold_no_charge`, so no current route should be described as
  atomically charged.

### Gaps and Contradictions

1. `monthly_balance` combines allocation, pack units, use, and remaining balance
   in one mutable row. It cannot preserve lot-level expiry or consumption
   lineage.
2. `pack_units` has no purchase timestamp, provider transaction identity, lot
   status, refund link, or expiry timestamp.
3. `period_end` is optional and no backend operation atomically expires monthly
   credit at the provider boundary.
4. Current top-up product constants specify `expiresMonths: 12`; that conflicts
   with the approved 90-day PAYG policy and must not be used for activation.
5. There is no atomic backend charge operation that expires stale lots, checks
   entitlement, consumes eligible lots, and commits usage in one transaction.
6. There is no append-only credit transaction ledger for allocation, charge,
   expiry, refund, reversal, or compensation.
7. Current mobile restoration reads an aggregate balance. It cannot disclose
   which amount expires when.
8. Billing webhook is explicitly scaffold-only and does not allocate credits.
9. The internal deletion finalizer is still a draft. Future credit-ledger
   deletion/export handling therefore needs explicit privacy and finance
   approval before activation.

## Authoritative Clock and Period Rule

Store all authoritative instants as PostgreSQL `timestamptz` and compare them in
UTC. A display time zone may format dates for the user, but must never calculate
expiry.

### Monthly Included Credits

- The provider subscription event supplies a stable billing-period identity,
  `period_start`, and `period_end`.
- The lot becomes usable at `period_start` only after the provider event is
  authenticated and accepted.
- `expires_at` equals the provider's next billing boundary (`period_end`), not
  the user's device month, Supabase region time, or Hong Kong calendar month.
- A scheduler may mark lots expired for reporting, but charge/read operations
  must also exclude or expire them transactionally. Correctness cannot depend
  on cron running exactly at the boundary.
- A delayed provider retry for the same period is idempotent and cannot create a
  second lot or extend expiry.

### PAYG Credits

- `effective_at` is the authenticated, provider-authoritative successful
  purchase instant.
- `expires_at = effective_at + interval '90 days'`.
- This is 90 elapsed 24-hour days, not “three months” and not a device-local
  calendar calculation.
- Each purchase remains a separate lot.

### Payment Retry and Grace Boundaries

- A failed renewal event creates no new monthly credit lot.
- A successful recovery for the same provider period creates at most one lot,
  with the original provider period end. A late event never extends the lot.
- Plan access during `grace_period` is separate from credit allocation.
- **Open founder/Finance decision before implementation:** whether grace-period
  access may spend an already-allocated current-period lot after payment failure.
  The schema supports either rule; activation must select and test one.

## Smallest Forward-Only Migration Design

The future migration should be additive and inactive. Suggested names are
illustrative, not authorised SQL.

### `credit_lots`

One row per monthly allocation, PAYG purchase, or approved adjustment:

- `id uuid primary key`
- `user_id uuid` with account-deletion relationship
- `source_type`: `monthly_included`, `payg_purchase`, `admin_adjustment`,
  `compensation`
- `product_code`
- `provider`
- `provider_event_id` / transaction identity, nullable only for approved
  internal adjustments
- `billing_period_key`, required for monthly lots
- `original_amount`
- `remaining_amount`
- `effective_at`
- `expires_at`
- `status`: `pending`, `active`, `exhausted`, `expired`, `reversed`,
  `quarantined`
- `reversal_of_lot_id`, if applicable
- `created_at`, `updated_at`

Required constraints/indexes:

- positive original amount;
- remaining between zero and original amount;
- expiry later than effective time;
- unique provider/event/transaction identity;
- unique user + monthly billing-period key for monthly lots;
- active-lot lookup on `(user_id, status, expires_at, effective_at)`;
- backend-only writes.

### `credit_ledger_entries`

Append-only evidence for every balance-changing operation:

- `id uuid primary key`
- `user_id`
- `lot_id`
- `entry_type`: `allocation`, `charge`, `expiry`, `refund`, `reversal`,
  `compensation`
- signed `amount_delta`
- stable `idempotency_key`
- `client_msg_id` or backend operation ID where applicable
- `route` only when operationally necessary
- `provider_event_id` / original-entry link
- `occurred_at`, `recorded_at`
- minimal allowlisted audit metadata with no prompt, response, chart, birth
  details, payment credentials, or device token

Required constraints/indexes:

- unique `(user_id, idempotency_key)`;
- user/time and lot/time indexes;
- append-only trigger or grants;
- service-role-only writes;
- owner-safe read projection rather than broad raw-table access.

### Safe Read Projection

A protected RPC should return only:

- total currently available credits;
- monthly amount and its next expiry;
- PAYG amount grouped by expiry date;
- no provider customer/event identifiers;
- no payment credential or private payload.

This is future Profile/PAYG data support, not permission to expose billing in the
current preview.

## Backend Operations

### Allocate Monthly Credits

`apply_monthly_credit_allocation(...)` must:

1. authenticate a service/provider event;
2. lock the user-period identity;
3. validate entitlement and provider period;
4. insert one lot and one allocation entry;
5. return the committed duplicate on exact replay;
6. reject a reused idempotency/event ID with changed digest or period.

### Record PAYG Purchase

`apply_payg_credit_purchase(...)` must:

1. accept only an authenticated provider event;
2. create one lot with exact 90-day expiry;
3. write one allocation entry;
4. suppress exact retry and reject changed-payload reuse.

### Atomic Charge

`charge_credits(...)` must run in one database transaction:

1. authenticate the user and verify active plan/feature authority;
2. lock the user's eligible lots and idempotency key;
3. transactionally exclude/expire lots where `expires_at <= now()`;
4. return an existing committed charge for an exact retry;
5. calculate available balance;
6. return backend-only `INSUFFICIENT_CREDITS` without writing a partial charge;
7. consume by earliest expiry first, then earliest effective time, then stable
   lot ID;
8. update lot projections and append charge entries;
9. persist the business operation and credit charge atomically.

The client never calculates affordability or decrements a balance.

### Refunds and Reversals

- Never delete or rewrite an original ledger entry.
- Link a compensating entry to the original provider event/ledger entry.
- Restore only the amount valid under the approved refund rule.
- Do not revive an already expired lot past its original expiry.
- If a refund exceeds unspent credit or the related charge cannot be safely
  reversed, create a backend manual-review state rather than a negative or
  fabricated balance.
- Exact provider replay is a no-op; changed-payload reuse is an integrity
  conflict.

## Migration Sequence and Legacy Backfill

1. **Preflight:** confirm migrations through `0035`, current grants/RLS, no
   duplicate period keys, product catalog conflicts, and legacy balance counts.
2. **Add inactive tables/functions:** create lots, ledger, safe projections, and
   service-only RPCs without switching any app or webhook writer.
3. **Backfill in quarantine/shadow mode:**
   - monthly rows with trustworthy `period_start`, `period_end`, allocation, and
     period key may become shadow monthly lots;
   - one-time Starter rows require a separate founder expiry decision;
   - legacy `pack_units` cannot be assigned a 90-day expiry without a trustworthy
     purchase timestamp and transaction ID. Quarantine and report them; never
     invent dates.
4. **Reconcile:** compare legacy aggregate totals with shadow projections and
   resolve every discrepancy.
5. **Provider staging:** prove allocation, delayed events, refunds, and replay
   against provider sandbox events.
6. **Charging staging:** prove atomic charge and concurrency with disposable
   users.
7. **Activation migration/release:** a separate founder-authorised change
   switches writers/readers. It must not be bundled with schema creation.
8. **Legacy retirement:** retain legacy rows read-only until reconciliation and
   retention approval; remove only by a later forward migration.

## RLS, Privacy, Deletion, and Export

- Clients receive owner-safe projections; raw provider and ledger tables remain
  backend-only.
- Cross-user and anonymous reads/writes must be denied.
- Audit metadata is an allowlist, not a copied provider payload.
- Account export must include understandable lot/expiry and transaction history,
  excluding internal provider secrets and other users' data.
- Account deletion must remove or legally retain/anonymise financial evidence
  according to a documented Finance/Privacy retention decision. Cascading a user
  row is not sufficient policy.
- Deletion must never affect another user's ledger.
- Push tokens, notification registrations, message bodies, chart data, and birth
  details are prohibited from credit audit metadata.

## Staging Evidence Required Before Activation

- monthly allocation exactly once at provider period start;
- expiry at exact provider boundary and no rollover;
- delayed/retried renewal cannot duplicate or extend a lot;
- payment failure and recovery behavior;
- PAYG expiry at 90-day UTC boundaries, including DST/local-time displays;
- earliest-expiry-first consumption across monthly and multiple PAYG lots;
- concurrent charges cannot overspend;
- exact charge replay returns one committed result;
- changed-context idempotency reuse is rejected;
- insufficient balance creates no partial business or ledger write;
- refund/reversal and expired-lot behavior;
- RLS owner, cross-user, anonymous, and service-only operations;
- deletion/export and retention behavior;
- safe Profile/PAYG expiry projection;
- Dice and all non-billing preview surfaces remain cost-blind;
- notification/device-token tables remain absent from credit operations.

## Forward Recovery

Never drop or reverse an applied migration as emergency recovery.

- Before activation, leave new objects inactive and correct defects with a later
  forward migration.
- After activation, disable the new writer via an approved backend feature gate,
  preserve append-only records, and apply a forward corrective migration.
- Never restore an older charge function that lacks lot expiry, idempotency, or
  concurrency protections.
- Reconciliation reports must be backend-only and contain no payment payload,
  prompt, chart, birth, or device-token data.

## Open Decisions Before Implementation

1. Starter one-time credit expiry rule.
2. Whether current-period credits remain spendable during provider grace period.
3. Financial-record retention/anonymisation after account deletion.
4. Refund policy when consumed credit exceeds the refundable unused amount.
5. Approved provider transaction identifiers and event timestamp semantics.
6. Founder-approved Profile/PAYG expiry wording and accessibility behavior.

## Explicit Non-Implementation Statement

No billing UI, charging, PAYG purchase, plan activation, payment-provider
integration, migration, deployment, or Dice cost display is implemented or
authorised by S2-T11.
