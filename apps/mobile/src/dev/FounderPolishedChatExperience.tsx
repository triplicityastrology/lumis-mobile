import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Bell, History, Info, Plus, RotateCcw, Send, Sparkles } from "lucide-react-native";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CelestialBackground } from "../components/CelestialBackground";
import { LumisPersonaAvatar } from "../components/LumisPersonaAvatar";
import { ChatFailedReply } from "../features/chat/ChatConfirmationCards";
import { fontFamilies, ink, MAX_FONT_SCALE } from "../theme/typography";
import type { CompanionLanguage } from "./founderCompanionChatContract";
import {
  founderChatEligibility,
  projectFounderChatFixture,
  validateFounderChatPrompt,
  type FounderChatPhase,
  type FounderChatProjection,
  type FounderChatScenario,
} from "./founderPolishedChatContract";

const BUILD_SHA = process.env.EXPO_PUBLIC_FOUNDER_POLISHED_CHAT_HEAD ?? "0000000000000000000000000000000000000000";
const BUILD_VALID = /^[a-f0-9]{40}$/.test(BUILD_SHA) && !/^0+$/.test(BUILD_SHA);
const SUNRISE = ["#E5C06B", "#E9B083", "#E89B92"] as const;
const PROMPTS: Record<CompanionLanguage, string[]> = {
  en: ["What feels most important to understand right now?", "Help me reflect on a difficult choice."],
  "zh-Hant": ["我而家最需要理解嘅係甚麼？", "幫我梳理一個困難嘅選擇。"],
};

export default function FounderPolishedChatExperience() {
  const [language, setLanguage] = useState<CompanionLanguage>("en");
  const [scenario, setScenario] = useState<FounderChatScenario>("success");
  return (
    <SafeAreaView style={styles.root}>
      <View accessibilityLabel="S2_T299_POLISHED_CHAT_ROUTE Founder evidence controls outside product pixels" style={styles.externalBand}>
        <View style={styles.externalMeta}>
          <Text style={styles.externalTitle}>Founder Talk preview · offline fixture</Text>
          <Text numberOfLines={1} selectable style={styles.externalSha}>{BUILD_VALID ? BUILD_SHA : "BUILD UNAVAILABLE"}</Text>
        </View>
        <View style={styles.externalControls}>
          <Control label="EN" selected={language === "en"} onPress={() => setLanguage("en")} />
          <Control label="繁中" selected={language === "zh-Hant"} onPress={() => setLanguage("zh-Hant")} />
          <Control label="Reply" selected={scenario === "success"} onPress={() => setScenario("success")} />
          <Control label="Safety" selected={scenario === "safety"} onPress={() => setScenario("safety")} />
          <Control label="Fallback" selected={scenario === "fallback"} onPress={() => setScenario("fallback")} />
        </View>
      </View>
      <TalkProductSurface key={`${language}:${scenario}`} language={language} scenario={scenario} />
    </SafeAreaView>
  );
}

