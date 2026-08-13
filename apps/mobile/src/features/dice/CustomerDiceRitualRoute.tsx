import { useMemo, useRef, useState } from "react";

import type { MainTab } from "../../components/MainTabBar";
import {
  createDiceCustomerInterpretationController,
  isCurrentDiceCustomerEnvelope,
  parseDiceCustomerFixtureMode,
  type DiceCustomerInterpretationEnvelope,
  type DiceCustomerInterpretationInput,
} from "../../services/diceCustomerInterpretationController";
import { DiceRitualScreen } from "./DiceRitualScreen";

type Props = Readonly<{
  onNotifications: () => void;
  onReflect: (chatDraft: string) => void;
  onSelectTab: (tab: MainTab) => void;
  onBack: () => void;
}>;

export function CustomerDiceRitualRoute(props: Props) {
  const mode = parseDiceCustomerFixtureMode(process.env.EXPO_PUBLIC_DICE_CUSTOMER_LOCAL_FIXTURE, __DEV__);
  const controller = useMemo(() => createDiceCustomerInterpretationController(mode), [mode]);
  const [interpretationState, setInterpretationState] = useState<DiceCustomerInterpretationEnvelope>();
  const latestRequestRef = useRef<DiceCustomerInterpretationInput | null>(null);
  const activeRequestKeyRef = useRef<string | null>(null);

  const requestInterpretation = (input: DiceCustomerInterpretationInput) => {
    latestRequestRef.current = input;
    activeRequestKeyRef.current = input.request_key;
    void controller.request(input, (envelope) => {
      if (isCurrentDiceCustomerEnvelope(activeRequestKeyRef.current, envelope)) {
        setInterpretationState(envelope);
      }
    });
  };

  return (
    <DiceRitualScreen
      {...props}
      effectsAuthorized={false}
      interpretationState={interpretationState}
      onInterpretationRequested={requestInterpretation}
      onRetryInterpretation={(requestKey) => {
        const latest = latestRequestRef.current;
        if (latest?.request_key === requestKey) requestInterpretation(latest);
      }}
      requireClosedFixtureRegistry
    />
  );
}
