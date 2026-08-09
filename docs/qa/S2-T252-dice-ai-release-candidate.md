# S2-T252 Dice AI release candidate

Status: `SOURCE_ONLY_DEFAULT_OFF_ZERO_TRAFFIC`

Authority remains exactly `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY` and `NO_AZURE_TRAFFIC_AUTHORITY`.

## Integrated authority

- T246 exact-state Founder evidence boundary and real Dice presentation.
- T247 fixture-ID-only server gateway, v0.3 prompt/response, DefaultV2 projection and provider deadline.
- T248 checksum-bound 80 Technical plus 40 reserved Founder registry.
- T249 inert live-window controls and metadata-only evidence boundary.

The Edge route now consumes the reviewed T248 Technical IDs through a server-only adapter. Reserved Founder IDs remain unavailable until a reviewed question is frozen into the registry. The mobile app cannot send question text, provider configuration or member context to this route.

## QA return

`developmentNoPersistence` now removes the Past Rolls action, does not append session roll history, and cannot construct `DiceHistorySheet`. The ordinary member path retains its existing history behavior.

## Review gates

1. Run `pnpm test:s2-t252-dice-ai-rc`.
2. Confirm the source hashes in `config/s2-t252-dice-ai-release-candidate.json`.
3. Review T247 gateway and T248 registry against the T249 cap interface.
4. Do not deploy or enable traffic from this branch. Deployment and any synthetic traffic require their separately reviewed receipts.

## Founder preview

Browser: `pnpm start:s2-t252-dice-web`, then open `http://localhost:8136`.

Simulator: `pnpm start:s2-t252-dice-simulator`.

Both routes are local synthetic previews with zero provider calls, zero units, zero persistence and no Dice history access.