function TalkProductSurface({ language, scenario }: { language: CompanionLanguage; scenario: FounderChatScenario }) {
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [phase, setPhase] = useState<FounderChatPhase>("compose");
  const [projection, setProjection] = useState<FounderChatProjection | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function submit() {
    const decision = validateFounderChatPrompt(draft);
    if (!decision.ok) {
      setValidation(decision.message);
      return;
    }
    setValidation(null);
    setSubmitted(decision.prompt);
    setDraft("");
    setProjection(null);
    setPhase("thinking");
    timerRef.current = setTimeout(() => {
      setProjection(projectFounderChatFixture(language, scenario));
      setPhase("response");
    }, 650);
  }

  function retry() {
    setDraft(submitted ?? "");
    setProjection(null);
    setPhase("compose");
  }

  function reset() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDraft("");
    setSubmitted(null);
    setProjection(null);
    setValidation(null);
    setPhase("compose");
  }

  useEffect(() => { requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true })); }, [phase, projection]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.productFrame}>
      <CelestialBackground />
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Back" accessibilityRole="button" style={styles.iconButton}><ArrowLeft color={ink.strong} size={20} /></Pressable>
        <LumisPersonaAvatar avatarKey="psyche" size={38} />
        <View style={styles.titleWrap}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.title}>Lumis</Text>
          <View style={styles.presenceRow}><View style={styles.presenceDot} /><Text style={styles.presenceText}>Acceptance</Text></View>
        </View>
        <Pressable accessibilityLabel="Past Reflections" accessibilityRole="button" style={styles.iconButton}><History color={ink.strong} size={18} /></Pressable>
        <Pressable accessibilityLabel="Start a new topic" accessibilityRole="button" onPress={reset} style={styles.iconButton}><Plus color={ink.strong} size={18} /></Pressable>
        <Pressable accessibilityLabel="Notifications" accessibilityRole="button" style={styles.iconButton}><Bell color={ink.strong} size={18} /></Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.chatContent}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.dayLabel}>TODAY</Text>
        <AssistantRow>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.assistantText}>
            {language === "en" ? "Hi Ruby. What feels most worth understanding today?" : "Ruby，你今日最想理解清楚嘅係甚麼？"}
          </Text>
        </AssistantRow>

        {submitted ? <View style={styles.userBubble}><Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.userText}>{submitted}</Text></View> : null}
        {phase === "thinking" ? (
          <AssistantRow>
            <View accessibilityLabel="Lumis is reflecting" accessibilityLiveRegion="polite" style={styles.thinkingRow}>
              <View style={styles.thinkingDot} /><View style={styles.thinkingDot} /><View style={styles.thinkingDot} />
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.assistantText}>{language === "en" ? "Reflecting..." : "整理思緒中…"}</Text>
            </View>
          </AssistantRow>
        ) : null}
        {phase === "response" && projection?.result === "completed" ? <AssistantRow><Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.assistantText}>{projection.assistant_message}</Text></AssistantRow> : null}
        {phase === "response" && projection?.result === "safety_rejected" ? (
          <AssistantRow>
            <View style={styles.safetyBlock}><Info color={ink.gold} size={16} /><Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.assistantText}>{projection.assistant_message}</Text></View>
          </AssistantRow>
        ) : null}
        {phase === "response" && projection?.result === "fixed_fallback" ? (
          <View style={styles.failedRow}>
            <View style={styles.avatar}><LumisPersonaAvatar avatarKey="psyche" size={26} /></View>
            <View style={styles.messageColumn}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.fallbackCopy}>{projection.assistant_message}</Text>
              <ChatFailedReply onNewTopic={reset} onRetry={retry} />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.disclaimer}><Info color="#71839A" size={12} /><Text style={styles.disclaimerText}>Reflective guidance, not professional advice.</Text></View>
        <ScrollView contentContainerStyle={styles.promptRow} horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false}>
          {PROMPTS[language].map((prompt) => <Pressable key={prompt} onPress={() => { setDraft(prompt); setValidation(null); }} style={styles.promptChip}><Text numberOfLines={1} style={styles.promptText}>{prompt}</Text></Pressable>)}
        </ScrollView>
        {validation ? <Text accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.validation}>{validation}</Text> : null}
        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="Message Lumis"
            maxLength={600}
            multiline
            onChangeText={(value) => { setDraft(value); setValidation(null); }}
            placeholder={language === "en" ? "Unpack your thoughts here..." : "寫低你而家嘅想法…"}
            placeholderTextColor="#71839A"
            style={styles.input}
            value={draft}
          />
          <Pressable accessibilityLabel="Send message" accessibilityRole="button" disabled={phase === "thinking"} onPress={submit}>
            <LinearGradient colors={SUNRISE} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={[styles.sendButton, phase === "thinking" && styles.disabled]}>
              {phase === "thinking" ? <RotateCcw color="#3A2218" size={17} /> : <Send color="#3A2218" size={18} />}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function AssistantRow({ children }: { children: ReactNode }) {
  return <View style={styles.assistantRow}><View style={styles.avatar}><LumisPersonaAvatar avatarKey="psyche" size={26} /></View><View style={styles.assistantBubble}>{children}</View></View>;
}

