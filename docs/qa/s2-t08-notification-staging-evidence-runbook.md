# S2-T08B Notification Foundation Staging Evidence Runbook

Status: unrun, disabled by default, and staging-only.

## Safety Boundary

- Exact project: `bmqhwofmdgebpcihjlnb`.
- Only two disposable QA accounts created by the harness.
- Existing/founder accounts and real device tokens are never accepted.
- Test tokens use an unmistakable local dummy-token shape.
- Evidence contains only a redacted run ID and assertion names.
- Never capture credentials, access tokens, dummy tokens, fingerprints, emails,
  user IDs, database payloads, or screenshots of terminal input.
- No migration apply, function deploy, provider, scheduler, permission request,
  notification send, billing, or app activation command belongs to this runbook.
- No provider is configured or contacted, and no notification is delivered.

## Local Preflight

This is the only currently authorised command:

```bash
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work"
"/Users/rubyku/.local/node22/bin/pnpm" test:s2-notification-staging-evidence
```

It validates source and plan files and performs no network/database action.

## Future Execute

Do not run until PM separately confirms migration `0033` and the inactive
`notification-device` function are present in staging.

```bash
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work"
"/Users/rubyku/.local/node22/bin/pnpm" evidence:s2-notification:secure -- --execute
```

The wrapper verifies the exact staging ref and requests both credentials using
hidden terminal input. Credential values are not printed, stored, or placed in
command history.

The future run covers registry inactivity, owner/second-user/anonymous RLS,
concurrent registration, replay/conflict, installation rotation, logout, permission
revocation, provider-invalid and account-deletion removal, encrypted storage,
metadata allowlisting, and controlled-clock 90-day pruning. It never requests
device permission and never sends or schedules a notification.

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
"/Users/rubyku/.local/node22/bin/pnpm" evidence:s2-notification:secure -- --execute --cleanup REDACTED_RUN_ID
```

Cleanup finds only Auth users tagged with that suite and run ID and removes
their cascading records. It never accepts an arbitrary user ID.

## Forward-Only Recovery

Migration `0033` is forward-only. If later staging evidence fails:

1. keep Notifications and Care Circle static and inactive;
2. do not call the registration function from mobile;
3. do not configure any provider or delivery scheduler;
4. preserve redacted assertion evidence;
5. repair with a later corrective migration/function version.
