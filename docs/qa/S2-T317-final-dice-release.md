# S2-T317 Final Dice Release Candidate

This source-only integration combines the closed 40-item Founder registry, the Founder-owned public trust anchor, the disabled deployment package, the separately scoped migration 0039 and Technical-80 operators, and the approved interpretation states inside the existing Dice result card.

The app stays on Dice after a roll. The question and three landed symbols remain visible. Loading, interpretation, safety, fallback, and retry render in the existing result card. Long English and Traditional Chinese content scrolls, while **Roll again** and **Reflect in Chat** remain available. Chat navigation occurs only after the user explicitly taps **Reflect in Chat**. Request keys prevent an earlier response from replacing the latest roll.

The exact Founder registry contains 20 English and 20 Traditional Chinese fixtures. Only ZH04 is excluded. ZH08 remains the bundled-question rejection and ZH09 remains the accepted single-question control. Runtime admission requires exact fixture membership and exact question-text binding before transport construction.

Only `issuer_key_id` and the public SPKI SHA-256 fingerprint are source-controlled. No private key, custody path, operational signature, credential, or provider response belongs in this package.

Run:

```sh
pnpm dice:t317:readiness
```

The command reports only the separately required Founder-signed deployment, migration, and Technical-80 traffic receipts. It performs no signing, credential loading, CLI construction, network request, deployment, migration, or model call.

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`
