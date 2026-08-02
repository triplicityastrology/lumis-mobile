# S2-T171 Four-Digit Pairing Allocation Authority

Status: source-only and inactive. Migration 0037 remains undeployed.

## Allocation Contract

- A pairing code is exactly four numeric digits.
- A code accepts new submissions for at most 10 minutes from its issue time.
- Only one active code exists per Caree, and an active code value is globally unique.
- Each issued value remains reserved for 60 minutes from its original issue time. Expiry, rotation, or revocation blocks submission immediately but does not shorten that reservation.
- An old saved QR therefore cannot resolve to another Caree during the reservation window.
- Allocation claims the hash-only reservation atomically. Collisions are retried a bounded number of times and exhaustion returns the generic `CARE_CIRCLE_CODE_POOL_UNAVAILABLE` boundary.
- Four digits provide 10,000 values, so the maximum safe issuance capacity is 10,000 values per rolling hour. Scaling beyond that limit requires moving to six digits; uniqueness or quarantine must not be weakened.

The database stores only the secret-backed fingerprint and reservation metadata. Raw codes remain transient, never enter audit evidence, and pairing still creates pending Caree acceptance with no Carer authority until acceptance.
