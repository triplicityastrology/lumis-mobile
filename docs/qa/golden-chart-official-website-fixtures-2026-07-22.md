# Golden Chart Official Website Fixtures

Date: 2026-07-22  
Audience: Technical AI, QA AI  
Status: PM-approved source path for golden chart fixture creation

## Purpose

Golden chart QA must compare the Lumis mobile chart pipeline against trusted expected astrology outputs, not only against structural tests.

Ruby confirmed that the existing Triplicity Astrology website chart result links are the most accurate current source for the first golden cases. These records are stored behind the existing website Cloudflare Worker and can be retrieved programmatically.

Technical and QA should use the official website Worker response as the source of truth for the expected golden chart values.

## Retrieval Method

Use the existing website Worker endpoint:

```bash
curl -sS -X POST https://api.triplicityastrology.com/get-chart \
  -H 'Content-Type: application/json' \
  -d '{"session_id":"SESSION_ID_HERE"}'
```

The response should include:

- `chartData.subject_data`
- `chartData.chart_data.planetary_positions`
- `chartData.chart_data.house_cusps`
- `chartData.chart_data.aspects`
- `inputData`
- `paid_tier`

Do not call `astrology-api.io` directly for fixture generation. The official website Worker/KV record is the reference.

Direct Cloudflare KV access is not required for this task. If the Worker endpoint stops returning the record, then a Cloudflare KV export or internal admin endpoint will be needed.

## Approved Golden Cases

### Case 1: Hong Kong Full-Time Chart

Official result:

https://triplicityastrology.com/chart/result?session=TRI-BOOK-TEST-TRI-20260622-9986

Worker session:

```text
TRI-BOOK-TEST-TRI-20260622-9986
```

Retrieved official input:

| Field | Value |
|---|---|
| Fixture label | Golden Fixture HK-01 |
| Birth date | 1986-09-27 |
| Birth time | 06:30 |
| Birthplace | Hong Kong |
| Nation | HK |
| Latitude | 22.27832 |
| Longitude | 114.17469 |
| Timezone | Asia/Hong_Kong |
| Zodiac | Tropic |
| House system | Placidus (`P`) |
| Perspective | Apparent Geocentric |

Spot-check values from Worker:

| Point | Expected |
|---|---|
| Sun | Libra 3.53, absolute longitude 183.53, house 12 |
| Moon | Cancer 12.29, absolute longitude 102.29, house 10 |
| Ascendant | Libra 6.57, absolute longitude 186.57 |
| MC / Medium Coeli | Cancer 6.52, absolute longitude 96.52 |
| House count | 12 |

### Case 2: Malaysia Full-Time Chart

Official result:

https://triplicityastrology.com/chart/result?session=TRI-BOOK-TRI-20260630-4884

Worker session:

```text
TRI-BOOK-TRI-20260630-4884
```

Retrieved official input:

| Field | Value |
|---|---|
| Fixture label | Golden Fixture MY-01 |
| Birth date | 1978-10-04 |
| Birth time | 20:00 |
| Birthplace | Rompin, Negeri Sembilan, Malaysia |
| Nation | MY |
| Latitude | 2.7083 |
| Longitude | 102.5047 |
| Timezone | Asia/Kuala_Lumpur |
| Zodiac | Tropic |
| House system | Placidus (`P`) |
| Perspective | Apparent Geocentric |

Spot-check values from Worker:

| Point | Expected |
|---|---|
| Sun | Libra 10.93, absolute longitude 190.93, house 6 |
| Moon | Scorpio 8.17, absolute longitude 218.17, house 7 |
| Ascendant | Taurus 5.80, absolute longitude 35.80 |
| MC / Medium Coeli | Aquarius 0.64, absolute longitude 300.64 |
| House count | 12 |

### Case 3: Shenzhen Full-Time Chart

Official result:

https://triplicityastrology.com/chart/result?session=TRI-MP8H8JK0-DUT7&tri=P4nW7vR

Worker session:

```text
TRI-MP8H8JK0-DUT7
```

Retrieved official input:

| Field | Value |
|---|---|
| Fixture label | Golden Fixture SZ-01 |
| Birth date | 1986-09-28 |
| Birth time | 00:30 |
| Birthplace | Shenzhen, Guangdong, China |
| Nation | CN |
| Latitude from `inputData` | 22.54554 |
| Longitude from `inputData` | 114.0683 |
| Latitude from `chartData.subject_data` | 22.5733235 |
| Longitude from `chartData.subject_data` | 114.0575822 |
| Timezone from `inputData` | blank |
| Timezone from `chartData.subject_data` | Asia/Shanghai |
| Local datetime | 1986-09-28T00:30:00+08:00 |
| UTC datetime | 1986-09-27T16:30:00+00:00 |
| Zodiac | Tropic |
| House system | Placidus (`P`) |
| Perspective | Apparent Geocentric |

