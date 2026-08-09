import ArrowLeft from "lucide-react-native/icons/arrow-left";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CelestialBackground } from "../components/CelestialBackground";
import { DiceRitualScreen } from "../features/dice/DiceRitualScreen";
import { colors, spacing } from "../theme/tokens";
import {
  buildInteractiveDiceFixture,
  DICE_INACTIVE_FOUNDER_DECISIONS,
  DICE_INTERPRETATION_FIXTURES,
  DICE_EXACT_CAPTURE_FIXTURES,
  getDiceExactCaptureFixture,
  getDiceFixture,
} from "./diceInterpretationFixture";

export function FounderDiceInterpretationWorkbench({ onBack }: { onBack: () => void }) {
  const initialCaptureState = process.env.EXPO_PUBLIC_DICE_CAPTURE_STATE;
  const [captureState, setCaptureState] = useState(initialCaptureState);
  const [index, setIndex] = useState(resolveDiceCaptureIndex(initialCaptureState));
  const fixture = captureState
    ? getDiceExactCaptureFixture(captureState)
    : DICE_INTERPRETATION_FIXTURES[index];
  const captureMode = Boolean(captureState);
  const buildMarker = resolveDiceBuildMarker(process.env.EXPO_PUBLIC_DICE_GALLERY_HEAD);

  useEffect(() => {
    const selectFromUrl = ({ url }: { url: string }) => {
      const state = new URL(url).searchParams.get("state") ?? undefined;
      setCaptureState(state);
      setIndex(resolveDiceCaptureIndex(state));
    };
    const subscription = Linking.addEventListener("url", selectFromUrl);
    void Linking.getInitialURL().then((url) => url && selectFromUrl({ url }));
    return () => subscription.remove();
  }, []);

  const previous = () => setIndex((current) => (current + DICE_INTERPRETATION_FIXTURES.length - 1) % DICE_INTERPRETATION_FIXTURES.length);
  const next = () => setIndex((current) => (current + 1) % DICE_INTERPRETATION_FIXTURES.length);
  const externalLabel = `${fixture.classification} · ${fixture.routeLabel}`;

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
      <CelestialBackground />
      {!captureMode ? (
        <View accessibilityLabel={`Local deterministic Dice fixture. ${externalLabel}. No live AI, persistence, or units.`} style={styles.fixtureBar}>
          <Pressable accessibilityLabel="Back to Founder Test Hub" accessibilityRole="button" onPress={onBack} style={styles.iconButton}>
            <ArrowLeft color={colors.ice} size={19} />
          </Pressable>
          <View style={styles.fixtureCopy}>
            <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{fixture.title} · {fixture.language}</Text>
            <Text numberOfLines={2} style={styles.classification}>Founder evidence: {externalLabel}</Text>
            <Text numberOfLines={1} style={styles.disclaimer} testID="dice-zero-effects-boundary">Local deterministic fixture · zero provider · zero units · zero persistence</Text>
            <Text selectable style={styles.buildMarker}>Build {buildMarker}</Text>
            <Text style={styles.inactive}>Length · persona · repeat wording remain unselected</Text>
          </View>
          <View style={styles.pager}>
            <Pressable accessibilityLabel="Previous fixture" accessibilityRole="button" onPress={previous} style={styles.pagerButton}><ChevronLeft color={colors.ice} size={19} /></Pressable>
            <Pressable accessibilityLabel="Next fixture" accessibilityRole="button" onPress={next} style={styles.pagerButton}><ChevronRight color={colors.ice} size={19} /></Pressable>
          </View>
        </View>
      ) : (
        <View accessibilityLabel={`Verified local Dice fixture ${fixture.id}. Full build ${buildMarker}. No persistence, units, or live AI.`} style={styles.captureEvidenceStrip} testID="dice-capture-evidence-strip">
          <Text adjustsFontSizeToFit allowFontScaling={false} minimumFontScale={0.7} numberOfLines={1} style={styles.captureEvidenceText}>STATE {captureState}</Text>
          <Text adjustsFontSizeToFit allowFontScaling={false} minimumFontScale={0.7} numberOfLines={1} selectable style={styles.captureBuildText}>BUILD {buildMarker}</Text>
        </View>
      )}
      <View style={styles.productFrame}>
        <DiceRitualScreen
          developmentBuildInterpretation={fixture.screen === "interactive" ? buildInteractiveDiceFixture : undefined}
          developmentFixture={fixture.screen === "result" ? fixture : undefined}
          developmentInitialBoundaryError={fixture.screen === "question" ? fixture.boundaryMessage ?? undefined : undefined}
          developmentInitialQuestion={fixture.screen !== "result" ? fixture.question : undefined}
          developmentLanguage={fixture.language}
          developmentNoPersistence
          developmentPreSubmitBoundary
          key={fixture.id}
          onBack={onBack}
          onNotifications={() => undefined}
          onReflect={() => undefined}
          onSelectTab={() => undefined}
        />
      </View>
    </SafeAreaView>
  );
}

export function resolveDiceBuildMarker(value: string | undefined): string {
  return value && /^[0-9a-f]{40}$/.test(value) ? value : "INVALID_BUILD_MARKER";
}

export function resolveDiceCaptureIndex(value: string | undefined): number {
  const fixtureId = value && value in DICE_EXACT_CAPTURE_FIXTURES
    ? DICE_EXACT_CAPTURE_FIXTURES[value as keyof typeof DICE_EXACT_CAPTURE_FIXTURES]
    : value;
  const index = DICE_INTERPRETATION_FIXTURES.findIndex((fixture) => fixture.id === fixtureId);
  return index >= 0 ? index : 0;
}

export function resolveDiceFixtureFromUrl(url: string): string {
  return getDiceFixture(new URL(url).searchParams.get("state") ?? undefined).id;
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.navy950, flex: 1 },
  fixtureBar: { alignItems: "center", backgroundColor: "rgba(6,16,28,0.97)", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: spacing.sm, minHeight: 96, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  captureEvidenceStrip: { backgroundColor: "#081423", borderBottomColor: colors.line, borderBottomWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  captureEvidenceText: { color: colors.goldLight, fontSize: 9, fontWeight: "700", lineHeight: 11, textAlign: "center" },
  captureBuildText: { color: colors.muted, fontFamily: "monospace", fontSize: 7, lineHeight: 9, textAlign: "center" },
  iconButton: { alignItems: "center", borderColor: colors.line, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
  fixtureCopy: { flex: 1, gap: 2, minWidth: 0 },
  title: { color: colors.ice, fontSize: 14, fontWeight: "700" },
  classification: { color: colors.goldLight, fontSize: 11, fontWeight: "700", lineHeight: 14 },
  disclaimer: { color: colors.textSoft, fontSize: 10.5, lineHeight: 14 },
  buildMarker: { color: colors.muted, fontFamily: "monospace", fontSize: 9, lineHeight: 12 },
  inactive: { color: colors.muted, display: DICE_INACTIVE_FOUNDER_DECISIONS.finalResultLength === "inactive_unresolved" ? "flex" : "none", fontSize: 10 },
  pager: { flexDirection: "row", gap: 6 },
  pagerButton: { alignItems: "center", borderColor: colors.line, borderRadius: 18, borderWidth: 1, height: 38, justifyContent: "center", width: 36 },
  productFrame: { flex: 1, minHeight: 0 },
});
