# S2-T25 Knowledge Bank Draft Structural Validator

Status: development-only, inactive structural boundary.

## Source Authority

The structural vocabulary was audited against:

`01_Functions/05_AI_Talk_Interpretation_Routing/03_Technical_Requirements/Lumis_Knowledge_Bank_Technical_Implementation_Base_v0.2_DRAFT.xlsx`

The workbook is the canonical working technical base for this first development
draft. It remains founder-review-required and does not authorise retrieval,
interpretation, deployment, or production use.

Relevant workbook structures include `Bank_Schema`, `Planets`, `Signs`,
`Elements_Modalities`, `Houses`, `Aspects`, `Chart_Patterns`,
`House_Status_Logic`, and `Question_Routing`.

## Closed Structural Contract

`knowledge_bank_draft_record_v0_2` accepts only:

- stable lowercase machine `recordId`;
- one closed record type;
- one or more `natal_core`, `natal_deep`, or `timing_future` scope tags;
- `en` or `zh-Hant` language;
- structurally complete `atomic_draft` content fields;
- source basis, review status, content version, capability requirements, and an
  optional source-rule version.

`timing_future` is metadata only. It never enables timing calculation,
retrieval, routing, ranking, or execution.

## Rejected Structures

- duplicate record IDs or duplicate tags/capabilities;
- unknown fields, record types, languages, or tags;
- Dice references;
- Solar Return, transit, timing execution, Vertex, or annual-theme scope;
- provider configuration, credentials, or API-key references;
- generated interpretation content.

The validator checks structure and prohibited scope markers only. It does not
author, rewrite, approve, score, compare, or evaluate astrology meanings.

## Safe Compilation

Successful validation produces only
`knowledge_bank_draft_manifest_v0_2`: sorted IDs, record types, scope tags,
language, review status, content version, and capability requirements.

Authored interpretation fields are deliberately omitted from the manifest.
Failures return only stable `KB_DRAFT_*` code, reason, and location values.
Neither result echoes workbook content.

## Inactive Boundary

This module has no workbook reader, provider, credential, network, storage,
Chat, AI, Knowledge Bank retrieval, UI, migration, deployment, billing, or Dice
integration. Tests use synthetic records only. The module is not exported from
the package entry point and is not user-reachable.
