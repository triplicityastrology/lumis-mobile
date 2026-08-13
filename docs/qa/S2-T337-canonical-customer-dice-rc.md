# S2-T337 canonical customer Dice release candidate

## Source authority

T327 (`7767b69bef7e33f6aa898ca9a0c14ca2ce3b7c12`) is the base because it directly contains T322's real-screen validation and the accepted runtime controls. T332 was reviewed for its closed product-flow and SSD-launcher contracts, but its Founder-only wrapper is intentionally not integrated.

## Founder device path

1. From this worktree run `pnpm start:s2-t337-customer-dice -- --simulator` or replace `--simulator` with `--lan` for Expo Go.
2. Enter through the normal Lumis product flow and open Astrology Dice.
3. Use an exact frozen registry question, for example `What should I do next weekend?`.
4. Tap Ready, then throw. The existing animation and three-result presentation remain unchanged.
5. Confirm the result card shows loading and then the local deterministic interpretation. Scroll within the existing card to reach Roll again and Reflect in Chat.
6. Confirm the screen stays on Dice. Chat opens only after tapping Reflect in Chat.

Set `FOUNDER_T337_FIXTURE_STATE` to `completed`, `safety`, `fallback`, or `technical_error` before launching to inspect each no-provider state. This is local visual confirmation, not live AI evidence.

## Boundaries

- Exact 20 English and 20 Traditional Chinese registry membership is required.
- Rejected questions stop before animation, transport, history, persistence, units, or navigation.
- Throw history/session writes and persistence are disabled in this candidate.
- The local fixture controller cannot create a provider or network client.
- No deployment, Supabase mutation, Azure call, unit charge, or live authority is claimed.
