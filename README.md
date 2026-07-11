# Lumis Mobile

Expo React Native + Supabase monorepo for the Lumis mobile app.

## Source Of Truth

Active product and copy decisions live in the Google Drive project docs, especially:

- `00_FILE_INDEX.md`
- `02_Product_UI_UX/UI UX Content v2.gdoc`
- `02_Product_UI_UX/AC-UX-02_Claude_Design_Change_Brief_v2.md`
- `03_Core_Technical/AC-TECH-06_Chart_Generation_Mobile_Implementation_Guide.docx`

User-facing language must use Lumis terminology:

- `Lumis` / `星伴 Lumis`
- `Lumis Persona` / `星伴相處模式`
- `Acceptance` / `接納`
- `Spark` / `啟發`
- `Awareness` / `覺察`
- `credits` / `運算點數`
- `Lumis Essential`
- `Lumis Prime`

Internal compatibility names such as `buddy_name`, `/buddy`, `BUDDY-*`, `role`, and `units` may remain temporarily in API/schema code, but they must not leak into user-facing UI copy.

## Repo Shape

```text
apps/mobile                 Expo React Native app
packages/shared             Shared types, product config, terminology
packages/astrology          Chart API client and chart_v2 mapping helpers
packages/billing            Billing and credit constants/helpers
supabase/functions          Supabase Edge Functions
supabase/migrations         Postgres schema and RLS migrations
tools                       Test/import utilities
docs/implementation-notes   Technical handoff notes
```

## First Build Assumptions

- iOS first, Android-compatible.
- Supabase is the mobile source of truth for auth, Postgres, RLS, and Edge Functions.
- Chart generation goes through Supabase `/profile`, which calls a signed Cloudflare Worker wrapper based on the existing Triplicity website chart Worker.
- Billing structure is scaffolded now; live RevenueCat/App Store purchases are deferred.

