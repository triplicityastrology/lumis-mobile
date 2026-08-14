# Founder Mobile Dice Live Candidate

This SSD branch uses the established customer Dice route. It validates the sealed Founder question before rolling, keeps the three landed results on Dice, and projects a validated interpretation into the existing scrollable result card. `Roll again` and explicit `Reflect in Chat` retain their existing behavior.

## Current authority

- Technical-80 evidence is accepted and bound by SHA-256.
- The Founder 40 live window is not yet authorized or pinned.
- Mobile transport therefore fails closed with `DICE_LIVE_AUTHORITY_REQUIRED`; no Supabase function client is constructed from an incomplete gate.
- The mobile request is closed to `fixture_id`, `planet_id`, `sign_id`, and `house_id`.
- Mobile receives no Azure configuration, provider diagnostics, raw prompt, or raw provider envelope.

## Launch after the separate Founder receipt is accepted

From this worktree, set only the reviewed evidence digest in the shell and run:

```bash
FOUNDER_DICE_LIVE_WINDOW_EVIDENCE_SHA256=<accepted-sha256> pnpm start:founder-live-mobile-dice -- --lan
```

The launcher reads the staging public anon credential from macOS Keychain, validates the accepted Technical-80 receipt, uses SSD dependency/cache locations, and never prints the credential. For Simulator, replace `--lan` with `--ios`.

The launcher may be opened before live authority for product-layout review, but interpretation transport remains blocked. Do not describe that state as live AI.
