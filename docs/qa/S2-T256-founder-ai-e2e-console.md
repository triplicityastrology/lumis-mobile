# S2-T261 Founder AI console correction

## Boundary

This development-only console speaks three closed, versioned interfaces without importing or calling a gateway:

- `dice-synthetic-registry-v0.3.0` for exactly 40 reserved Founder Dice IDs, split 20 EN and 20 zh-Hant.
- `dice_interpretation_response_v0_3`, admitted only through `founder_ai_gateway_evidence_v2` after checksum verification against accepted Dice Technical evidence.
- `s2_t261_founder_verdict_v2` for checksum-bound ratings and verdicts.

Draft text exists in component memory only. Deterministic local preflight rejects language mismatch, bundled questions, private-looking data, professional/safety requests, and the five Dice exclusions before a candidate can be frozen. All 40 slots, exactly 20 EN and 20 zh-Hant, must be complete before a checksum package can be prepared. A frozen candidate has zero provider calls, persistence writes, and units. It is only `locally_frozen_pending_review`; external Technical validation, classification and eligibility remain required.

Bundled records are only `offline_preview` or `not_yet_run`. The console contains no accepted Dice Technical evidence checksum, so it cannot display `live_synthetic`. Structurally plausible or self-signed evidence is rejected; a live record requires a source allow-listed accepted evidence SHA-256, the independently recomputed same SHA-256, the fixed T248 registry checksum, and an accepted status. The eventual runtime request is exactly `{ "fixture_id": "..." }`; question text is never a runtime input.

Companion/Chat remains visibly disabled. It requires accepted Dice Technical evidence first and then separately accepted Companion authority. Reviewing offline fixtures cannot enable `chat-synthetic`, connect `chat-message`, or advance either authority:

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`

## Founder path

1. Open Dice and choose English or Traditional Chinese.
2. Draft one synthetic, customer-realistic question containing no person or account data.
3. Select **Validate** for local preflight, then **Freeze next slot** until all 40 slots are complete.
4. Prepare the fixture checksum package for external Technical validation and classification.
5. Technical determines eligibility and separately runs an ID-only synthetic request.
6. A live synthetic result appears only after checksum-bound accepted Dice Technical evidence is compiled into the console boundary.
7. Rate all nine approved dimensions and choose pending, accepted, or returned.
8. Prepare the verdict checksum package. No action in this console sends either package anywhere.

Browser:

```bash
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s2-t261-work"
pnpm start:s2-t261-founder-ai-review-web
```

Open `http://localhost:8138`. The launcher refuses a wrong branch, dirty tracked tree, occupied port, missing full build marker, missing Dice intake marker, or missing Chat gate marker.

Simulator:

```bash
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s2-t261-work"
pnpm start:s2-t261-founder-ai-review-simulator
```

Both launchers display the exact full commit and `dice-founder-intake` state. Neither launcher kills processes, installs packages, contacts Supabase/Azure, or changes release navigation.
