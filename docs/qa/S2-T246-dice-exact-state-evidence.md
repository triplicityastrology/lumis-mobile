# S2-T246 Dice exact-state evidence

Status: local synthetic Founder evidence only. No Azure, Supabase, provider, unit, persistence, or remote Dice-history operation is permitted.

## Founder browser review

```bash
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s2-t246-work"
pnpm start:s2-t246-dice-gallery
```

Open `http://localhost:8128`. The product-adjacent strip must show the full committed build SHA and selected state. The default state is the pre-roll `hi` rejection.

## Simulator capture

```bash
pnpm start:s2-t246-dice-simulator
pnpm capture:s2-t246-dice -- question_validation
pnpm pack:s2-t246-dice-evidence
```

Repeat capture for the 13 closed states in `config/s2-t246-dice-exact-evidence.json`. The tool refuses stale bundle hashes, incorrect routes or markers, blank/loading/error frames, wrong product evidence, wrong dimensions, duplicate states, duplicate images, and any non-zero effect receipt. Evidence is written outside Git under `/Users/rubyku/Documents/Mobile App/S2-T246-Dice-Exact-Evidence` with `human_verdict=pending`.

The Simulator proves layout and deterministic local state rendering only. It is not live AI evidence.
