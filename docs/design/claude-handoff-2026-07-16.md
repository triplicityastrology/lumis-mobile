# Claude Design Handoff - 2026-07-16

Latest Technical preservation checklist:
[`claude-fable-preservation-inventory-2026-07-21.md`](./claude-fable-preservation-inventory-2026-07-21.md)

Source package: `Astro Mobile App (1).zip`, supplied by Ruby on 2026-07-16.

The package is a high-fidelity web reference. Production screens must be rebuilt
as Expo React Native components; the HTML must not be embedded in a WebView.

## Confirmed Native Requirements

- Four main tabs: Chat, Insights, Dice, Profile.
- Credits appear only in Profile and Paywall, never in Chat, Home, or Past Reflections.
- Restored authenticated accounts load their existing chart and reflections.
- Unknown birth time hides ASC, MC, houses, and planet-house claims.
- English and Traditional Chinese copy use Lumis terminology.
- Navy and Warm themes remain supported design options.
- Navy uses the supplied celestial dusk background and reduced-motion behavior.
- Past Reflections is the only user-facing conversation-history term.

## Port Status

- Native celestial background component: implemented for Home, Chat, and Past Reflections.
- Chat/Home/Past Reflections billing-label removal: implemented.
- Restored-account routing and persisted reflection loading: scaffolded.
- Full native onboarding fidelity: pending screen-by-screen port.
- Persistent four-tab navigation: pending.
- Dice, notification sheet, message actions, and Paywall fidelity: pending.
- Self-hosted Newsreader, Hanken Grotesk, Noto Serif TC, and Noto Sans TC fonts: pending.
- Warm-theme native background: pending.

## Verification Rule

Use the supplied 390x844 screenshots for visual comparison. Product QA should
begin only after the priority native screens have been ported and checked at
phone and desktop-web preview sizes.
