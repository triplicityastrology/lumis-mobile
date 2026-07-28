# S2-T08A Care Circle Staging Evidence Runbook

Status: unrun, disabled by default, and staging-only.

## Safety Boundary

- Exact project: `bmqhwofmdgebpcihjlnb`.
- Only one disposable Caree and six disposable Carers created by the harness.
- Existing/founder accounts are never accepted as inputs.
- Evidence contains only a redacted run ID and assertion names.
- Never capture emails, JWTs, credentials, pairing codes, fingerprints, user
  IDs, database payloads, or screenshots of terminal input.
- No migration apply, function deploy, provider, scheduler, notification,
  billing, or app activation command belongs to this runbook.
- No provider is configured or contacted, and no notification is sent.

## Local Preflight

This is the only currently authorised command:

```bash
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work"
"/Users/rubyku/.local/node22/bin/pnpm" test:s2-care-circle-staging-evidence
```

It validates source and plan files and performs no network/database action.

## Future Execute

Do not run until PM separately confirms that migrations `0032` and `0034` and
the inactive `care-circle` function are present in staging.

```bash
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work"
"/Users/rubyku/.local/node22/bin/pnpm" evidence:s2-care-circle:secure -- --execute
```

The wrapper verifies the exact staging ref and requests both credentials using
hidden terminal input. Credential values are not printed, stored, or placed in
command history.

The future run covers reusable one-hour pairing, six pending Carers,
Caree-only consent, concurrent sixth acceptance, replay/conflict,
expiry/rotation/revocation, pause/resume/remove, RLS, safe projections,
legacy direct-RPC denial, and deletion cascade.

## Evidence Capture

Save only the final redacted JSON containing:

- suite name;
- run ID;
- passed assertion names.

Do not save terminal scrollback containing prompts or any failed response body.

## Failure Cleanup

The execute run prints a run-ID-only cleanup command. Use that exact value:

```bash
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work"
"/Users/rubyku/.local/node22/bin/pnpm" evidence:s2-care-circle:secure -- --execute --cleanup REDACTED_RUN_ID
```

Cleanup finds only Auth users tagged with that suite and run ID and removes
their cascading records. It never accepts an arbitrary user ID.

## Forward-Only Recovery

Migrations `0032` and `0034` are forward-only. If later staging evidence fails:

1. keep the Care Circle UI static and inactive;
2. do not deploy or invoke the operation function from mobile;
3. preserve redacted audit evidence;
4. repair with a later corrective migration/function version;
5. never reverse consent direction or re-enable legacy direct mutation RPCs.
