import { StyleSheet, type TextStyle } from "react-native";

/**
 * Codex signed-off semantic typography system.
 *
 * Every text element maps to ONE role below — do not invent per-screen sizes.
 * Families are the bundled static weights (assets/fonts, SIL OFL): Newsreader
 * (display serif), Hanken Grotesk (UI/body/label/button sans), Noto Serif TC
 * (Traditional Chinese serif + astrology glyphs). See TYPOGRAPHY_SYSTEM.md.
 *
 * letterSpacing is stored in points (em × size, pre-computed). lineHeight is the
 * absolute pixel value (size × multiplier, rounded). Colours match DESIGN_TOKENS.
 */

export const fontFamilies = {
  displayMedium: "Newsreader-Medium", // Newsreader 500
  displaySemiBold: "Newsreader-SemiBold", // Newsreader 600
  sansRegular: "HankenGrotesk-Regular", // 400
  sansMedium: "HankenGrotesk-Medium", // 500
  sansSemiBold: "HankenGrotesk-SemiBold", // 600
  sansBold: "HankenGrotesk-Bold", // 700
  serifTCMedium: "NotoSerifTC-Medium", // 500 (zh + glyphs)
  serifTCBold: "NotoSerifTC-Bold" // 700
} as const;

/** expo-font `useFonts` map — the single source of truth for what gets bundled. */
export const FONT_ASSETS = {
  "Newsreader-Medium": require("../../assets/fonts/Newsreader-Medium.ttf"),
  "Newsreader-SemiBold": require("../../assets/fonts/Newsreader-SemiBold.ttf"),
  "HankenGrotesk-Regular": require("../../assets/fonts/HankenGrotesk-Regular.ttf"),
  "HankenGrotesk-Medium": require("../../assets/fonts/HankenGrotesk-Medium.ttf"),
  "HankenGrotesk-SemiBold": require("../../assets/fonts/HankenGrotesk-SemiBold.ttf"),
  "HankenGrotesk-Bold": require("../../assets/fonts/HankenGrotesk-Bold.ttf"),
  "NotoSerifTC-Medium": require("../../assets/fonts/NotoSerifTC-Medium.ttf"),
  "NotoSerifTC-Bold": require("../../assets/fonts/NotoSerifTC-Bold.ttf")
} as const;

/** DESIGN_TOKENS colour roles used by the type scale (consumers may override). */
export const ink = {
  strong: "#F0F4F8",
  soft: "#C4CEDB",
  muted: "#8A9BB0",
  onGold: "#3A2218",
  gold: "#D7B978",
  good: "#86C8A6",
  warn: "#E38E7C"
} as const;

/** iOS Dynamic Type / Android font-scale cap (respect up to 130%, never beyond). */
export const MAX_FONT_SCALE = 1.3;

export const type = StyleSheet.create({
  hero: { fontFamily: fontFamilies.displayMedium, fontSize: 32, lineHeight: 37, letterSpacing: -0.32, color: ink.strong },
  screenTitle: { fontFamily: fontFamilies.displayMedium, fontSize: 28, lineHeight: 33, letterSpacing: -0.14, color: ink.strong },
  sectionHeading: { fontFamily: fontFamilies.displayMedium, fontSize: 20, lineHeight: 25, color: ink.strong },
  cardHeading: { fontFamily: fontFamilies.displayMedium, fontSize: 16.5, lineHeight: 22, color: ink.strong },
  bodyLarge: { fontFamily: fontFamilies.sansRegular, fontSize: 15.5, lineHeight: 24, color: ink.soft },
  body: { fontFamily: fontFamilies.sansRegular, fontSize: 14, lineHeight: 22, color: ink.soft },
  bodySmall: { fontFamily: fontFamilies.sansRegular, fontSize: 12.5, lineHeight: 19, color: ink.soft },
  fieldLabel: { fontFamily: fontFamilies.sansBold, fontSize: 10.5, lineHeight: 15, letterSpacing: 1.47, textTransform: "uppercase", color: ink.muted },
  fieldValue: { fontFamily: fontFamilies.displayMedium, fontSize: 16.5, lineHeight: 22, color: ink.strong },
  inputText: { fontFamily: fontFamilies.sansMedium, fontSize: 15.5, lineHeight: 21, color: ink.strong },
  buttonLabel: { fontFamily: fontFamilies.sansBold, fontSize: 15.5, lineHeight: 19, color: ink.onGold },
  buttonLabelSmall: { fontFamily: fontFamilies.sansBold, fontSize: 13.5, lineHeight: 16, color: ink.onGold },
  navLabel: { fontFamily: fontFamilies.sansSemiBold, fontSize: 11.5, lineHeight: 14, letterSpacing: 0.23, color: ink.soft },
  eyebrow: { fontFamily: fontFamilies.sansBold, fontSize: 10, lineHeight: 12, letterSpacing: 2.2, textTransform: "uppercase", color: ink.gold },
  caption: { fontFamily: fontFamilies.sansRegular, fontSize: 12, lineHeight: 18, color: ink.muted },
  statusLabel: { fontFamily: fontFamilies.sansSemiBold, fontSize: 12.5, lineHeight: 15, color: ink.good },
  errorText: { fontFamily: fontFamilies.sansMedium, fontSize: 13, lineHeight: 19, color: ink.warn },
  safetyText: { fontFamily: fontFamilies.sansMedium, fontSize: 12.5, lineHeight: 19, color: ink.soft },
  numeric: { fontFamily: fontFamilies.displayMedium, fontSize: 15.5, lineHeight: 21, color: ink.strong },
  glyph: { fontFamily: fontFamilies.serifTCMedium, color: ink.gold }
});

export type TypeRole = keyof typeof type;

/** Convenience: role style + the Dynamic-Type cap, for spreading onto <Text>. */
export function textRole(role: TypeRole): { style: TextStyle; maxFontSizeMultiplier: number } {
  return { style: type[role], maxFontSizeMultiplier: MAX_FONT_SCALE };
}
