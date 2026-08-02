# S2-T147 Care Circle Founder live-session sequence

Status: source-only, zero-network, unrun. Every remote result must first be recorded by its accepted operator. The coordinator never infers staging success.

## Status and safe resume

From the repository root:

```bash
pnpm care-circle:live-session
```

Before disposable accounts exist, this reports the first incomplete gate: 0037 rehearsal, 0037 apply, pairing-secret provision, inactive function deploy, health proof, or two-account bootstrap. After accounts exist, its default is recovery-safe and reports Cleanup until cleanup is confirmed. Continue an uninterrupted controlled test only with:

```bash
pnpm care-circle:live-session -- --continue-session
```

This flag records no state and performs no network action. Accepted stage evidence remains in the sealed local receipts produced by the existing operators.

After an operator result is independently accepted, record only its stage name and metadata-only evidence hash:

```bash
pnpm care-circle:live-session -- --record-stage accounts_ready --evidence-sha256 <64-lowercase-hex> --accepted
```

Use the same form, strictly in order, for `mobile_launched`, `evidence_complete`, `cleanup_complete`, and `qa_key_revoked`. The local receipt contains no account, code, credential, URL, row, or raw error.

## Controlled-session commands

Run only during the separately authorised window and stop after any non-pass result:

1. `pnpm care-circle:0037-window -- --prepare-stage rehearsal_accepted`
2. Run the reviewed Dashboard rehearsal; record its accepted metadata-only evidence with the existing `care-circle:0037-window` checkpoint command.
3. Prepare and record `migration_0037_recorded` only after the atomic apply and parity proof pass.
4. `zsh scripts/run-s2-care-circle-pairing-secret-provision.zsh` for the custom secret; record only after PAT revocation is proven.
5. `zsh scripts/run-s2-care-circle-pat-deploy.zsh` for the inactive function; record only after PAT revocation is proven.
6. `zsh scripts/run-s2-care-circle-function-health.zsh`; seal the deployment/health receipt only after classified checks pass.
7. `zsh scripts/run-s2-care-circle-two-account-evidence.zsh` to prepare exactly one Caree and one Carer. The temporary QA key must remain hidden and transient.
8. `pnpm start:care-circle-founder` to open the corrected product screens in Founder Tests.
9. Run Cleanup with the same run scope, prove zero relationships and exactly two disposable accounts removed, then revoke the temporary QA key.

## One-iPhone product checklist

1. Sign in as the disposable Caree and open Care Circle from Founder Tests.
2. Open **My check-in code**, create the four-digit code, and use **Copy**. Do not include the digits in evidence.
3. Switch to the disposable Carer, enter the code, and confirm **Pending Caree acceptance** means no authority.
4. Switch to the Caree and accept the pending request.
5. Switch to the Carer and confirm the relationship is active.
6. As Caree, select **Pause**, then **Resume**; confirm each refreshed state before continuing.
7. As Carer, choose **Leave Care Circle** and confirm removal.
8. Run **Cleanup**, confirm zero residue, and **Revoke the temporary QA key**.

Evidence is limited to named pass/fail states and the approved build marker. Never retain pairing digits, account identifiers, email addresses, URLs, credentials, rows, or raw errors.
