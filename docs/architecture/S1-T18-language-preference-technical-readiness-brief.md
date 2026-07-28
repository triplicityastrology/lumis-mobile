# S1-T18 Language-Preference Technical Readiness Brief

Status: design only. No migration, UI, runtime configuration, or deployment is
authorized by this brief.

## Decision summary

Supported application locales should initially be:

- `en`
- `zh-Hant`

Language selection is an explicit first-launch decision. Device locale may
preselect a suggested option, but it must not silently skip the choice.

For a signed-in account, `public.users.lang` is authoritative. For a signed-out
or local-demo session, the chosen locale is stored in native secure local
storage. In-memory state is only a rendered copy of one of those authorities.

## Authority and merge rules

1. Before sign-in, read the native language preference.
2. If no explicit preference exists, show the first-launch language choice.
3. For a returning signed-in account, the server preference wins and is copied
   locally for signed-out Auth/system presentation on that device.
4. For a genuinely new account, the explicit local choice is written during
   transactional onboarding.
5. A Settings change writes through an owner-scoped backend RPC first. Update
   memory and local storage only after the server confirms success.
6. A failed write leaves the previous language active and shows localized,
   truthful retry copy.
7. Logout clears private account state but retains the non-sensitive device
   language choice so the signed-out screen does not unexpectedly change.
8. A local-demo choice remains device-local and must not overwrite an existing
   returning account preference.

The current schema already has `public.users.lang varchar(8) not null default
'zh-Hant'`. That legacy default does not prove the user chose Traditional
Chinese. A future migration should add `language_preference_set_at` (or an
equivalent explicit-choice marker). Existing accounts without that marker
should be prompted once rather than silently treating the old default as consent.

## Default and fallback

- Suggested first-launch selection: `zh-Hant` when the device locale is
  Traditional Chinese; otherwise `en`.
- Required explicit action: Continue after selecting a language.
- Corrupt, absent, or unsupported values: render `en` as the technical fallback
  and ask for a choice at the next safe entry point.
- Missing translation key: fall back to the same key in `en`, record only the
  key/resource version in diagnostics, and never show the key itself in release
  UI.
- Do not fall back between Traditional Chinese and Simplified Chinese.

## Storage and privacy

Future database work:

- constrain `users.lang` to `('en', 'zh-Hant')`;
- add an explicit-choice timestamp/version;
- add an owner-scoped `update_language_preference(p_language)` RPC;
- revoke broad direct language writes from mobile roles;
- include language in onboarding transaction and account restoration;
- retain the preference in account export and remove it during internal account
  deletion with the owning `users` row.

Language is account preference data, not sensitive birth/chart data. RLS must
still prevent cross-user reads and writes. Analytics may record only the locale
code and translation resource version, never email, user-entered copy, or other
profile fields in the same event.

## Application integration points

First launch:

- mount the language authority before user-facing copy;
- show a stable Language Choice screen when no explicit choice exists;
- then continue to signed-out Home/Auth.

Settings:

- add Language under Profile/Settings only after its UX is approved;
- show the active value and save through the protected RPC;
- apply a confirmed change without restarting the app.

Auth and system states:

- Auth, magic-link, restoring, logout, offline, permission, loading, and error
  states consume the same locale authority;
- deep-link/cold-start handling must wait for preference hydration before
  presenting copy, without delaying credential exchange;
- safe error classification remains code-driven, then translated locally.

Account restoration:

- `loadSupabaseAccountState` returns the authoritative locale;
- restoration applies locale with chart, Persona, focus, and reflections in one
  visible state update;
- a temporary restore failure keeps the current device language and never
  changes account authority.

## Resource and version architecture

Recommended source layout:

```text
apps/mobile/src/i18n/
  index.ts
  types.ts
  resources/en.ts
  resources/zh-Hant.ts
  safety/en.ts
  safety/zh-Hant.ts
apps/mobile/src/services/languagePreference.ts
apps/mobile/src/providers/LanguagePreferenceProvider.tsx
```

Use typed, semantic keys such as `auth.magicLink.sent.title`, not English
sentences as keys. Every release has one immutable resource version, for
example `2026.08.1`. Both locale bundles must contain the same key set.

Resources ship with the app so Auth, offline, permission, and safety responses
do not depend on a network request. Remote copy experiments must not override
safety, privacy, deletion, payment, or authentication language.

## AI and safety interaction

The backend must load the signed-in user's language rather than trust a client
prompt field for authoritative safety output.

- Fixed `zh-Hant` and English safety/out-of-scope responses remain deterministic
  server templates.
- Chat routing returns a safe response key/code; the backend selects the
  approved locale template.
- AI prompts may receive the locale code only after authentication and profile
  resolution.
- Missing or unsupported locale uses the approved English safety template.
- Traditional Chinese output means standard written `zh-Hant`, not Cantonese
  colloquial text and not Simplified Chinese.
- A model-generated translation must never replace fixed crisis, privacy,
  account deletion, or authentication copy.

## Exact future source scope

Expected mobile changes:

- `apps/mobile/index.ts`
- `apps/mobile/App.tsx`
- `apps/mobile/src/services/accountState.ts`
- `apps/mobile/src/services/localDemoSession.ts`
- `apps/mobile/src/services/languagePreference.ts` (new)
- `apps/mobile/src/providers/LanguagePreferenceProvider.tsx` (new)
- `apps/mobile/src/i18n/**` (new)
- `apps/mobile/src/screens/LumisHomeScreen.tsx`
- `apps/mobile/src/screens/LumisAuthScreen.tsx`
- `apps/mobile/src/screens/LumisProfileScreen.tsx`
- `apps/mobile/src/components/AuthSystemKit.tsx`
- every active user-facing screen migrated from literal copy to typed keys.

Expected backend changes:

- one forward migration for language constraints, explicit-choice metadata, and
  the protected update RPC;
- onboarding/profile RPC input for a new account's explicit choice;
- `supabase/functions/chat-message/index.ts` for server-owned response locale;
- fixed localized safety/router resource modules;
- account export/deletion contracts.

## Required future tests

- first launch requires an explicit choice;
- supported device locale preselection and unsupported-locale fallback;
- signed-out persistence across app restart;
- new-account preference adoption;
- returning server preference wins over stale device preference;
- Settings update success, failure rollback, and concurrent-device behavior;
- owner, cross-user, and anonymous RPC/RLS checks;
- logout retains only non-sensitive device preference;
- same-email restore applies locale with all account state;
- missing-key parity and English fallback;
- every Auth/system/safety state in both locales;
- no raw technical errors before or after locale hydration;
- accessibility labels, dynamic type, layout, and screen-reader language;
- internal deletion/export treatment;
- migration upgrade for legacy users without an explicit-choice marker.

## Migration and rollback

Migration must be additive and forward-safe:

1. add explicit-choice metadata;
2. add/validate the locale constraint after auditing current values;
3. create the protected RPC;
4. update onboarding/restoration contracts;
5. deploy code behind a disabled feature flag;
6. run staging RLS, restore, first-launch, and device tests;
7. enable only after both locale bundles pass key parity.

Rollback must disable the feature flag and render the bundled English fallback.
Do not drop `users.lang`, its preference timestamp, or audit evidence during an
emergency rollback. Correct bad data with a forward migration.

## Open decisions before implementation

- exact first-launch Language Choice visual/copy;
- one-time treatment of legacy `zh-Hant` defaults;
- whether Settings language follows account across all devices immediately;
- approved translation owner and review/sign-off process;
- typography/font packaging and device QA for both scripts;
- analytics event names and retention.
