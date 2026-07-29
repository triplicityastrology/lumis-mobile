# S2-T22 Natal Engine Regression Corpus

Status: inactive, pure, deterministic technical infrastructure.

This corpus protects the accepted natal-only lifecycle:

```text
provider_neutral_natal_v1
  -> natal_engine_input_v1
  -> natal_engine_output_v1
  -> natal_context_v1
```

It does not call an astrology provider, persist data, connect Chat or AI,
retrieve Knowledge Bank content, render UI, apply a migration, deploy, charge,
or integrate with Dice.

## Corpus Matrix

| Area | Deterministic evidence |
| --- | --- |
| Aspect orbs | Conjunction 8 degrees, sextile 4 degrees, square 8 degrees, trine 8 degrees, opposition 8 degrees, and quincunx 2 degrees |
| Orb edges | Every available lower and upper boundary is tested just inside, exactly on, and just outside the approved orb |
| Circular geometry | 359 degrees to 1 degree resolves to a 2-degree conjunction |
| Canonical aliases | `Sol`, `Luna`, `True Node`, and `South Node` map to stable canonical keys |
| Duplicate aliases | Two names resolving to the same canonical body fail closed |
| Timed chart | Houses and angles are available only with supplied birth time |
| No-birth-time chart | Houses, angles, house rulers, and other timed facts remain suppressed |
| Chat-safe points | Chiron, North Node, and South Node are retained only through the safe natal context boundary |
| Prohibited scope | Solar Return, transit, timing, Vertex, annual theme, and Dice contamination fail closed |
| Determinism | Repeating the same accepted synthetic input produces byte-identical context JSON |
| Privacy | The projected context contains no raw birth data, account/email identifiers, coordinates, provider payload, or Dice data |

## Fixture Ownership

- Executable corpus:
  `packages/astrology/src/natal-regression-corpus.fixtures.ts`
- TypeScript boundary:
  `packages/astrology/tsconfig.natal-regression-corpus-test.json`
- Static inactivity contract:
  `scripts/natal-regression-corpus-contract.mjs`

All records are synthetic. No customer chart, account, email, birth details,
provider response, credential, or staging resource is used.

## Acceptance Boundary

Passing this corpus means only that the pure inactive modules remain
deterministic and scope-safe. It does not approve:

- a chart provider or chart-source mapping;
- persistence or account restoration;
- Edge Function, Chat, AI, or Knowledge Bank integration;
- user-visible interpretation;
- billing, deployment, or production use.

Those remain separately controlled integration gates.
