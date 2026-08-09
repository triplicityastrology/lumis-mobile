import { registerRootComponent } from "expo";
import { createElement } from "react";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";

import App from "./App";
import FounderAiQualityReviewConsole from "./src/dev/FounderAiQualityReviewConsole";
import PersonaComparisonWorkbench from "./src/dev/PersonaComparisonWorkbench";

const PERSONA_COMPARISON_ENABLED =
  __DEV__ && process.env.EXPO_PUBLIC_PERSONA_COMPARISON_WORKBENCH === "1";
const FOUNDER_AI_REVIEW_ENABLED =
  __DEV__ && process.env.EXPO_PUBLIC_FOUNDER_AI_REVIEW_CONSOLE === "1";

// SafeAreaProvider must sit above every screen so the tab bar and headers can
// read the real device insets (fixes the tab bar floating above the home indicator).
// `initialWindowMetrics` supplies insets synchronously on first paint, so screens
// don't render at zero-inset then jump a frame later (the "kicked" back transition).
function Root() {
  const app = FOUNDER_AI_REVIEW_ENABLED
    ? createElement(FounderAiQualityReviewConsole)
    : PERSONA_COMPARISON_ENABLED
      ? createElement(PersonaComparisonWorkbench)
      : createElement(App);
  return createElement(SafeAreaProvider, { initialMetrics: initialWindowMetrics }, app);
}

registerRootComponent(Root);
