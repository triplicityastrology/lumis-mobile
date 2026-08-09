# S2-T248 Dice synthetic fixture registry

Status: `SOURCE_ONLY_NO_PROVIDER_TRAFFIC`

The server-only registry exports exactly 80 fixed Technical cases (40 EN and 40 zh-Hant) and 40 reserved Founder IDs (20 EN and 20 zh-Hant) through `dice_synthetic_fixture_registry_export_v1`. Its canonical payload SHA-256 is `43cccc009f15a43c1801bd090234540e474a6cb20a1a48aa3a3bcd9b86a1a030`.

## Founder preparation

The development-only screen uses the real React Native Dice ritual beneath an external fixture-control panel. Drafts are local memory only. Freeze validates one synthetic question, language, reserved ID and private-data boundary; it does not save, send, consume units or create a provider request.

Review every frozen question for astrological sense, question intent, usefulness, tone, EN/zh-Hant quality, vagueness, repetition, overconfidence and safety. A frozen local draft is not approved for traffic. A later reviewed process must produce the allow-listed server export.

Browser: `pnpm start:s2-t248-dice-registry-web`, then open `http://localhost:8130`.

Simulator: boot an iOS Simulator, then run `pnpm start:s2-t248-dice-registry-simulator`.

## Boundaries

- No free-form Azure or provider route exists.
- No names, birth details, member/account/device identifiers or contact details are accepted.
- The mobile screen cannot import the server registry or provider authority.
- Release routing remains unchanged because selection requires both `__DEV__` and the explicit local flag.
- The T247-compatible interface is schema/documentation authority only; this task does not depend on T247 source.
