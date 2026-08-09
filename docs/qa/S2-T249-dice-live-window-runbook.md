# S2-T249 Dice synthetic live-window operator

Current authority remains exactly:

- `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`
- `NO_AZURE_TRAFFIC_AUTHORITY`

The operator is inert by default and performs no network, credential, deployment,
or provider action. It consumes the documented `dice_synthetic_gateway_port_v1`
interface after T247 integration; it does not import or depend on an in-progress
T247 branch.

The port exposes five server-only methods: `describe()`, `status()`,
`enableSyntheticWindow({run_id})`, `invokeFixture({interface_version, run_id,
fixture_id})`, and `disable({run_id})`. Inputs never contain question text. The
descriptor and result shapes are closed by the schemas under `supabase/tests`.

## Fixed window

The run contains 80 Technical fixtures first (40 EN, 40 zh-Hant). The 40 Founder
fixtures (20 EN, 20 zh-Hant) cannot begin until all 80 Technical evidence records
pass the closed validator. Server-side ceilings are 120 logical cases, 240 total
attempts, 800 input tokens and 300 output tokens per case, concurrency 2, one
eligible retry, and one shared 12-second deadline.

## Required future gates

1. Integrate and checksum-review T247 and T248 against the stable interface.
2. Microsoft/Azure reviews the integrated source and grants the bounded Dice
   synthetic window. Chat remains blocked.
3. Record current Azure prices in a closed `s2_t249_live_price_confirmation_v1`
   input with its reviewed hard window cap. The operator recalculates maximum
   cost before enabling anything. The existing USD20 budget alert is monitoring,
   not authorization or this hard cap.
4. Provide a single-use `s2_t249_dice_window_authorization_v1` bound to the exact
   gateway and registry SHA-256 values.
5. Preflight independently proves `LUMIS_AI_ENABLED=false`, provider access off,
   and route default-off. Any mismatch stops before the first fixture.

Future reviewed command:

```bash
pnpm dice:synthetic-window -- --execute \
  --gateway-module /reviewed/local/dice-synthetic-gateway-port.mjs \
  --registry /reviewed/local/dice-fixture-registry.json \
  --price /reviewed/local/live-price-confirmation.json \
  --authorization /reviewed/local/single-use-window-authorization.json \
  --evidence-output /reviewed/local/new-dice-window-evidence.json
```

Do not run that command until all four files are reviewed local artifacts and
Microsoft/Azure has explicitly advanced the Dice window.

## Immediate kill conditions

Any gateway/registry/source drift; preflight not disabled; stale/unconfirmed
price; absent or mismatched single-use authority; fixture order or language
imbalance; logical, attempt, token, concurrency, deadline, or retry breach;
unknown or private telemetry; unsafe DefaultV2 projection; malformed evidence;
or provider-disable/postflight failure stops the run. The evidence output must
not already exist; it is created mode `0600` only after successful postflight.
Once live state begins,
disable runs in `finally` before the stop is returned. Postflight must separately
prove `LUMIS_AI_ENABLED=false`, provider access off, and route default-off.

## Evidence boundary

Each accepted record contains only fixture ID, language, phase, result class,
bounded counters, attempt count, duration bucket, run ID, and allow-listed
redacted failure code. Prompt/response text, user/member/account/device data,
birth/chart data, endpoint, model, URL, keys, tokens, secrets, provider bodies,
and diagnostics are rejected. Metadata retention is controlled at 30 days.

Default readiness check:

```bash
pnpm dice:synthetic-window
```

Expected next action is `READY_FOR_T247_INTEGRATION_AND_MICROSOFT_REVIEW` with
zero network calls.
