# Signed Cloudflare Chart Worker Wrapper

Decision: mobile should use Supabase as its source of truth, while reusing the website's existing Cloudflare chart calculation path.

Existing website Worker reference:

`/Users/rubyku/Documents/GitHub/triplicity-astrology/src/pages/shop/worker.js`

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

The mobile wrapper should reuse:

- astrology-api.io payload construction
- Placidus `P`
- Tropical zodiac
- active points: Sun through Pluto, Chiron, True_Node, Ascendant, Medium_Coeli
- precision 2 for natal
- Solar Return payload later

The mobile wrapper should not reuse:

- Stripe routes
- website KV as source of truth
- Salesforce/Sheets/email blocking side effects
- public CORS behavior
- returning provider debug payloads to clients

Open implementation decision:

- Whether to add `/mobile/natal-chart` to the existing Worker or create a smaller dedicated Worker. A dedicated Worker is cleaner; extending the existing Worker may be faster if deployment ownership is already set up.

