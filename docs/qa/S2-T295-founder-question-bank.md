# S2-T295 Founder question bank

This development-only intake preserves all 41 Founder-supplied questions exactly: 20 English and 21 Traditional Chinese. English entries are locally frozen for review. Traditional Chinese entries remain unfrozen until Founder selects one exclusion from the 19 eligible entries. `ZH08` is the bundled-question test and `ZH09` is its single-question control; neither can be excluded.

The visible gate says exactly: **21 supplied; select exactly one to exclude**. After one allowed choice, the local export contains 20 EN and 20 zh-Hant fixtures with per-question SHA-256 checksums. Runtime accepts `fixture_id` only and remains unavailable until independently accepted Technical evidence and a separate Founder-window authorization exist.

## Founder routes

```sh
pnpm start:s2-t295-founder-question-bank-web       # http://localhost:8163
pnpm start:s2-t295-founder-question-bank-simulator # Metro 8164
pnpm start:s2-t295-founder-question-bank-expo      # Expo Go LAN, Metro 8165
```

1. Confirm the full build SHA in the evidence strip.
2. Review English and Traditional Chinese side by side; question text is selectable.
3. Compare `ZH08` and `ZH09`; both are marked required controls.
4. Select exactly one of the other 19 zh-Hant entries to exclude.
5. Prepare and download the 20/20 review registry.

No command calls a provider, writes member data, charges units, or authorizes runtime traffic.

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`