Important QA note:

For this case, `inputData.tz_str` is blank, but `chartData.subject_data.tz_str` is populated as `Asia/Shanghai`. Golden fixture generation should use the calculated chart metadata from `chartData.subject_data` as the authoritative resolved timezone/calculation context.

Technical should also investigate why `inputData` and `chartData.subject_data` contain slightly different Shenzhen coordinates. For fixture comparison, the expected chart values should still come from the official stored `chartData` response unless PM later decides to regenerate this case.

Spot-check values from Worker:

| Point | Expected |
|---|---|
| Sun | Libra 4.27, absolute longitude 184.27, house 3 |
| Moon | Cancer 21.31, absolute longitude 111.31, house 1 |
| Ascendant | Cancer 16.24, absolute longitude 106.24 |
| MC / Medium Coeli | Aries 8.41, absolute longitude 8.41 |
| House count | 12 |

## Calculation Assumptions Confirmed By PM

Use the following assumptions for these three official website-backed golden cases:

| Setting | Decision |
|---|---|
| Zodiac | Tropical |
| House system | Placidus |
| Perspective | Geocentric natal |
| Birth time | Known birth time |
| Unknown-time/noon mode | Not used for these three cases |

Unknown-time coverage is still required separately before production. It should verify no Ascendant, no MC, empty or absent houses, and no planet house placements end to end.

## Comparison Tolerances Confirmed By PM

| Field type | Tolerance |
|---|---|
| Planet absolute longitude | within `0.1°` |
| Planet sign | exact |
| Planet house | exact for known-time charts |
| Ascendant absolute longitude | within `0.2°` |
| MC / Medium Coeli absolute longitude | within `0.2°` |
| House cusp absolute longitude | within `0.2°` |
| House cusp sign | exact |

## Technical Tasks

1. Fetch the official expected records from `POST https://api.triplicityastrology.com/get-chart` using the session IDs above.
2. Convert the Worker response into golden fixtures under the existing astrology test structure.
3. Prefer storing only the required expected values in fixtures, not full raw provider payloads, unless Technical needs full raw data for debugging.
4. Include expected values for all major chart points used by mobile:
   - Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto;
   - Chiron and True Node if used by the app;
   - Ascendant and MC for known-time charts;
   - 12 house cusps;
   - planet house placements.
5. Compare the mobile signed Worker output against the official expected values using the PM-approved tolerances.
6. Keep `astrology-api.io` provider calls behind the signed Cloudflare Worker path. Mobile must not call the provider directly.
7. For the Shenzhen case, document whether the fixture uses `chartData.subject_data` coordinates/timezone as the authority. Current PM direction is to use the official stored `chartData` response.

## QA Tasks

1. Verify the `/get-chart` retrieval still returns valid records for all three sessions.
2. Confirm the fixture generator did not accidentally use stale screenshots or manually copied values.
3. Confirm the generated fixtures mark these three cases as ready/approved only after values are populated from the official Worker response.
4. Run the golden comparison tests against the mobile chart Worker output.
5. Check failure output is readable enough to identify which planet, angle, house cusp, sign, or house assignment mismatched.
6. Confirm the Shenzhen timezone/coordinate caveat is visible in test notes so future reviewers are not surprised by the blank `inputData.tz_str`.
7. Keep the separate unknown-time golden case open until an approved unknown-time reference is added and tested.

## Acceptance Criteria

This golden-chart batch passes only when:

- the three official website sessions are fetched successfully;
- expected fixture values are generated from Worker/KV-backed official website records;
- mobile signed Worker chart output matches the expected values within the agreed tolerances;
- signs and house assignments match exactly;
- the Shenzhen timezone caveat is documented;
- QA records the pass/fail result in the go-live checklist.

## Source References

- Website Worker endpoint: `https://api.triplicityastrology.com/get-chart`
- Website Worker source reference: `/Users/rubyku/Documents/Website Chart/worker.js`
- Website chart workflow handoff: `/Users/rubyku/Documents/Website Chart/Adult Chart Generation Workflow Handoff.md`
- Mobile repo golden test area: `/Users/rubyku/Documents/Mobile App/lumis-mobile/tools/golden-tests`
- Existing mobile golden chart scaffold: `/Users/rubyku/Documents/Mobile App/lumis-mobile/packages/astrology/src/golden-charts.ts`
- Go-live checklist: `/Users/rubyku/Documents/Mobile App/lumis-mobile/docs/qa/go-live-checklist.md`
