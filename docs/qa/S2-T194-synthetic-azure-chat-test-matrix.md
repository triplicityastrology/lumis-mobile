# S2-T206 Offline Normal-Chat Synthetic Proof

Status: `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY` and
`NO_AZURE_TRAFFIC_AUTHORITY`.

The canonical matrix and executable harness share exactly 14 versioned
`CHAT-SYN-v1-NNN` identifiers. Contracts compare both directions: every matrix
row must execute, and every executable case must have one matrix row.

Every emitted response is validated against the canonical mobile response
schema. Multi-actor and concurrent cases contain multiple ordinary
`completed`/`duplicate` responses; redaction remains internal evidence metadata
and never creates a public `completed_redacted` result.

The cases cover atomic success, unknown request fields, aggregate-context
overflow, content-filter block and partial, actor-scoped idempotency,
post-receipt ambiguity, concurrent duplicates with one provider call, one
bounded retry, no retry for 401 or 403, transaction rollback, PII/log redaction,
and unsafe-bypass rejection.

All inputs are closed synthetic classes rather than member text. The provider is
a local stub; network is disabled. Evidence is limited to case ID, named result,
provider-call count, persistence result, unit result, and redaction result. It
contains no prompt, response, identity, endpoint, credential, row, or private
context.

Passing this harness is source-contract evidence only. It does not authorize
source integration or Azure traffic.
