# S2-T264 Founder Dice end-to-end journey

Status: `FOUNDER_ONLY_PRELOGIN_DEFAULT_OFF`. Base is exact T261 commit `9f36ca6386fd421de409e73d8399c88737909033`. The mobile boundary consumes only the checksummed, documented T257 interface contract. It does not import or copy T257 server source and has no later-candidate source dependency.

The celestial Founder console supports this closed sequence: select a reserved EN or zh-Hant slot, validate and freeze locally, hand the checksum package to external Technical for validation/classification, admit eligibility only from an independently accepted envelope, invoke through a `{ fixture_id }`-only seam, present a distinct `live_synthetic` result only after accepted checksum evidence, rate it, then prepare the checksum verdict.

No accepted Founder envelope is checked in. The only default presentations are `not_yet_run` and `offline_preview`; the gateway reports disabled/provider-access false. The route performs no member authentication, normal routing, history, persistence, unit charging, diagnostics, or secret handling.

## Now versus accepted live

| Checkpoint | This exact build now | A separately accepted live-synthetic window |
| --- | --- | --- |
| Fixture | Founder selects, validates, and freezes locally | Same externally accepted frozen fixture ID |
| Classification | Pending external validation/classification | Envelope says accepted with one closed classification |
| Eligibility | `not_eligible` | `eligible` after independent envelope and Technical evidence checksum matches |
| Gateway | Disabled; provider access false | Separately supplied compatible port reports enabled, provider access, and accepted envelope |
| Presentation | `not_yet_run` or clearly labelled `offline_preview` | `live_synthetic`, never an offline example relabelled |
| Effects | Zero auth, normal routes, persistence, and units | Still zero auth, normal routes, persistence, and units |
| Review | Offline preview may be rated | Accepted result may be rated and included in checksum verdict |

## Exact steps

1. Run `pnpm test:s2-t264-founder-dice`, `pnpm typecheck`, `pnpm test:mobile-ui`, `pnpm test:s2-accessibility`, and `pnpm test:pii`.
2. Run `pnpm start:s2-t264-founder-dice-web`; it requires the exact clean branch HEAD, exports web, verifies embedded journey/build markers, and serves only `http://localhost:8141`.
3. On a booted iOS Simulator with Expo Go, run `pnpm start:s2-t264-founder-dice-simulator`; Metro owns `8144` and opens the same pre-login route.
4. At normal and large text sizes, select EN and zh-Hant slots, validate/freeze one of each, inspect the external validation and eligibility states, and confirm invoke remains disabled.
5. Confirm offline outputs say `OFFLINE DEMO OUTPUT`, untouched fixtures say `not yet run`, ratings wrap without overlap, and the verdict export contains only fixture IDs, ratings, verdicts, build SHA, and checksum.
6. Stop only the launcher terminal with Ctrl+C. Do not stop or reuse an unrelated server.

## Failure map

Envelope failures are closed classifications: malformed object/fields, unaccepted envelope checksum, ineligible fixture, classification/language mismatch, unaccepted Technical checksum, or nonzero effects. The invoke seam stops when disabled or when returned evidence does not match the accepted fixture ID. Launchers stop on branch/tree drift, occupied dedicated ports, missing exact-build markers, absent booted Simulator, or absent Expo Go. Full names are closed in `config/s2-t264-founder-dice-e2e-manifest.json`.

## Large text and devices

The console switches rating rows to a vertical layout below 420 logical pixels or at font scale 1.2 and above. Console text and draft input honor Dynamic Type up to a 1.4 multiplier so labels remain readable without clipping fixed controls. Slot controls remain 42x42, command controls remain at least 48 high, content uses one vertical scroll, and horizontal fixture rails do not resize the page. Verify at iPhone SE and current iPhone portrait dimensions plus an accessibility text setting.

## Rollback

Run `git revert <S2-T264-commit>`. There is no data rollback because this route writes nothing. If an owned proof server is attached, press Ctrl+C in that launcher terminal; do not use process-wide kill commands.
