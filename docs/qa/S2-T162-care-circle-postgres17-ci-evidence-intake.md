# S2-T162 Care Circle PostgreSQL 17 CI Evidence Intake

Status: `WAITING_FOR_AUTHORISED_CI_EVIDENCE`. No CI run, network access, staging action, or remote write occurred.

The closed envelope binds the accepted T157 workflow source commit, workflow checksum, Ubuntu runner, PostgreSQL 17.6 image, exact migration order and checksums for 0032, 0033, 0034, and 0037, every accepted proof assertion, rollback, and cleanup.

Logs, URLs, database hosts, row data, credentials, secrets, partial assertions, source drift, and remote data are rejected. A valid future envelope creates only a gitignored local receipt with status `database_proof_recorded`. That receipt explicitly keeps `staging_ready` and `remote_writes_authorized` false.

Recovery behavior is fail-closed: rejected evidence does not write or replace a receipt. Correct the CI evidence at its source and submit a complete new closed envelope for review.

