# S2-T341 Chat product integration release candidate

Status: `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY` and `NO_AZURE_TRAFFIC_AUTHORITY`.

This candidate moves the accepted T240 response projection into the real `App.tsx` Chat send boundary. It does not add a Founder-only product screen and does not alter the rendered Chat JSX, typography, colors, navigation, or message controls.

## Runtime boundary

- Normal source switches remain compiled `false` and cannot be enabled by mobile environment variables.
- Disabled mode stops before transport construction. It does not call `chat-message`, Supabase, Azure, persistence, charging, or member-context APIs.
- `EXPO_PUBLIC_T341_CHAT_LOCAL_FIXTURE=1` is accepted only with `__DEV__`. It seeds a synthetic in-memory profile, opens the real Chat route, and returns local projections with zero credits and `not_persisted` status.
- T240 completed/duplicate responses require the existing atomic committed shape. Fallback, safety, and technical errors remain zero-effect.
- A future activation must supply independently accepted Dice evidence and separately reviewed Chat integration, deployment, and traffic authorities.

## Dice handoff

The existing Dice `Reflect in Chat` press is the only entry. The draft is parsed into a closed question/results/interpretation payload, then placed in the Chat composer. Opening Chat never submits the draft. The user must press Send; the boundary admits one client-turn ID and local fixture duplicates converge on one promise.

## Local product verification

```bash
pnpm start:s2-t341-chat-product -- --simulator
```

Set `T341_CHAT_FIXTURE_STATE` to `completed`, `fallback`, `safety`, or `technical_error`. These are local deterministic projections, not live AI evidence.
