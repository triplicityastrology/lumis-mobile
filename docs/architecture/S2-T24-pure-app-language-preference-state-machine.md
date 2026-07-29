# S2-T24 Pure App-Language Preference State Machine

Status: inactive, pure TypeScript infrastructure.

The reducer in
`packages/shared/src/config/app-language-state-machine.ts` models future
language-selection authority without implementing a selector, navigation, RPC,
storage, translation, migration, deployment, or configuration.

## Supported Values

Exactly:

- `en`
- `zh-Hant`

Runtime guards reject any other value by leaving state unchanged.

## Authority Rules

1. A valid server-saved preference wins for UI and deterministic fixed
   templates.
2. A first-launch choice is local and provisional until an authorised save
   succeeds.
3. With no saved preference, fixed templates retain deterministic request-text
   fallback.
4. Selecting a Profile/Settings value creates pending state; it does not claim
   persistence.
5. Offline, temporary, and migration-unavailable failures retain the previous
   saved authority and keep the pending choice retryable.
6. Only a matching successful save event promotes the pending value to saved.

## Account-Preservation Boundary

The reducer receives a non-sensitive account boundary containing only:

- authentication status;
- whether a valid chart exists;
- onboarding status.

Every transition preserves that object by reference. Language selection cannot
sign a user out, clear a valid chart, restart onboarding, create a profile, or
change account authority.

## Accessibility Data

The module provides:

- radio roles for both language options;
- labels and hints;
- deterministic announcements for selection, loading, saving, saved, offline,
  temporary failure, and migration-unavailable states.

These are data contracts only. No screen, focus behavior, or announcement API is
invoked.

## Inactive Boundary

The state machine:

- performs no network, storage, RPC, provider, or model call;
- has no mobile UI or navigation import;
- does not read environment variables;
- does not translate fixed templates;
- does not alter migration `0035`;
- does not connect Chat, AI, Knowledge Bank, billing, Dice, or staging.

Future UI and persistence wiring require separate Claude/Fable design,
implementation authority, migration deployment evidence, and device QA.
