# S2-T143 Care Circle 0037 Window Operator

Status: inert and unrun. Start with `pnpm care-circle:0037-window`. It performs local checksum/parity checks and reports the next checkpoint without contacting staging or requesting credentials.

For each stage, run `pnpm care-circle:0037-window -- --prepare-stage <stage>`. Dashboard rehearsal and apply remain explicit manual actions using the checksum-bound T140 packets. Record a reviewed redacted evidence digest only after the stage passes:

`pnpm care-circle:0037-window -- --record-stage <stage> --evidence-sha256 <sha256> --accepted`

Stages are strictly ordered: accepted zero-residue rehearsal; atomic `0037` plus history parity; pairing-secret name verification plus PAT revocation; reviewed inactive function deployment plus PAT revocation; classified health pass; sealed metadata-only receipt.

Stop codes are stable `STOP_S2_T143_*` classifications for control drift, predecessor parity, checkpoint scope/shape/digest/order, invalid evidence digest, and out-of-order stage attempts. A failed remote stage is not recorded. Recovery resumes from the last validated local checkpoint; it never rolls back an applied migration. Database recovery remains forward-only, and function recovery may use only a separately reviewed safe function version.
