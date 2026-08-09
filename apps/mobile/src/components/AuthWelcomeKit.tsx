import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Ellipse } from "react-native-svg";

import type { AppLanguagePreference } from "@lumis/shared";
import { ink, type } from "../theme/typography";

/**
 * Shared primitives for the approved HOME-001 (Welcome) and AUTH-001 (Sign up)
 * screens: the small compass/orbit mark and the EN / 中 language segment.
 * Presentational only.
 */

const SUNRISE = "#E5C06B";
const ORBIT = "rgba(233,192,107,0.35)";

/** Small orbit mark — a subtle ring with a single sunrise dot (not the radar). */
export function CompassMark({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72" accessibilityElementsHidden importantForAccessibility="no">
      <Circle cx={36} cy={36} r={30} stroke={ORBIT} strokeWidth={1.2} fill="none" />
      <Ellipse cx={36} cy={36} rx={30} ry={12} stroke={ORBIT} strokeWidth={1} fill="none" />
      <Circle cx={36} cy={36} r={4} fill={SUNRISE} />
      <Circle cx={62} cy={30} r={2} fill={SUNRISE} />
    </Svg>
  );
}

/** EN / 中 segment — active locale on a solid gold pill (chips exempt from Rule 2). */
export function LanguageToggle({
  value,
  onChange,
  style
}: {
  value: AppLanguagePreference | null;
  onChange: (next: AppLanguagePreference) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const active: AppLanguagePreference = value === "zh-Hant" ? "zh-Hant" : "en";
  return (
    <View accessibilityRole="radiogroup" style={[s.toggle, style]}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: active === "en" }}
        accessibilityLabel="English"
        onPress={() => onChange("en")}
        style={[s.seg, active === "en" && s.segActive]}
      >
        <Text style={[s.segText, active === "en" && s.segTextActive]}>EN</Text>
      </Pressable>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: active === "zh-Hant" }}
        accessibilityLabel="繁體中文"
        onPress={() => onChange("zh-Hant")}
        style={[s.seg, active === "zh-Hant" && s.segActive]}
      >
        <Text style={[s.segText, active === "zh-Hant" && s.segTextActive]}>中</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  toggle: {
    alignItems: "center",
    backgroundColor: "rgba(58,80,118,0.42)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    padding: 3
  },
  seg: { alignItems: "center", borderRadius: 999, justifyContent: "center", minWidth: 38, paddingHorizontal: 12, paddingVertical: 6 },
  segActive: { backgroundColor: SUNRISE },
  segText: { ...type.buttonLabelSmall, color: ink.soft, fontSize: 12.5 },
  segTextActive: { color: "#3A2218" }
});
