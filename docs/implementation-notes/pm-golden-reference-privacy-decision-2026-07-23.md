# AC-ADMIN-14 — Golden Reference Privacy and Git History Decision

Date: 2026-07-23  
Decision owner: PM/security  
Status: Approved with conditions

## Git History

Leave the current Git history unchanged while the repository remains private
and access is limited to Rubie and trusted core project collaborators.

Commit `09fecf0` retains the original identities and lookup tokens in history,
although the current source is redacted and protected by the repository PII
guard.

Reopen and likely perform a coordinated history rewrite before any of the
following:

- making the repository public;
- sharing it outside the trusted core team;
- handing it to external developers.

A history rewrite requires a maintenance window, coordinated force update, and
fresh clones on every development Mac.

## Triplicity Website Session Identifiers

Do not invalidate the original Triplicity website chart session identifiers.
They refer to real client website records and cannot be revoked solely for
mobile golden-chart testing.

Required controls:

- Do not store real client names, emails, official result URLs, or session
  identifiers in the mobile repository, public documentation, screenshots,
  generated fixtures, or QA exports.
- Golden-reference refresh tools may accept identifiers only through hidden
  local input.
- Redacted fixtures remain the source used by mobile tests.
- Technical and QA request protected values directly from Rubie only when a
  fixture refresh is necessary.
- `pnpm test:pii` remains part of `test:all-local` and CI.

## Open QA

- The signed live Worker comparison has passed the three approved known-time
  reference cases.
- Unknown-time signed reference testing remains pending.
