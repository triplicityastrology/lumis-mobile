# S2-T331 Founder Chat disabled-state runbook

Run `pnpm start:s2-t331-founder-chat-expo` from the clean T331 branch after Git durability is restored.

1. Confirm the external strip shows the full T331 commit, `offline fixture`, and `live_authority=false`.
2. Select EN, then Traditional Chinese. In each language submit a reviewed prompt and observe loading followed by the local result.
3. Select Safety and submit in each language. Confirm the existing safety presentation and zero remote activity.
4. Select Fallback and submit in each language. Confirm fallback and Retry remain usable; retry returns to local compose state.
5. Use the explicit Dice **Reflect in Chat** action in its separate product-path check. Confirm interpretation completion alone never opens Chat.
6. Repeat at the largest Dynamic Type setting with the keyboard visible. Confirm the existing UI remains readable and controls remain reachable.

Expected for all ten EN/zh loading/result/safety/fallback/retry projections: provider calls `0`, persistence writes `0`, and units charged `0`. Do not enter credentials or member data. Do not deploy, activate traffic, or run a provider/network test from this package.
