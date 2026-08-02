# S2-T162 Care Circle PostgreSQL 17 CI Evidence Intake

Status: `WAITING_FOR_AUTHORISED_CI_EVIDENCE`. No CI run, staging action, or remote write occurred.

The manual T157 workflow now writes one closed JSON proof artifact only after the PostgreSQL 17 proof and source-clean check pass. GitHub Actions signs that exact artifact with `actions/attest`, pinned to an immutable action commit. The workflow remains manual-dispatch and rejects remote database context.

Local receipt creation no longer accepts a JSON envelope directly. A future reviewer must download the attested artifact outside the repository and run `node scripts/s2-care-circle-postgres17-ci-evidence.mjs --verify-attested-artifact /absolute/path/to/artifact.json`. The operator invokes `gh attestation verify` with exact repository, signer workflow, source ref, source commit, signer commit, hosted-runner, and SLSA provenance constraints. Only the verified artifact digest and signed certificate claims may unlock receipt creation.

The closed evidence binds GitHub Actions run ID and attempt, repository, ref, commit, workflow path/checksum, immutable PostgreSQL image digest, migration order/checksums for 0032, 0033, 0034, and 0037, every required assertion, rollback, and cleanup. Logs, endpoint URLs, database hosts, rows, identifiers, credentials, secrets, mutable image tags, unknown fields, partial assertions, source drift, and replay are rejected.

A valid attestation creates only a gitignored local receipt with status `database_proof_recorded`; it explicitly keeps `staging_ready` and `remote_writes_authorized` false. A rejected or replayed artifact creates no receipt. GitHub CLI verification may contact GitHub only in the explicit future verification mode; default execution remains inert.
