# S2-T159 Persona Selection Compatibility Audit

Status: inactive source/schema discovery only. No migration, data rewrite, UI rename, provider call, deployment, or remote database access was performed.

## Canonical compatibility map

| Current label | Historical label | Persisted legacy key | Stable backend role code |
| --- | --- | --- | --- |
| Ordinary Person | Acceptance | `acceptance` | `empathetic_peer` |
| Friend | Spark | `spark` | `harmonious_catalyst` |
| Mentor | Awareness | `awareness` | `saturnian_anchor` |

Current labels resolve to stable role codes at the compatibility boundary. Existing Acceptance, Spark, and Awareness evidence, rows, and historical request snapshots remain unchanged and keep their legacy keys. New behavior calculation and prompt assembly use the stable backend role code.

## Boundary inventory

| Classification | Current boundaries | Finding |
| --- | --- | --- |
| Stable role code | `packages/shared/src/config/persona-calculator.ts`; `supabase/functions/_shared/persona-behavior-v1.ts` | The deterministic v1 calculator and server behavior assembler use the three stable codes. The calculator accepts exact public labels only as compatibility aliases and returns a stable code. |
| Legacy-label-compatible persistence | migrations `0002`, `0006`, `0008`, `0009`, `0011`, `0017`, `0020`, `0022`; `apps/mobile/src/services/accountState.ts`; `apps/mobile/src/services/profile.ts`; `apps/mobile/src/services/chat.ts`; `apps/mobile/src/services/localDemoSession.ts`; `supabase/functions/chat-message/index.ts` | `persona_style` is an established public-selection and historical chat snapshot contract. It is owner-scoped by the surrounding account/chat boundaries. It is not the new deterministic behavior role identity. |
| Display only | `packages/shared/src/terminology/lumis.ts`; `apps/mobile/App.tsx`; `apps/mobile/src/copy/lumis.ts`; `apps/mobile/src/screens/LumisProfileScreen.tsx`; `apps/mobile/src/dev/personaComparisonFixture.ts` | These surfaces present the approved public names and promises. They do not author the stable backend identity. |
| Legacy internal role | migration `0017`; `supabase/functions/profile/index.ts` | Values `support`, `spark`, and `growth` predate the v1 stable role codes. They remain historical compatibility values and must not be mistaken for `empathetic_peer`, `harmonious_catalyst`, or `saturnian_anchor`. |
| Analytics | Repository-wide source/schema search | No active general analytics SDK or Persona analytics pipeline was found. Migration `0017` creates entitlement provider events only; those events contain no Persona selection. |
| Unknown | None | No unresolved Persona persistence or analytics boundary was found in the inspected source. |

## New-write rule

1. Existing `persona_style` columns and request snapshots may continue to read and preserve the legacy keys.
2. A new persistence or analytics/event boundary must use a canonical field such as `persona_role_code` and allow exactly the three stable role codes.
3. A new boundary may additionally carry a legacy/public selection key only when compatibility requires it; the label key cannot be the sole persisted identity.
4. Historical rows, fixtures, and evidence are not rewritten by this rule.
5. User-facing output continues to use approved public names, never raw stable codes.

## Migration verdict

No migration is required now. The existing schema deliberately stores a three-value public selection and already restores it safely. A future migration would be justified only when a real persisted behavior-profile or Persona analytics/event entity is approved; that new entity must store the stable role code from creation. Backfilling or rewriting current `persona_style` history would add risk without enabling the accepted deterministic runtime.

## Evidence reviewed

- Shared terminology and calculator configuration under `packages/shared/src`.
- Mobile selection, save, restoration, local-demo, Chat request, display, and development comparison boundaries under `apps/mobile`.
- Profile and Chat Edge Function request/mapping boundaries under `supabase/functions`.
- Every migration containing `persona_style`: `0002`, `0006`, `0008`, `0009`, `0011`, `0017`, `0020`, and `0022`.
- Repository event/analytics searches for Persona-bearing tracking or event payloads.
