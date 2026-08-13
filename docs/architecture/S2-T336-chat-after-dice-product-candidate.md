# S2-T336 disabled Chat-after-Dice product candidate

T336 adds one mobile-only candidate above the accepted T331 root. It can consume only the exact T331 corrected Dice acceptance envelope whose independently computed SHA-256 matches the compiled acceptance binding. Both source activation constants remain false, so evidence parsing, Reflect payload parsing, transport construction, member context, persistence, charging, providers, and telemetry are unreachable.

The Reflect boundary is an explicit user action with the closed payload `action`, current `question`, exactly three `results`, and `interpretation`. Receiving Dice results does not navigate or invoke Chat. A per-turn latch rejects a second AI call.

The candidate projects EN and zh-Hant loading, completed, fallback, safety, and technical-error states. Completed/fallback/safety/technical responses pass through the T240 validator. Safety and fallback retain the exact T240 messages; technical errors retain no assistant message and use localized presentation copy that states nothing was saved or charged.

`FounderPolishedChatExperience.tsx` and normal Chat remain byte-for-byte unchanged. T336 launchers expose only the existing prelogin, dev-only polished screen with backend environment values cleared. No server route, deployment operator, provider configuration, member activation, persistence, charging, or public route is added.
