# S2-T47 Fixed-Template Runtime Boundary

Status: inactive, server-side only. The source is under the Supabase function
shared boundary and has no mobile caller, persistence, deployment, provider, or
model integration.

The closed registry reproduces the nine bilingual records from
`AI_Routing_Fixed_Template_Wording_Register_v0.2`. Lookup requires the exact
registry version and family ID. Explicit language accepts only `en` or
`zh-Hant`; an omitted language deterministically falls back to English and is
marked as a fallback. Unknown versions, IDs, and explicit languages fail with a
non-echoing stable code. No template is translated, generated, or rewritten.

Runtime is captured once when trusted server configuration creates the loader;
it is not a lookup field. Missing or unknown trusted runtime configuration fails
closed. The lookup shape is closed, so a caller-supplied runtime (including a
request for `staging`) is rejected before any provisional or clinical template
can be returned.

The register remains a provisional staging/development baseline. Production
lookup fails for wording still awaiting production approval. Crisis and
distress records additionally fail while clinical review remains pending. A
future release requires a controlled registry revision; callers cannot bypass
these gates with runtime flags. This boundary does not grant deployment or
production approval.
