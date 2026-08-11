# S2-T302 Dice signed-off-screen live-result adapter

Status: `SOURCE_READY_UI_SLOT_NOT_AUTHORIZED`

The mobile service seam validates a question locally, accepts only a `fixture_id` at the gateway boundary, and projects the closed v0.3 response into validation, loading, interpretation, safety, fallback, or retry states. Gateway construction requires both runtime switches and an accepted checksum-bound authority envelope. The default Founder route supplies neither and therefore remains zero-network.

## Product boundary

`DiceRitualScreen` and `LumisDiceScreen` are byte-locked to T297. The signed-off ritual currently exposes only the post-result `onReflect(chatDraft)` navigation callback; it does not expose an approved pre-submit interception point or inline interpretation slot. T302 attaches a disabled adapter check to that existing external DEV callback and stops with `SAFE_STOP_DICE_INTERPRETATION_INTERFACE_SLOT_NOT_AUTHORIZED`. It does not invent customer UI or change navigation.

## Founder check

Run `pnpm start:s2-t302-dice-live-result-expo`. The external Founder rail can exercise EN01, ZH08, and ZH09. ZH08 remains a bundled-question rejection; ZH09 reaches the disabled live gate. The product frame is the unchanged signed-off ritual.

No deployment, provider traffic, persistence, units, or remote action is authorized. `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY` and `NO_AZURE_TRAFFIC_AUTHORITY` remain exact.
