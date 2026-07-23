# Backend and Privacy Handoff - 2026-07-23

Audience: Technical AI, QA AI, PM/security

## Account-Deletion Queue Hardening

Source:

- `supabase/migrations/0028_safe_account_deletion_status_refresh.sql`
- `supabase/migrations/0029_safe_account_deletion_enqueue_result.sql`
- `supabase/functions/account-deletion-request/index.ts`
- `scripts/staging-backend-smoke.mjs`

`0028` replaces direct JSON text-to-UUID conversion with a guarded lookup
against the user's existing deletion request. `0029` removes the remaining
JSON text-to-integer conversion from the enqueue result and derives the
external event count from authoritative rows.

The staging Edge Function may return a database diagnostic code/message only
when `LUMIS_ENV=staging`. Production responses remain generic.

Local evidence:

```text
pnpm test:external-sync
external sync contract checks passed
```

Staging gate:

- `0028` is deployed.
- Apply `0029`.
- Deploy `account-deletion-request`.
- Run the dedicated-key hosted deletion race and cleanup suite.
- The dedicated `sb_secret_` key must pass Auth Admin preflight before a hosted
  run ID or disposable user is created.

## Golden-Reference Privacy

Current repository state no longer stores:

- source customer names or email addresses;
- official website result URLs containing source lookup tokens;
- official website session identifiers in documentation, JSON artifacts,
  generator source, or live-test output.

Offline expected calculations remain in
`packages/astrology/src/official-website-golden-cases.json`. Protected source
identifiers are needed only when refreshing the artifact and are entered
through:

```text
pnpm test:golden:refresh:secure
```

The secure wrapper uses hidden input and does not write identifiers to the
artifact or command history. `pnpm test:pii` scans documentation and golden
sources for real-looking email addresses, identity fields, result URLs, and
website session-token patterns. It is included in `test:all-local` and CI.

Local evidence:

```text
pnpm test:pii
repository PII scan passed

pnpm test:golden
passed
```

History gate:

- Commit `09fecf0` contains the original identities and lookup tokens.
- Forward redaction commit `7cfe21a` removed names/emails from the current file.
- This batch removes lookup tokens from the current repository state.
- PM/security must decide whether to rewrite Git history and whether the source
  website records/session identifiers should be invalidated or rotated.
- Do not rewrite shared history without a coordinated maintenance window and
  fresh clones on every development Mac.

## Second-Mac Testing

Setup guide:

- `docs/setup/other-mac-expo-go-setup.md`

Verification command:

```text
pnpm setup:check
```

The setup doctor checks Node 22, pnpm policy, Expo SDK 54, React Native/React
versions, installed dependencies, staging mobile configuration, the Dice
ritual flag, and accidental backend-secret leakage. A test-only Mac does not
need database, Supabase secret, Cloudflare, or provider credentials.

## Combined Local Verification

The following passed on 2026-07-23:

- `pnpm setup:check`
- `pnpm typecheck`
- `pnpm test:all-local`
- JavaScript and shell syntax checks for the modified scripts
- `git diff --check`

Physical iPhone, hosted PostgreSQL, external destinations, and unknown-time
golden-reference acceptance remain separate gates.
