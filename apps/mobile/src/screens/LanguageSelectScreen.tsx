import Check from "lucide-react-native/icons/check";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  LANGUAGE_OPTION_ACCESSIBILITY,
  type AppLanguagePreference,
  type LanguageSelectionOrigin
} from "@lumis/shared";

import { AppText } from "../components/AppText";
import { BrandPrimaryButton } from "../components/BrandPrimaryButton";
import { FrostedCard } from "../components/FrostedCard";
import { ScreenHeader } from "../components/states/StateKit";
import { ink } from "../theme/typography";

/**
 * AUTH-013 — Choose app language. Two origins share one screen:
 *   • first_launch — forces a choice before onboarding ("Continue").
 *   • profile_settings — change it later from Profile ("Save preference").
 *
 * Truthful boundary: the language-preference RPC is inactive in this build, so
 * the choice is applied LOCALLY only. We never claim remote persistence or a
 * server "saved" state; the info note reflects the local-provisional behaviour.
 */
const OPTION_SUB: Record<AppLanguagePreference, string> = {
  en: "Interface and system copy in English",
  "zh-Hant": "介面與系統文字使用繁體中文"
};
const ORDER: AppLanguagePreference[] = ["en", "zh-Hant"];

export function LanguageSelectScreen({
  origin,
  initial,
  onConfirm,
  onBack
}: {
  origin: LanguageSelectionOrigin;
  initial: AppLanguagePreference | null;
  onConfirm: (language: AppLanguagePreference) => void;
  onBack?: () => void;
}) {
  const isSettings = origin === "profile_settings";
  const [selected, setSelected] = useState<AppLanguagePreference>(initial ?? "en");

  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.safe}>
      {isSettings && onBack ? <ScreenHeader title="App language" onBack={onBack} /> : null}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!isSettings ? <AppText variant="eyebrow" style={styles.eyebrow}>✦ CHOOSE YOUR LANGUAGE</AppText> : null}
        <AppText variant="screenTitle" style={styles.title}>
          {isSettings ? "App language" : "Which language for Lumis?"}
        </AppText>
        <AppText variant="bodyLarge" style={styles.lead}>
          {isSettings
            ? "Choose the language for Lumis’s interface. Reflections keep the language they were written in."
            : "You can change this any time in Settings. Reflections keep the language they were written in."}
        </AppText>

        <View style={styles.options}>
          {ORDER.map((lang) => {
            const on = selected === lang;
            const a11y = LANGUAGE_OPTION_ACCESSIBILITY[lang];
            return (
              <Pressable
                key={lang}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={a11y.label}
                accessibilityHint={a11y.hint}
                onPress={() => setSelected(lang)}
              >
                <FrostedCard style={[styles.option, on && styles.optionOn]} border={false} radius={16}>
                  <View style={styles.optionCopy}>
                    <AppText variant="cardHeading" style={styles.optionTitle}>{a11y.label}</AppText>
                    <AppText variant="bodySmall" style={styles.optionSub}>{OPTION_SUB[lang]}</AppText>
                  </View>
                  <View style={[styles.radio, on && styles.radioOn]}>
                    {on ? <Check color={ink.onGold} size={15} strokeWidth={3} /> : null}
                  </View>
                </FrostedCard>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.note}>
          <AppText variant="safetyText" style={styles.noteText}>
            Message-language fallback only applies if no preference is saved. Once saved, Lumis follows this choice everywhere.
          </AppText>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <BrandPrimaryButton
          label={isSettings ? "Save preference" : "Continue"}
          onPress={() => onConfirm(selected)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: "transparent", flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8, gap: 12 },
  eyebrow: { marginTop: 6 },
  title: { marginTop: 2 },
  lead: {},
  options: { gap: 12, marginTop: 8 },
  option: { alignItems: "center", flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  optionOn: { borderColor: ink.gold, borderWidth: 1 },
  optionCopy: { flex: 1, gap: 3 },
  optionTitle: {},
  optionSub: { color: ink.muted },
  radio: { alignItems: "center", borderColor: "rgba(255,255,255,0.20)", borderRadius: 13, borderWidth: 1.5, height: 26, justifyContent: "center", width: 26 },
  radioOn: { backgroundColor: ink.gold, borderColor: ink.gold },
  note: { backgroundColor: "rgba(19,35,58,0.5)", borderColor: "rgba(255,255,255,0.05)", borderRadius: 14, borderWidth: 1, marginTop: 6, padding: 14 },
  noteText: {},
  footer: { paddingHorizontal: 20, paddingBottom: 8, paddingTop: 12 }
});
