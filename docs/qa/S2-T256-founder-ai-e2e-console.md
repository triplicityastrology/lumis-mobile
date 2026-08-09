# S2-T256 Founder AI end-to-end console

## Boundary

This development-only console speaks three closed, versioned interfaces without importing or calling a gateway:

- `dice-synthetic-registry-v0.3.0` for exactly 40 reserved Founder Dice IDs, split 20 EN and 20 zh-Hant.
- `dice_interpretation_response_v0_3` and `chat_synthetic_response_v1`, projected through `founder_ai_gateway_evidence_v1`.
- `s2_t256_founder_verdict_v1` for checksum-bound ratings and verdicts.

Draft text exists in component memory only. Deterministic validation rejects language mismatch, bundled questions, private-looking data, professional/safety requests, and the five Dice exclusions before a candidate can be frozen. A frozen candidate has zero provider calls, persistence writes, and units. It is only `locally_frozen_pending_review`; it is not automatically admitted to a deployed registry.

Companion/Chat remains visibly disabled. Reviewing offline closed fixtures cannot enable `chat-synthetic`, connect `chat-message`, or advance either authority:

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`

## Founder path

1. Open Dice and choose English or Traditional Chinese.
2. Draft one synthetic, customer-realistic question containing no person or account data.
3. Select **Validate**. Review the deterministic language and judgment/descriptive classification.
4. Select **Freeze next slot**. Repeat as needed up to 20 slots per language.
5. Prepare the fixture checksum package for later Technical review.
6. Review safe offline or later closed live-synthetic evidence. Rate all nine dimensions and choose pending, accepted, or returned.
7. Prepare the verdict checksum package. No action in this console sends either package anywhere.

Browser:

```bash
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s2-t256-work"
pnpm start:s2-t256-founder-ai-review-web
```

Open `http://localhost:8138`. The launcher refuses a wrong branch, dirty tracked tree, occupied port, missing full build marker, missing Dice intake marker, or missing Chat gate marker.

Simulator:

```bash
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s2-t256-work"
pnpm start:s2-t256-founder-ai-review-simulator
```

Both launchers display the exact full commit and `dice-founder-intake` state. Neither launcher kills processes, installs packages, contacts Supabase/Azure, or changes release navigation.
