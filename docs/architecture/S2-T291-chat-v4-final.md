# S2-T291 Chat/Companion v4 final candidate

This source-only candidate keeps the dedicated `chat-synthetic` Edge route
separate from `chat-message`. Its runtime accepts closed fixture IDs only and
does not accept member, profile, thread, message, account, chart, device or
free-form runtime context. It writes no member persistence and charges zero
units.

## Dice prerequisite

Future Chat synthetic traffic requires an independently accepted
`lumis_dice_technical_window_80_accepted_evidence_v4` envelope. That envelope
must bind the Microsoft-reviewed v4 deployment receipt design, runtime package
`be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457`,
four disabled probes, exactly 80 Technical cases, post-window disable proof,
zero Founder cases, zero persistence and zero units. Structurally valid local
JSON is not accepted evidence.

The Founder approved the
`lumis_dice_default_off_function_deployment_authorization_v4` receipt design
only. This is not operational authorization for deployment, migration, Azure
traffic, normal Chat integration, member data, or public use. Every operation
still requires its own reviewed authorization.

## Independent scopes

- `CHAT_SYNTHETIC_DEFAULT_OFF_DEPLOYMENT_ONLY` permits only a future disabled
  function deployment and four `CHAT_AI_DISABLED` probes.
- `CHAT_SYNTHETIC_AUTHORITY_LEDGER_0040_MIGRATION_ONLY` is a separate future
  migration authorization.
- `CHAT_SYNTHETIC_CLOSED_FIXTURE_WINDOW_ONLY` is a separate future traffic
  authorization and cannot validate while accepted Dice evidence is null.

The Edge handler checks `LUMIS_CHAT_AI_ENABLED` before parsing JSON, reading
runtime evidence, constructing Supabase/Azure clients, or making provider
calls. T240 remains canonical, including:

- `Lumis couldn’t complete that reflection just now. Please try again.`
- `Lumis can’t help with that request, but it can offer a safer, general reflection instead.`

Current status remains `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY` and
`NO_AZURE_TRAFFIC_AUTHORITY`.
