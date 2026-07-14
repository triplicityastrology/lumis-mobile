# Golden Chart QA

The signed Cloudflare Worker chart integration must pass a golden chart accuracy set before founder/product QA treats chart output as reliable.

## Current Status

The scaffold is in `packages/astrology/src/golden-charts.ts`.

Current cases are intentionally marked `pending_reference` until expected positions are filled from a trusted astrology source:

- Hong Kong full birth time smoke case
- Hong Kong unknown birth time precision case
- London daylight-saving full birth time case
- New York daylight-saving full birth time case

Run the fixture-shape check with:

```bash
pnpm run test:golden
```

## Required Before Accuracy QA

For each ready case, fill:

- expected sign
- expected degree
- tolerance in degrees
- house only when birth time is known and the expected house is reliable

Unknown-birth-time cases must not assert Ascendant or house placement.

## Integration Target

Once `/profile` calls the signed Cloudflare Worker wrapper, the Worker `chart_v2` output should be compared with these fixtures through `compareGoldenChartCase`.

Do not call astrology-api.io directly from mobile or Supabase. Use the signed Cloudflare Worker wrapper.
