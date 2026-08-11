# S2-T311 Chat release candidate

Status: `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY` and `NO_AZURE_TRAFFIC_AUTHORITY`.

This candidate combines the accepted T240 response contract, T306 disabled mobile/server seam, and T299 Founder-only polished preview. The normal `App`, Chat service, thinking indicator, and confirmation-card files remain byte-identical. The new candidate is not imported by the normal product route.

## Closed path

1. Mobile submits one allow-listed `fixture_id`; free-form text and unknown fields are rejected.
2. Server expands the fixture into an EN or zh-Hant synthetic prompt only after source switches and three independently accepted evidence digests pass.
3. T306 performs auth/profile/policy checks and admits the provider only after every gate.
4. Completed or duplicate responses require the T240 atomic outcome. Safety, fallback, and technical outcomes persist nothing and charge zero units.

The three independent gates are accepted Dice Technical evidence, a disabled Chat deployment receipt, and a separate synthetic Chat traffic authorization. Runtime evidence alone cannot enable source constants.

## Founder test path

Run `pnpm start:s2-t311-founder-chat-expo` on port 8183. The screen is an offline synthetic preview with EN, zh-Hant, safety, fallback, and retry states. It is not live AI. Browser review uses `pnpm start:s2-t311-founder-chat-web` on port 8181; Simulator uses `pnpm start:s2-t311-founder-chat-simulator` on port 8182. Run `pnpm chat:t311:readiness` to see the exact next external gate.

No deployment, provider request, migration, normal Chat activation, member persistence, or unit charge is authorized by this package.
