import {
  DICE_V4_AUTHORIZATION_PACKAGE_SHA256,
  DICE_V4_RUNTIME_PACKAGE_SHA256,
  DICE_V4_ZERO_CALL_PACKAGE_SHA256,
  type DiceLiveAuthority,
} from "./diceLiveResultAdapter";
import { createDiceFounderProductBridge, isCurrentDiceInterpretationRequest, preserveApprovedDiceChatNavigation, type DiceFounderProductBridgeState } from "./diceFounderProductBridge";

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const authority: DiceLiveAuthority = Object.freeze({
  schema: "lumis_dice_mobile_live_result_authority_v1",
  deployment_authorization_schema: "lumis_dice_default_off_function_deployment_authorization_v4",
  runtime_package_sha256: DICE_V4_RUNTIME_PACKAGE_SHA256,
  authorization_package_sha256: DICE_V4_AUTHORIZATION_PACKAGE_SHA256,
  zero_call_package_sha256: DICE_V4_ZERO_CALL_PACKAGE_SHA256,
  operational_receipt_status: "accepted",
  fixture_registry_status: "accepted",
});

const question = "How did my interview go?";
const chatDraft = "Help me reflect on my astrology dice throw. My question was: “How did my interview go?” The dice showed Venus, Leo, 6th House.";

async function main() {
  check(isCurrentDiceInterpretationRequest("dice-roll-2", "dice-roll-2"), "latest roll response is accepted");
  check(!isCurrentDiceInterpretationRequest("dice-roll-2", "dice-roll-1"), "stale earlier response cannot overwrite latest roll");
  check(!isCurrentDiceInterpretationRequest(null, "dice-roll-1"), "response after reset is ignored");
  const navigation = preserveApprovedDiceChatNavigation(chatDraft);
  check(navigation.target === "chat" && navigation.chat_draft === chatDraft, "normal approved navigation remains byte-identical");

  let constructions = 0;
  const disabledStates: DiceFounderProductBridgeState[] = [];
  const disabled = await createDiceFounderProductBridge({
    ai_enabled: false,
    traffic_authorized: false,
    authority: null,
    create_gateway_transport: () => {
      constructions += 1;
      return async () => null;
    },
  }).request({ fixture_id: "dice-founder-en-10", question, on_state: (state) => disabledStates.push(state) });

  check(disabled.kind === "result" && disabled.result.kind === "disabled", "disabled bridge projects unavailable state to Dice card");
  check(constructions === 0, "disabled bridge cannot construct provider transport");

  const states: DiceFounderProductBridgeState[] = [];
  const accepted = await createDiceFounderProductBridge({
    ai_enabled: true,
    traffic_authorized: true,
    authority,
    create_gateway_transport: () => {
      constructions += 1;
      return async (request) => {
        check(Object.keys(request).join(",") === "fixture_id", "mobile transport receives fixture_id only");
        return {
          version: "dice_interpretation_response_v0_3",
          result: "completed",
          language: "en",
          code: "DICE_COMPLETED",
          reading: "A bounded reading.",
          watch_out: "Keep the context in view.",
          practical_direction: "Choose one reversible next step.",
          effects: { persistence_writes: 0, units_charged: 0 },
        };
      };
    },
  }).request({ fixture_id: "dice-founder-en-10", question, on_state: (state) => states.push(state) });

  check(states.map((state) => state.kind).join(",") === "loading,result", "bridge exposes Dice-card loading then result");
  check(accepted.kind === "result" && accepted.result.kind === "interpretation", "accepted response remains structured for Dice result card");
  check(Number(constructions) === 1, "accepted authority constructs exactly one transport");

  console.log("S2-T310 Dice Founder product bridge fixtures passed");
}

void main();
