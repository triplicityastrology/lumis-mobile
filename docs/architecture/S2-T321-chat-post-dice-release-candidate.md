# S2-T321 Chat/Companion post-Dice release candidate

## Status

- `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`
- `NO_AZURE_TRAFFIC_AUTHORITY`
- No deployment, migration, provider request, persistence, or unit charge occurred.

## Product boundary

The normal Chat route and branded Chat components are unchanged. The T321 source is not imported by normal Chat. Its two source switches remain `false`.

Dice stays on the Dice screen while its interpretation loads. The existing **Reflect in Chat** press is the only navigation trigger. At that moment the draft contains the question, planet, sign, house, and only the interpretation belonging to the current roll. Receiving or refreshing an interpretation never navigates automatically.

## Required evidence order

1. Verify the built-in exact T317 source binding: commit `8706db6cadbbf4ae0a58d10a194479a0c7aca465`, tree `edf01652aa245cc1bc202f3e3cee677b074a2565`, package `690879d6df3ecfd33a0a62ee0833f3bc278cfa11a2ab4062b8eba9eb659c1075`, and reviewed manifest `1ef44fd42677e98fc3edd49e2e7ba6abf1257dbbfe9cdf597b68c0ae9239ef84`.
2. Import checksum-bound accepted Technical evidence for exactly 80 cases, 40 EN and 40 zh-Hant, with the provider disabled afterward. The source package alone is not execution evidence.
3. Separately authorize and record a default-off `chat-synthetic` deployment with four `CHAT_AI_DISABLED` probes and zero provider/model calls.
4. Separately authorize a single-use, fixture-ID-only synthetic Chat window.
5. Make a separately reviewed source change to both disabled switches.

Current readiness is `WAITING_FOR_ACCEPTED_T317_DICE_TECHNICAL_EVIDENCE`. After that evidence is accepted, separate Chat default-off deployment authority and separate Chat synthetic traffic authority remain mandatory. No client can be constructed while either source switch is disabled.

## Founder preview

The existing T311 Founder route provides EN and zh-Hant customer-like prompts, thinking, completed, safety, fallback, and retry states. It is an offline preview and is not live AI evidence.

```sh
pnpm start:s2-t321-founder-chat-expo
```
