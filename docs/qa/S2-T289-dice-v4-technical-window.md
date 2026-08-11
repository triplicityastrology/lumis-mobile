# S2-T289 Dice v4 Technical Window

The Founder approved the `lumis_dice_default_off_function_deployment_authorization_v4` receipt design. This is receipt-design authority only. It does not authorize deployment, migration 0039, Azure traffic, normal Chat integration, member data, or public use.

The active package binds runtime package `be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457` and the T283 PostgreSQL proof receipt `0e4fcfafddf9f1bf9fb02868d895fa4c4f8164980613908bc97d08cf2ecb9b9e`.

Execution requires, in order, an accepted v4 post-deployment disabled receipt, an accepted separately scoped migration 0039 receipt, and an accepted single-use Microsoft `DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY` receipt. The controller permits exactly 80 Technical fixtures, 40 EN and 40 zh-Hant, at most 160 attempts, concurrency 2, one eligible retry within a shared 12-second deadline, 800 input tokens, 300 output tokens, and USD 0.128. Founder fixtures are prohibited.

The provider is disabled in `finally`, followed by a disabled-state verification. Local evidence is metadata-only and is not live proof.

Current authority remains `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY` and `NO_AZURE_TRAFFIC_AUTHORITY`.
