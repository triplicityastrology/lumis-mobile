# Founder Mobile Dice Live Candidate

This SSD branch uses the established customer Dice route. It validates the sealed Founder question before rolling, keeps the three landed results on Dice, and projects a validated interpretation into the existing scrollable result card. `Roll again` and explicit `Reflect in Chat` retain their existing behavior.

## Current authority

- Technical-80 evidence is accepted and bound by SHA-256.
- The Founder 40 live window receipt must be accepted and unexpired when the launcher starts.
- Mobile transport fails closed with `DICE_LIVE_AUTHORITY_REQUIRED` until that receipt digest is bound by the launcher.
- The mobile request is closed to `fixture_id`, `planet_id`, `sign_id`, and `house_id`.
- Mobile receives no Azure configuration, provider diagnostics, raw prompt, or raw provider envelope.

## Launch after the separate Founder receipt is accepted

From this worktree, run after T348 has written the protected current-receipt pointer:

```bash
pnpm start:founder-live-mobile-dice -- --lan
```

The launcher reads the staging public anon credential and Founder public-key reference from macOS Keychain, validates the accepted Technical-80 evidence and signed Founder receipt, then starts a local server-owned relay on port `8223` and Expo on port `8222`. The phone sends only `fixture_id`, `planet_id`, `sign_id`, and `house_id`; the short-lived receipt and public credential never enter the mobile bundle. For Simulator, replace `--lan` with `--ios`.

The pre-login route renders the real customer Dice screen. A narrow build marker sits outside product pixels. The signed Dice result-card source is checksum-protected and unchanged by T349.

## Physical iPhone path

1. Put the Mac and iPhone on the same LAN and keep the accepted T348 Founder window active.
2. Run `pnpm start:founder-live-mobile-dice -- --lan` from this worktree.
3. Open the printed `exp://` QR in Expo Go.
4. Enter an exact question from the sealed 20 EN / 20 zh-Hant bank, roll, and wait on the Dice page.
5. Confirm the three landed symbols remain visible, the interpretation arrives in the existing scrollable result card, and `Roll again` / explicit `Reflect in Chat` remain reachable.

Do not describe this as Founder Testing Available until a real interpretation has returned on the physical iPhone. T349 performs no provider call itself.
