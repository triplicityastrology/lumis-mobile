# S2-T271 Founder Companion/Chat Window

## Status

This development-only, pre-login Founder preparation build is reconciled into T281's runtime-corrected `chat_synthetic_gateway_port_v1`. Its Dice prerequisite is the closed T272 runtime/T279 Technical-window v2 envelope, and it preserves the accepted T240 response contract without connecting normal Chat.

The committed allow-lists for accepted Dice evidence, Chat-window authorization, execution evidence, and post-window disabled proof are all `null`. Embedded records are only `offline_preview` or `not_yet_run`. The build cannot create a `live_synthetic` record, call a provider, enter `chat-message`, persist text, read member context, or charge units.

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`

## Founder journey

1. Choose **Companion** or **Normal Chat**. These are separate synthetic review sets; neither is customer routing.
2. Choose English or Traditional Chinese, draft one synthetic question, validate it locally, and freeze it into the next source-controlled fixture ID.
3. Complete 15 slots for each surface/language combination, producing 60 closed fixtures: Companion EN 15, Companion zh-Hant 15, Normal Chat EN 15, Normal Chat zh-Hant 15.
4. Prepare the fixture checksum. Question text is present only in this local preparation export; later runtime requests contain exactly `fixture_id`.
5. Import the separately reviewed 80-case Dice technical evidence. A structurally valid self-authored envelope is reported as valid-but-not-accepted; it cannot unlock execution.
6. After future source acceptance, generate the Chat-window authorization request and invoke only a closed fixture ID. Those controls are disabled in this commit.
7. Review a verified response, rate EN/zh-Hant quality, verify the post-window disabled proof, and export a checksum-bound verdict. Current response examples are visibly labeled offline previews.

The Companion set is for reflective response style. The Normal Chat set is for ordinary Chat projection style. Both use synthetic questions only and remain separate from member conversations.

## Browser

```bash
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s2-t281-work"
pnpm start:s2-t281-founder-chat-web
```

Open `http://localhost:8151`. The launcher uses `expo export --dev`, checks the exact full Git SHA and Founder route markers, refuses a dirty tracked tree, and never kills an occupied port.

## iOS Simulator

Boot the configured iPhone 17 Simulator with Expo Go, then run:

```bash
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s2-t281-work"
pnpm start:s2-t281-founder-chat-simulator
```

Metro uses port `8152`. The screen has one safe-area owner, one vertical scroll owner, keyboard dismissal, 48–50 point controls, wrapping rating rows, and full-SHA evidence outside product-style response pixels.

## Verification

```bash
pnpm test:s2-t281-chat-final-request
pnpm --dir apps/mobile typecheck
pnpm test:mobile-ui
pnpm test:s2-accessibility
pnpm test:pii
pnpm verify:mobile-native-bundle
git diff --check
```

No browser or Simulator action is proof of provider execution. A future live synthetic result requires independently accepted, checksum-bound execution evidence and a separately accepted post-window disabled proof.
