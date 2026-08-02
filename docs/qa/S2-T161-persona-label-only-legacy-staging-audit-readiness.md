# S2-T161 Persona Label-Only Legacy Staging Audit Readiness

Status: source-ready and unrun. The ordinary command is inert and makes zero network calls.

This packet implements only the discovery requested by Business Systems v1.1 / Authority Reconciliation v0.2 and the S2-T159 compatibility matrix. It counts three known persistence boundaries and returns four classifications: stable role code, accepted legacy alias, unknown label-only value, and null/empty. It never returns the underlying labels, users, rows, identifiers, timestamps, or payloads.

Future evidence must match `s2_t161_persona_legacy_selection_audit_v1`, exact staging ref, exact packet checksum, the three closed boundary names, non-negative integer counts, `read_only_rolled_back`, and `migration_authorized: false`.

An accepted envelope informs a later migration decision. It does not authorise a migration, rewrite historical evidence, activate Persona behavior, or change current product labels.
