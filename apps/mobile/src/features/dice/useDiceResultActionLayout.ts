import { useEffect, useState } from "react";
import { AppState, Dimensions, PixelRatio, useWindowDimensions } from "react-native";

const NARROW_RESULT_ACTION_WIDTH = 340;
const LARGE_TEXT_RESULT_ACTION_SCALE = 1.3;

function readNativeFontScale(reportedFontScale: number): number {
  return Math.max(
    reportedFontScale,
    Dimensions.get("window").fontScale || 1,
    PixelRatio.getFontScale()
  );
}

export function useDiceResultActionLayout() {
  const windowMetrics = useWindowDimensions();
  const [nativeFontScale, setNativeFontScale] = useState(() =>
    readNativeFontScale(windowMetrics.fontScale)
  );

  useEffect(() => {
    setNativeFontScale(readNativeFontScale(windowMetrics.fontScale));
  }, [windowMetrics.fontScale]);

  useEffect(() => {
    const dimensionsSubscription = Dimensions.addEventListener("change", ({ window }) => {
      setNativeFontScale(readNativeFontScale(window.fontScale));
    });
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setNativeFontScale(readNativeFontScale(Dimensions.get("window").fontScale));
      }
    });

    return () => {
      dimensionsSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  const effectiveFontScale = Math.max(windowMetrics.fontScale, nativeFontScale);

  return {
    stackResultActions:
      windowMetrics.width < NARROW_RESULT_ACTION_WIDTH ||
      effectiveFontScale >= LARGE_TEXT_RESULT_ACTION_SCALE
  };
}
