import {
  ACCEPTED_FOUNDER_DICE_ENVELOPE_SHA256,
  T257_DICE_GATEWAY_INTERFACE,
  createDisabledFounderDiceGateway,
  createFounderDiceInvokeRequest,
  invokeAcceptedFounderDiceFixture,
  parseFounderDiceAcceptanceEnvelope,
  resolveFounderDiceJourneyState,
  type FounderDiceAcceptanceEnvelope,
  type FounderDiceGatewayPort,
} from "./founderDiceE2eContract";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const envelopeSha = "a".repeat(64);
const technicalSha = "b".repeat(64);
const rawEnvelope = {
  schema_version: "s2_t264_founder_dice_acceptance_envelope_v1",
  interface_version: T257_DICE_GATEWAY_INTERFACE,
  fixture_id: "DICE-FOUNDER-EN-03",
  language: "en",
  validation_status: "accepted",
  classification: "judgment",
  eligibility: "eligible",
  registry_checksum: "43cccc009f15a43c1801bd090234540e474a6cb20a1a48aa3a3bcd9b86a1a030",
  technical_evidence_sha256: technicalSha,
  effects: { member_auth: 0, persistence_writes: 0, units_charged: 0 },
} as const;

check(ACCEPTED_FOUNDER_DICE_ENVELOPE_SHA256 === null, "default build has no accepted Founder envelope");
const disabled = createDisabledFounderDiceGateway();
check(!disabled.status().enabled && !disabled.status().provider_access && !disabled.status().accepted_envelope, "default gateway is fully disabled");
check(disabled.status().interface_version === T257_DICE_GATEWAY_INTERFACE, "disabled seam declares only documented T257 interface");

for (const hostile of [
  rawEnvelope,
  { ...rawEnvelope, question: "free-form text must not cross invoke seam" },
  { ...rawEnvelope, fixture_id: "DICE-FOUNDER-EN-99" },
  { ...rawEnvelope, language: "zh-Hant" },
  { ...rawEnvelope, validation_status: "pending" },
  { ...rawEnvelope, eligibility: "not_eligible" },
  { ...rawEnvelope, registry_checksum: "c".repeat(64) },
  { ...rawEnvelope, technical_evidence_sha256: "c".repeat(64) },
  { ...rawEnvelope, effects: { ...rawEnvelope.effects, member_auth: 1 } },
  { ...rawEnvelope, effects: { ...rawEnvelope.effects, persistence_writes: 1 } },
  { ...rawEnvelope, effects: { ...rawEnvelope.effects, units_charged: 1 } },
]) {
  let rejected = false;
  try { parseFounderDiceAcceptanceEnvelope(hostile, envelopeSha); } catch { rejected = true; }
  check(rejected, "unaccepted or hostile envelope fails closed");
}

const accepted = parseFounderDiceAcceptanceEnvelope(rawEnvelope, envelopeSha, envelopeSha, technicalSha);
check(Object.keys(createFounderDiceInvokeRequest(accepted)).join(",") === "fixture_id", "invoke request contains fixture_id only");
check(createFounderDiceInvokeRequest(accepted).fixture_id === rawEnvelope.fixture_id, "invoke request preserves accepted fixture ID");

const defaultJourney = resolveFounderDiceJourneyState({
  frozen: false,
  offlinePreview: false,
  acceptedEnvelope: null,
  gatewayStatus: disabled.status(),
});
check(defaultJourney.presentation === "not_yet_run" && defaultJourney.gateway === "disabled", "default state is truthful and disabled");
const previewJourney = resolveFounderDiceJourneyState({
  frozen: true,
  offlinePreview: true,
  acceptedEnvelope: null,
  gatewayStatus: disabled.status(),
});
check(previewJourney.presentation === "offline_preview" && previewJourney.eligibility === "not_eligible", "offline preview never masquerades as eligible live evidence");

const acceptedPort: FounderDiceGatewayPort = {
  status: () => ({ interface_version: T257_DICE_GATEWAY_INTERFACE, enabled: true, provider_access: true, accepted_envelope: true }),
  invoke: async (request) => ({ fixture_id: request.fixture_id, evidence: { checksum_verified: true } }),
};
const liveJourney = resolveFounderDiceJourneyState({
  frozen: true,
  offlinePreview: false,
  acceptedEnvelope: accepted,
  gatewayStatus: acceptedPort.status(),
});
check(liveJourney.presentation === "live_synthetic" && liveJourney.eligibility === "eligible", "live-synthetic presentation requires both accepted envelope and enabled port");

async function run() {
  let forgedRejected = false;
  try { await invokeAcceptedFounderDiceFixture(acceptedPort, rawEnvelope as FounderDiceAcceptanceEnvelope); } catch { forgedRejected = true; }
  check(forgedRejected, "structurally valid but unparsed envelope cannot invoke");
  let disabledRejected = false;
  try { await invokeAcceptedFounderDiceFixture(disabled, accepted); } catch { disabledRejected = true; }
  check(disabledRejected, "disabled gateway cannot invoke even with a test envelope");
  const result = await invokeAcceptedFounderDiceFixture(acceptedPort, accepted);
  check(result.fixture_id === accepted.fixture_id, "accepted seam returns matching fixture evidence");
  console.log("S2-T264 Founder Dice E2E contract fixtures passed");
}

void run();
