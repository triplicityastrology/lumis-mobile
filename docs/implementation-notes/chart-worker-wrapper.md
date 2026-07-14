# Signed Cloudflare Chart Worker Wrapper

Decision: mobile should use Supabase as its source of truth, while reusing the website's existing Cloudflare chart calculation path.

Existing website Worker reference:

`/Users/rubyku/Documents/Website Chart/worker.js`

Important: use the signed Cloudflare Worker wrapper. Do not call astrology-api.io directly from the mobile app or Supabase Edge Functions.

Relevant website routes:

- `POST /natal-chart`
- `POST /natal-chart-child`
- `POST /get-chart`
- `POST /store-chart`
- `POST /solar-return-data`

For mobile, do not call the current public website routes directly from the app. Instead:

```text
Mobile app
  -> Supabase POST /profile
    -> signed Cloudflare Worker endpoint, e.g. POST /mobile/natal-chart
      -> astrology-api.io
    -> Supabase stores birth_data, raw_chart_json, chart_v2, ai_profiles
```

Supabase Edge Function configuration:

```text
CHART_WORKER_URL=https://...workers.dev
CHART_WORKER_ENDPOINT=/mobile/natal-chart
CHART_WORKER_SIGNING_SECRET=shared_hmac_secret
CHART_WORKER_TIMEOUT_MS=15000
LUMIS_ENV=staging
```

If `CHART_WORKER_URL` or `CHART_WORKER_SIGNING_SECRET` is missing, `/profile` intentionally saves a fixture chart and marks `raw_chart_json.status = fixture_worker_not_configured`. If both are present, `/profile` calls the Worker before writing onboarding data. Worker failures return `CHART_WORKER_FAILED` and do not create a partial profile.

Signed mobile request headers:

```text
X-Lumis-Signature-Version: v1
X-Lumis-Timestamp: unix_ms
X-Lumis-Signature: sha256=<hmac_sha256(timestamp + "." + raw_json_body)>
X-Lumis-Request-Id: uuid
X-Lumis-User-Id: supabase_user_uuid
```

Mobile Worker request body:

```json
{
  "user_id": "supabase-user-uuid",
  "calculation_version": "mobile_natal_v1",
  "request_id": "uuid",
  "requested_at": "2026-07-14T00:00:00.000Z",
  "client": {
    "source": "lumis_mobile_supabase",
    "environment": "staging"
  },
  "birth_data": {
    "name": "Ruby",
    "birth_date": "1986-02-20",
    "birth_time": "16:55",
    "time_unknown": false,
    "place_name": "Hong Kong",
    "country_code": "HK",
    "lat": 22.3193,
    "lng": 114.1694,
    "tz_str": "Asia/Hong_Kong"
  }
}
```

Expected Worker response:

```json
{
  "chart_v2": {
    "version": "chart_v2",
    "precision": "full",
    "source": "triplicity_cloudflare_worker",
    "calculatedAt": "2026-07-14T00:00:00.000Z",
    "planets": [],
    "houses": [],
    "angles": {}
  }
}
```

The mobile wrapper should reuse:

- astrology-api.io payload construction
- Placidus `P`
- Tropical zodiac
- active points: Sun through Pluto, Chiron, True_Node, Ascendant, Medium_Coeli
- precision 2 for natal
- Solar Return payload later
- Salesforce Case creation pattern, with mobile-specific field values/source labels
- Google Sheets row append pattern, with mobile-specific columns/source labels
- existing non-blocking behavior where external logging happens after the chart response when possible

The mobile wrapper should not reuse:

- Stripe routes
- website KV as source of truth for the mobile app
- public CORS behavior
- returning provider debug payloads to clients

Unknown birth time rule:

- The unknown birth time toggle is confirmed.
- Mobile should send `time_unknown=true` and `birth_time=null` through Supabase.
- The chart worker can use a deterministic fallback hour only if required by the provider contract, but the stored mobile chart/profile must remain marked as lower precision / unknown birth time.
- Unknown-time charts should not expose Ascendant/house precision as reliable.
- The stored mobile `chart_v2` for unknown-time charts must have no Ascendant, no MC, empty `houses`, and no planet house placements.

Chart storage decision:

- Preferred: versioned chart/profile storage using `birth_data_history`, `ai_profiles.chart_version`, and `chat_threads.chart_version`.
- MVP acceptable fallback: overwrite the active chart/profile if this is safer for first staging integration.
- If MVP overwrite is used, keep the code boundary clear so versioning can be restored before production/birth-detail change release.

Golden chart QA requirement:

- A golden chart accuracy set is required before chart integration can pass QA.
- The set should include known inputs, expected planetary/sign/degree outputs, timezone/place assumptions, and unknown-birth-time cases.
- Mobile chart integration must compare signed Worker output against the golden set before founder/product QA is asked to trust chart results.

Open implementation decision:

- Whether to add `/mobile/natal-chart` to the existing Worker or create a smaller dedicated Worker. A dedicated Worker is cleaner; extending the existing Worker may be faster if deployment ownership is already set up.
