# S2-T275 Technical Dice window

## Current status

The controller is source-ready and inert. `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY` and `NO_AZURE_TRAFFIC_AUTHORITY` remain in force. It cannot begin a network run without both an accepted T267-bound default-off deployment receipt and a separate Microsoft Technical traffic authorization.

```sh
node scripts/s2-t275-dice-technical-window.mjs
```

The expected current stop is `WAITING_FOR_ACCEPTED_DICE_DEFAULT_OFF_DEPLOYMENT_RECEIPT`. After deployment evidence exists but before traffic authority, the stop is `WAITING_FOR_MICROSOFT_DICE_TECHNICAL_TRAFFIC_AUTHORITY`.

## Fixed scope

- 80 Technical fixtures only: 40 English and 40 Traditional Chinese.
- Founder 40 are prohibited.
- At most 160 provider attempts, concurrency two, one eligible retry, and one shared 12-second deadline per fixture.
- `o200k_base` limits remain 800 input and 300 output tokens in the sealed T267 gateway.
- Sanitized prices are USD 0.25 input and USD 2.00 output per million tokens. The Technical maximum is `160 * ((800 * 0.25 + 300 * 2) / 1,000,000) = USD 0.128`.
- Evidence is metadata-only and retained for 30 days by the gateway authority. It contains fixture ID, language, result class, counters, duration, and redacted failure class only.

## Kill and recovery boundary

Source/package drift, stale/replayed authority, a Founder fixture, cap overflow, unsafe evidence, provider authentication/permission failure, invalid retry behavior, or failure to restore disabled state stops the run. Disable executes in `finally`; a disable or post-window proof failure overrides ordinary completion. No subsequent phase is authorized by a Technical evidence package.

## Offline proof

```sh
node scripts/s2-t275-dice-technical-window-contract.mjs
node scripts/s2-t275-dice-technical-window-emulator.mjs
```

This executes all 80 IDs through a zero-network Azure-protocol emulator, validates ordered closed evidence, and proves final disablement. It is not Azure evidence and grants no deployment or traffic authority.
