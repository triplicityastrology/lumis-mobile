# S2-T97 staging birth-change quota reset evidence

- Environment: approved staging/test project
- Project ref: `bmqhwofmdgebpcihjlnb`
- Execution date: 2026-08-01 (Asia/Hong_Kong)
- Authority: authenticated Dashboard owner session
- Target relation: `public.birth_data`
- Target field: `successful_change_count`

## Aggregate preflight

- Accounts total: 3
- Count at 0: 2
- Count at 1: 0
- Count at 2: 0
- Count at 3: 1
- Invalid or null counts: 0

## Transaction

- Exact-project check: passed
- Locked aggregate precondition: passed
- Rows outside the quota field changed: 0
- Transaction result: passed

## Aggregate verification

- Accounts total: 3
- Count at 0: 3
- Nonzero or invalid counts: 0
- Accounts mapped to 3 remaining changes: 3

The mobile account-state path reads `successful_change_count` from `birth_data` and derives remaining allowance from the same authoritative value. No IDs, emails, private birth data, or row payloads were captured.