function Control({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.control, selected && styles.controlSelected]}><Text style={[styles.controlText, selected && styles.controlTextSelected]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#071321", flex: 1 },
  externalBand: { backgroundColor: "#071321", borderBottomColor: "rgba(215,185,120,0.35)", borderBottomWidth: 1, gap: 7, paddingHorizontal: 12, paddingVertical: 9 },
  externalMeta: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  externalTitle: { color: "#E8C98D", fontFamily: fontFamilies.sansBold, fontSize: 11, lineHeight: 14 },
  externalSha: { color: "#8A9BB0", flex: 1, fontFamily: "Courier", fontSize: 9, textAlign: "right" },
  externalControls: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  control: { borderColor: "rgba(255,255,255,0.14)", borderRadius: 999, borderWidth: 1, minHeight: 30, paddingHorizontal: 10, paddingVertical: 6 },
  controlSelected: { backgroundColor: "#D7B978", borderColor: "#D7B978" },
  controlText: { color: "#C4CEDB", fontFamily: fontFamilies.sansSemiBold, fontSize: 10 },
  controlTextSelected: { color: "#3A2218" },
  productFrame: { flex: 1, overflow: "hidden" },
  topBar: { alignItems: "center", flexDirection: "row", gap: 9, paddingHorizontal: 12, paddingVertical: 10 },
  iconButton: { alignItems: "center", height: 38, justifyContent: "center", width: 34 },
  titleWrap: { flex: 1 },
  title: { color: ink.strong, fontFamily: fontFamilies.displayMedium, fontSize: 18, lineHeight: 21 },
  presenceRow: { alignItems: "center", flexDirection: "row", gap: 5, marginTop: 2 },
  presenceDot: { backgroundColor: "#B8A7E8", borderRadius: 5, height: 7, width: 7 },
  presenceText: { color: ink.soft, fontFamily: fontFamilies.sansSemiBold, fontSize: 11 },
  chatContent: { flexGrow: 1, gap: 15, paddingBottom: 18, paddingHorizontal: 16, paddingTop: 8 },
  dayLabel: { color: ink.muted, fontFamily: fontFamilies.sansBold, fontSize: 10, letterSpacing: 1.5, textAlign: "center" },
  assistantRow: { alignItems: "flex-end", flexDirection: "row", gap: 8, maxWidth: "92%" },
  failedRow: { alignItems: "flex-start", flexDirection: "row", gap: 8, maxWidth: "95%" },
  avatar: { marginBottom: 2 },
  messageColumn: { flex: 1, gap: 8 },
  assistantBubble: { backgroundColor: "rgba(22,39,61,0.76)", borderColor: "rgba(255,255,255,0.09)", borderRadius: 18, borderBottomLeftRadius: 5, borderWidth: 1, flexShrink: 1, paddingHorizontal: 14, paddingVertical: 12 },
  assistantText: { color: ink.strong, flexShrink: 1, fontFamily: fontFamilies.sansRegular, fontSize: 14, lineHeight: 22 },
  userBubble: { alignSelf: "flex-end", backgroundColor: "rgba(215,185,120,0.2)", borderColor: "rgba(215,185,120,0.34)", borderRadius: 18, borderBottomRightRadius: 5, borderWidth: 1, maxWidth: "84%", paddingHorizontal: 14, paddingVertical: 11 },
  userText: { color: ink.strong, fontFamily: fontFamilies.sansRegular, fontSize: 14, lineHeight: 21 },
  thinkingRow: { alignItems: "center", flexDirection: "row", gap: 5 },
  thinkingDot: { backgroundColor: "#B8A7E8", borderRadius: 4, height: 5, width: 5 },
  safetyBlock: { alignItems: "flex-start", flexDirection: "row", gap: 9 },
  fallbackCopy: { color: ink.strong, fontFamily: fontFamilies.sansRegular, fontSize: 14, lineHeight: 21 },
  footer: { gap: 8, paddingBottom: 10, paddingHorizontal: 12 },
  disclaimer: { alignItems: "center", alignSelf: "center", flexDirection: "row", gap: 6 },
  disclaimerText: { color: "#71839A", fontFamily: fontFamilies.sansRegular, fontSize: 11 },
  promptRow: { gap: 8, paddingRight: 4 },
  promptChip: { backgroundColor: "rgba(22,39,61,0.55)", borderColor: "rgba(255,255,255,0.09)", borderRadius: 999, borderWidth: 1, maxWidth: 290, paddingHorizontal: 13, paddingVertical: 8 },
  promptText: { color: ink.soft, fontFamily: fontFamilies.sansSemiBold, fontSize: 12 },
  validation: { color: ink.warn, fontFamily: fontFamilies.sansMedium, fontSize: 12, lineHeight: 17, paddingHorizontal: 8 },
  composer: { alignItems: "center", backgroundColor: "rgba(22,39,61,0.72)", borderColor: "rgba(255,255,255,0.1)", borderRadius: 24, borderWidth: 1, flexDirection: "row", gap: 8, padding: 6 },
  input: { color: ink.strong, flex: 1, fontFamily: fontFamilies.sansMedium, fontSize: 15, maxHeight: 104, minHeight: 42, paddingHorizontal: 11, paddingVertical: 9 },
  sendButton: { alignItems: "center", borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  disabled: { opacity: 0.48 },
});

void founderChatEligibility;
