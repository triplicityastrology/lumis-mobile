# S2-T285 Founder Dice intake

## Test now

The development-only console accepts local text for exactly 20 English and 20 Traditional Chinese synthetic questions. Each question is validated before it can be frozen. The final local package contains the fixed fixture ID, normalized text, per-question SHA-256, deterministic route, and zero-effect declaration.

Browser:

```sh
pnpm start:s2-t285-founder-dice-intake-web
```

Open `http://localhost:8153`. The launcher uses a development export, verifies the full current Git SHA and T285 route markers, and refuses a dirty tree, stale server, wrong branch, or normal Auth fallback.

iPhone 17 Simulator:

```sh
pnpm start:s2-t285-founder-dice-intake-simulator
```

The launcher uses port `8154`, terminates only Expo Go on the explicitly selected Simulator to avoid a stale bundle, and starts the exact current source.

## Authoring and freeze

1. Select EN or zh-Hant and an available numbered slot.
2. Enter one synthetic customer-style question with no names, contact details, account/device IDs, birth data, URLs, or professional/crisis request.
3. Validate, then freeze. Repeat until the counter is 40/40 with 20 per language.
4. Prepare the fixture checksum and rating sheet.
5. For the local server-held registry handoff, pipe the exported JSON envelope to:

```sh
pnpm dice:founder-intake:freeze < founder-intake-envelope.json > founder-server-registry.json
```

The runtime boundary accepts `fixture_id` only. Question text is never a runtime request field.

## Truthful gate

The validation, loading, interpretation, safety and fallback states are local deterministic presentation fixtures. They are not live Azure evidence. Live invocation remains impossible until both an accepted 80-case Technical evidence package and a separate Founder-window receipt are compiled into the acceptance boundary.

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`
