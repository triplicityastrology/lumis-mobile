# S2-T30 Knowledge Bank Draft Intake Regression Corpus

Status: development-only, inactive structural regression boundary.

The corpus exercises the accepted S2-T25 validator using synthetic structural
placeholders. The canonical Knowledge Bank v0.2 workbook remains the first
development draft for natal-only work and may be refined after natal testing.
This corpus neither rewrites the workbook nor evaluates or authors astrology
meanings.

Approved structural coverage includes `natal_core`, `natal_deep`, and
non-executing `timing_future`. Rejection coverage includes duplicate IDs and
set keys, malformed language and capability fields, missing metadata, unknown
scope tags, Dice, Solar Return, transit, timing execution, Vertex, annual
themes, generated interpretation, provider credentials, and PII-like fields.

Successful output is limited to the versioned metadata manifest: record ID,
record type, scope tags, language, review status, content version, and
capability requirements. Authored draft fields are never emitted. Failures
contain only stable code, reason, and location fields.

There is no workbook mutation, Chat/AI or Knowledge Bank retrieval, user
exposure, provider call, persistence, UI, migration, deployment, billing, or
Dice integration.
