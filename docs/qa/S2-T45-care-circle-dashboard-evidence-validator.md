# S2-T45 Care Circle Dashboard Evidence Validator

Status: local-only pre-write control. It does not query Supabase, revise the
blocked migration packets, or authorize a Dashboard write.

The validator accepts one closed JSON envelope containing count-only and
metadata-only evidence from the controlled S2-T39/T40 review. It validates the
exact staging ref, restored-backup capture/deletion window, legacy counts,
captured migration-history column shape, remote migration parity, exact pending
order `0032 -> 0033 -> 0034`, and a rollback rehearsal with zero persisted
changes.

A pass confirms that the redacted evidence package is structurally complete; it
does not approve or invent a history insert. Technical must still review the
captured column names and revise the blocked S2-T40 packets separately.

Unknown fields and keys suggesting rows, IDs, email, tokens, pairing material,
payloads, connection details, or credentials are rejected. Output is limited to
`S2_T45_DASHBOARD_EVIDENCE_PASS` or one stable `STOP_S2_T45_*` code.

Local validation only:

```bash
pnpm test:s2-care-circle-dashboard-evidence
```

The checked-in JSON is synthetic contract data, not staging evidence. A later
manually prepared redacted envelope must be independently reviewed before use.
