import { registerRootComponent } from "expo";
import { createElement } from "react";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";

import App from "./App";
import { FounderDiceFixtureRegistry } from "./src/dev/FounderDiceFixtureRegistry";
import FounderAiQualityReviewConsole from "./src/dev/FounderAiQualityReviewConsole";
import { FounderDiceInterpretationWorkbench } from "./src/dev/FounderDiceInterpretationWorkbench";
import { FounderDiceTechnicalControlRoom } from "./src/dev/FounderDiceTechnicalControlRoom";
import { FounderDiceV4TechnicalEvidenceDashboard } from "./src/dev/FounderDiceV4TechnicalEvidenceDashboard";
import { FounderTomorrowDiceChatSession } from "./src/dev/FounderTomorrowDiceChatSession";
import PersonaComparisonWorkbench from "./src/dev/PersonaComparisonWorkbench";

const PERSONA_COMPARISON_ENABLED =
  __DEV__ && process.env.EXPO_PUBLIC_PERSONA_COMPARISON_WORKBENCH === "1";
const FOUNDER_AI_REVIEW_ENABLED =
  __DEV__ && process.env.EXPO_PUBLIC_FOUNDER_AI_REVIEW_CONSOLE === "1";
const FOUNDER_DICE_POLISHED_E2E_ENABLED =
  __DEV__ && process.env.EXPO_PUBLIC_FOUNDER_DICE_POLISHED_E2E === "1";
const FOUNDER_TOMORROW_SESSION_ENABLED =
  __DEV__ && process.env.EXPO_PUBLIC_FOUNDER_TOMORROW_SESSION === "1";
const DICE_FIXTURE_REGISTRY_ENABLED =
  __DEV__ && process.env.EXPO_PUBLIC_DICE_FIXTURE_REGISTRY === "1";
const DICE_V4_TECHNICAL_EVIDENCE_ENABLED =
  __DEV__ && process.env.EXPO_PUBLIC_DICE_V4_TECHNICAL_EVIDENCE === "1";
const DICE_T294_CONTROL_ROOM_ENABLED =
  __DEV__ && process.env.EXPO_PUBLIC_DICE_T294_CONTROL_ROOM === "1";

// SafeAreaProvider must sit above every screen so the tab bar and headers can
// read the real device insets (fixes the tab bar floating above the home indicator).
// `initialWindowMetrics` supplies insets synchronously on first paint, so screens
// don't render at zero-inset then jump a frame later (the "kicked" back transition).
function Root() {
  const app = FOUNDER_TOMORROW_SESSION_ENABLED
    ? createElement(FounderTomorrowDiceChatSession)
    : FOUNDER_DICE_POLISHED_E2E_ENABLED
    ? createElement(FounderDiceInterpretationWorkbench, { onBack: () => undefined })
    : FOUNDER_AI_REVIEW_ENABLED
      ? createElement(FounderAiQualityReviewConsole)
    : DICE_T294_CONTROL_ROOM_ENABLED
      ? createElement(FounderDiceTechnicalControlRoom)
    : DICE_V4_TECHNICAL_EVIDENCE_ENABLED
      ? createElement(FounderDiceV4TechnicalEvidenceDashboard)
    : DICE_FIXTURE_REGISTRY_ENABLED
      ? createElement(FounderDiceFixtureRegistry)
    : PERSONA_COMPARISON_ENABLED
      ? createElement(PersonaComparisonWorkbench)
      : createElement(App);
  return createElement(SafeAreaProvider, { initialMetrics: initialWindowMetrics }, app);
}

registerRootComponent(Root);
