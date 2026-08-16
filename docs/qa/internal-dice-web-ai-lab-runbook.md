# Internal Dice Web AI Lab — local default-off runbook

Run the default-off bootstrap from the T356 SSD worktree:

```bash
pnpm start:internal-dice-ai-lab
```

Open `http://127.0.0.1:8147`. It binds only to the Founder’s local Mac. Bootstrap must populate 40 approved fixtures and all 12 Planet, Sign, and House choices; otherwise Run stays disabled. The two mutually exclusive modes are Founder free text and approved fixture regression.

Fixture regression sends the fixture ID plus the three allow-listed faces and retains its signed receipt, single-use, count, and expiry controls. Founder free text sends the synthetic question plus the same three allow-listed faces to the local Lab server. The local server adds the private server-held access boundary; the Edge performs deterministic validation/classification before constructing its Azure adapter. Free text has no local fixture-count, single-use, or 900-second receipt gate. It remains bounded by the two server-side kill switches, provider quota/rate limits, and per-request 800/300-token and shared 12-second controls.

An accepted future result is first validated against `lumis_dice_v0_3_result_v2`, then shown below Run using AC-DICE-09: an unheaded “You drew…” line, **Reading**, **One thing to watch**, and **Practical step**. Traditional Chinese fixtures use written Traditional Chinese. Safety and fallback responses display only their approved deterministic copy. Raw prompts/provider responses are never logged, persisted, or added to the metadata-only CSV.

The browser receives a session-only result plus redacted metadata. Export contains request mode, fixture ID when applicable, language, route, latency/token/cost buckets and ratings/notes only. It never contains the free-text question or raw result.

Stop immediately on any invalid fixture receipt, malformed request, unknown Dice face, raw-content export, quota/rate breach, or disabled verification failure. Provider access must then return to disabled.
