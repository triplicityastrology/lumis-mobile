import { registerRootComponent } from "expo";
import { createElement } from "react";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";

import App from "./App";
import { FounderDiceFixtureRegistry } from "./src/dev/FounderDiceFixtureRegistry";
import PersonaComparisonWorkbench from "./src/dev/PersonaComparisonWorkbench";
import { FounderDiceInterpretationWorkbench } from "./src/dev/FounderDiceInterpretationWorkbench";
import { FounderDiceV4TechnicalEvidenceDashboard } from "./src/dev/FounderDiceV4TechnicalEvidenceDashboard";

const PERSONA_COMPARISON_ENABLED =
  __DEV__ && process.env.EXPO_PUBLIC_PERSONA_COMPARISON_WORKBENCH === "1";
const DICE_INTERPRETATION_GALLERY_ENABLED =
  __DEV__ && process.env.EXPO_PUBLIC_DICE_INTERPRETATION_GALLERY === "1";
const DICE_FIXTURE_REGISTRY_ENABLED =
  __DEV__ && process.env.EXPO_PUBLIC_DICE_FIXTURE_REGISTRY === "1";
const DICE_V4_TECHNICAL_EVIDENCE_ENABLED =
  __DEV__ && process.env.EXPO_PUBLIC_DICE_V4_TECHNICAL_EVIDENCE === "1";

// SafeAreaProvider must sit above every screen so the tab bar and headers can
// read the real device insets (fixes the tab bar floating above the home indicator).
// `initialWindowMetrics` supplies insets synchronously on first paint, so screens
// don't render at zero-inset then jump a frame later (the "kicked" back transition).
function Root() {
  const app = DICE_V4_TECHNICAL_EVIDENCE_ENABLED
    ? createElement(FounderDiceV4TechnicalEvidenceDashboard)
    : DICE_FIXTURE_REGISTRY_ENABLED
    ? createElement(FounderDiceFixtureRegistry)
    : DICE_INTERPRETATION_GALLERY_ENABLED
    ? createElement(FounderDiceInterpretationWorkbench, { onBack: () => undefined })
    : PERSONA_COMPARISON_ENABLED
      ? createElement(PersonaComparisonWorkbench)
      : createElement(App);
  return createElement(SafeAreaProvider, { initialMetrics: initialWindowMetrics }, app);
}

registerRootComponent(Root);
