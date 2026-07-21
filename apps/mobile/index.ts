import { registerRootComponent } from "expo";
import { createElement } from "react";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";

import App from "./App";

// SafeAreaProvider must sit above every screen so the tab bar and headers can
// read the real device insets (fixes the tab bar floating above the home indicator).
// `initialWindowMetrics` supplies insets synchronously on first paint, so screens
// don't render at zero-inset then jump a frame later (the "kicked" back transition).
function Root() {
  return createElement(SafeAreaProvider, { initialMetrics: initialWindowMetrics }, createElement(App));
}

registerRootComponent(Root);
