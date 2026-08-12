import {
  createDiceLiveResultAdapter,
  type DiceLiveResultAdapterConfig,
  type DiceLiveResultRequest,
  type DiceLiveResultState,
} from "./diceLiveResultAdapter";

export const DICE_FOUNDER_PRODUCT_BRIDGE_VERSION = "dice_founder_product_bridge_v1" as const;

const NO_EFFECTS = Object.freeze({ provider_calls: 0, persistence_writes: 0, units_charged: 0 });

export type DiceFounderProductBridgeState =
  | Readonly<{
      kind: "loading";
      target: "signed_off_dice_result_card";
      effects: typeof NO_EFFECTS;
    }>
  | Readonly<{
      kind: "result";
      result: DiceLiveResultState;
      target: "signed_off_dice_result_card";
      effects: typeof NO_EFFECTS;
    }>;

export type DiceFounderBridgeRequest = Readonly<{
  fixture_id: string;
  question: string;
  on_state?: (state: DiceFounderProductBridgeState) => void;
}>;

export function isCurrentDiceInterpretationRequest(activeRequestKey: string | null, responseRequestKey: string): boolean {
  return activeRequestKey !== null && activeRequestKey === responseRequestKey;
}

export function preserveApprovedDiceChatNavigation(chatDraft: string): Readonly<{
  target: "chat";
  chat_draft: string;
}> {
  if (!chatDraft.startsWith("Help me reflect on my astrology dice ") || !chatDraft.includes("My question was: “")) {
    throw new Error("DICE_REFLECTION_HANDOFF_INVALID");
  }
  return Object.freeze({ target: "chat", chat_draft: chatDraft });
}

/**
 * Connects the closed live-result adapter to the existing Dice result card.
 * Chat navigation remains exclusively owned by the existing onReflect action.
 */
export function createDiceFounderProductBridge(config: DiceLiveResultAdapterConfig) {
  const adapter = createDiceLiveResultAdapter(config);

  return Object.freeze({
    request: async (request: DiceFounderBridgeRequest): Promise<DiceFounderProductBridgeState> => {
      const result = await adapter.request({
        fixture_id: request.fixture_id,
        question: request.question,
        on_state: (state) => {
          if (state.kind === "loading") {
            emit(request, {
              kind: "loading",
              target: "signed_off_dice_result_card",
              effects: NO_EFFECTS,
            });
          }
        },
      });

      return emit(request, {
        kind: "result",
        result,
        target: "signed_off_dice_result_card",
        effects: NO_EFFECTS,
      });
    },
  });
}

function emit(
  request: DiceFounderBridgeRequest,
  state: DiceFounderProductBridgeState,
): DiceFounderProductBridgeState {
  request.on_state?.(state);
  return state;
}
