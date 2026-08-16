# S2-T357 Founder mobile Dice free text

T357 adds a Founder-only mobile request seam without changing the accepted fixture-only route. The explicit Founder route accepts an ordinary question only after the existing deterministic Dice pre-roll classifier accepts it. Rejected, bundled, safety, professional and excluded questions still stop before roll and before transport construction.

For each completed roll and retry, the Founder seam sends exactly `question`, `planet_id`, `sign_id` and `house_id` to a private-LAN `/dice-free-text` relay. It requires all three development switches plus an exact 64-character authority digest match. The mobile bundle receives no provider credentials. The future T359 integration owns the server relay, provider kill switch, quota enforcement and final launcher; T357 does not start a server or authorize traffic.

The established result card remains on Dice. Its loading state now reuses `ChatThinkingIndicator`; validated AC-DICE-09 content, scrolling, Roll again and explicit Reflect in Chat remain in place. Persistence, units and Dice history remain disabled for this Founder route.

Focused verification:

```sh
pnpm test:s2-t357-mobile-dice-free-text
node scripts/founder-live-mobile-dice-contract.mjs
node scripts/s2-accessibility-device-readiness-contract.mjs
```
