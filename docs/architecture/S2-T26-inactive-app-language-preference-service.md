# S2-T26 Inactive App-Language Preference Service

Status: pure, mocked, inactive service boundary.

The service wraps the future owner-scoped
`update_app_language_preference` RPC boundary without importing Supabase or
creating a mobile caller.

## Contract

- accepts only `en` and `zh-Hant`;
- performs no write when constructed;
- writes only after explicit `savePreference`;
- requires online and authenticated preflight state;
- promotes success only when the returned language exactly matches the request;
- maps every outcome to a stable `LANGUAGE_PREFERENCE_*` code and fixed
  accessibility-safe announcement;
- never returns raw RPC, transport, SQL, token, email, or account data.

## Safe Outcomes

| Condition | Stable code | Saved claim |
| --- | --- | --- |
| Matching owner-scoped success | `LANGUAGE_PREFERENCE_SAVED` | Yes |
| Unsupported value | `LANGUAGE_PREFERENCE_INVALID` | No |
| Offline | `LANGUAGE_PREFERENCE_OFFLINE` | No |
| No authenticated account | `LANGUAGE_PREFERENCE_AUTH_REQUIRED` | No |
| Migration/RPC unavailable | `LANGUAGE_PREFERENCE_MIGRATION_UNAVAILABLE` | No |
| Unknown, thrown, or mismatched response | `LANGUAGE_PREFERENCE_SAVE_FAILED` | No |

## Preservation Boundary

The service receives no account, chart, Persona, focus, reflection, onboarding,
navigation, or UI state. It therefore cannot reset or mutate those authorities.
Mock fixtures preserve a frozen synthetic account snapshot across every result.

## Explicit Exclusions

- no selector screen, UI caller, navigation, or automatic write;
- no direct Supabase client or persistence implementation;
- no preference transmission to Chat; server-owned Chat preference remains
  authoritative;
- no translation or generated template;
- no provider/model, migration, deployment, staging, billing, Dice, or network
  test.

Future wiring requires separate implementation approval and must adapt the
deployed owner-scoped RPC into the injected update port.
