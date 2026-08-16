# S2-T359 Dice Live Proof Handoff

T359 adds only the proof and launcher boundary. It does not deploy, enable a
provider, start Metro, consume a Founder window, or change product/gateway
source. Its base is accepted T349 `522063abad92d3931aecfc1b9a31e60e8c9f8ce1`;
accepted T348 `be92814f6a466fdd56f0fd1e86fd10d5277dbd78` is a required ancestor of the
future integrated tree.

## Integration inputs

After T356-T358 are integrated, create an ignored external JSON manifest with
schema `lumis_s2_t359_integration_manifest_v1`. Supply the exact full commits
and package SHA-256 values for T356, T357 and T358, the integrated HEAD as both
build markers, and SHA-256 values for the actual Web and mobile launchers.
The fixed endpoints are Web `http://127.0.0.1:8147`, Expo LAN port `8222`, and
the private mobile relay on port `8223`. `local_consumption_lock` must be
`false`; remote budget/authority controls remain authoritative.

T359 fails closed unless T348, T349 and all three integration commits are
ancestors of the clean integrated HEAD. It also rejects launcher drift before
starting either server.

## Commands after integration

```zsh
export LUMIS_T359_INTEGRATION_MANIFEST=/Volumes/LumisDevSSD/Development/Evidence/S2-T359/integration-manifest.json
bash scripts/start-s2-t359-dice-live-proof.sh preflight
bash scripts/start-s2-t359-dice-live-proof.sh web
# In a second terminal, after Web health is verified:
bash scripts/start-s2-t359-dice-live-proof.sh mobile
```

Do not run those commands from this standalone T359 branch. Run them only from
the reviewed T356-T358 integration tree with its operational authority active.

## Required proof

1. Confirm the Web question, 12 Planet, 12 Sign, 12 House, Run, and response
   controls are populated and the full build marker equals integrated HEAD.
2. Complete three sequential free-text Web readings with three distinct
   Planet/Sign/House landings. Cover English and written Traditional Chinese.
3. Complete three sequential mobile rolls with three distinct landings and at
   least one bounded retry. Keep the result card, Roll again, and explicit
   Reflect in Chat reachable.
4. For every completed reading, verify `lumis_dice_v0_3_result_v2` and the
   AC-DICE-09 unheaded opening plus localized Reading, One thing to watch, and
   Practical step sections.
5. Write only hashes and closed metadata to the external proof receipt. Raw
   questions and interpretations remain visible only in the active session.
6. Keep `human_verdict=pending`; T359 validates technical evidence only.

Validate the completed receipt:

```zsh
export LUMIS_T359_PROOF_RECEIPT=/Volumes/LumisDevSSD/Development/Evidence/S2-T359/live-proof-receipt.json
bash scripts/start-s2-t359-dice-live-proof.sh verify
```

The receipt validator rejects stale build markers, repeated landings/questions,
missing EN or zh-Hant coverage, missing mobile retry evidence, raw content,
and any local consumption lock.
