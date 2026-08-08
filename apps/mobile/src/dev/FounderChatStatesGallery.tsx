import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandPrimaryButton } from "../components/BrandPrimaryButton";
import { ScreenHeader, SoftButton } from "../components/states/StateKit";
import { ChatConfirmCard, ChatFailedReply } from "../features/chat/ChatConfirmationCards";
import { ink, type } from "../theme/typography";

/**
 * Founder-only conditional-state gallery (dev harness).
 *
 * Houses the deterministic review states that cannot be reached in normal use
 * without a backend failure or intent-detection: the chat confirmation bubbles
 * (TALK-005/006/007), the failed-reply state (TALK-003/007), and faithful
 * previews of AUTH-005 / CHART-004 / PERS-003. Every action transitions local
 * fixture state or states plainly that the effect is inactive — no dead buttons,
 * no backend, no account data touched.
 */

const CARD_BG = "rgba(20,32,50,0.72)";
const CARD_LINE = "rgba(215,185,120,0.28)";
const WARN = "#E38E7C";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionId}>{id}</Text>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function PreviewNote({ text }: { text: string }) {
  return (
    <View style={s.note}>
      <Text style={s.noteText}>{text}</Text>
    </View>
  );
}

export function FounderChatStatesGallery({
  onBack,
  onGoDice
}: {
  onBack: () => void;
  onGoDice: () => void;
}) {
  const [timingNote, setTimingNote] = useState<string | null>(null);
  const [compareNote, setCompareNote] = useState<string | null>(null);
  const [failedNote, setFailedNote] = useState<string | null>(null);
  const [chartRetried, setChartRetried] = useState(false);
  const [personaNote, setPersonaNote] = useState<string | null>(null);

  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={s.safe}>
      <ScreenHeader title="Chat & conditional states" onBack={onBack} />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>
          Deterministic review states. Actions here change local preview state only — no reflection, provider,
          scheduling, or account write runs in this build.
        </Text>

        <Section id="TALK-005" title="Timing-window confirmation">
          <ChatConfirmCard
            eyebrow="Timing-window reflection"
            heading="Look for a supportive launch window"
            rows={[
              { key: "Goal", value: "Start a side project" },
              { key: "Horizon", value: "Next 90 days" }
            ]}
            caveat="Your birth time is unknown, so timing precision is broader than usual."
            softLabel="Change horizon"
            primaryLabel="Confirm & reflect"
            onSoft={() => setTimingNote("Change horizon — a horizon picker opens here (not yet in this build).")}
            onPrimary={() => setTimingNote("Confirmed — the timing reflection would run here. The reflection call is inactive in this build.")}
          />
          {timingNote ? <PreviewNote text={timingNote} /> : null}
        </Section>

        <Section id="TALK-006" title="Specific-date comparison">
          <ChatConfirmCard
            eyebrow="Specific-date comparison"
            heading="Compare 3 dates for a move"
            rows={[
              { key: "Objective", value: "Best move date" },
              { key: "Date 1", value: "Mon 3 Nov 2026" },
              { key: "Date 2", value: "Wed 12 Nov 2026" },
              { key: "Date 3", value: "Fri 21 Nov 2026" }
            ]}
            caveat="Location and time-of-day precision affects some placements."
            softLabel="Edit dates"
            primaryLabel="Confirm comparison"
            onSoft={() => setCompareNote("Edit dates — a date-edit sheet opens here (not yet in this build).")}
            onPrimary={() => setCompareNote("Confirmed — the date comparison would run here. The reflection call is inactive in this build.")}
          />
          {compareNote ? <PreviewNote text={compareNote} /> : null}
        </Section>

        <Section id="TALK-007" title="Dice hand-off suggestion">
          <ChatConfirmCard
            eyebrow="Try a Dice throw?"
            heading="Reframe the question in Dice"
            body="Dice will ask you to phrase one clear question. It stays reflective — not a verdict."
            softLabel="Not now"
            primaryLabel="Go to Dice"
            onSoft={() => setCompareNote(null)}
            onPrimary={onGoDice}
          />
        </Section>

        <Section id="TALK-003" title="Failed reply / retry">
          <ChatFailedReply
            onRetry={() => setFailedNote("Retry — the same turn is re-sent (blocked while a send is in flight). Inactive in this preview.")}
            onNewTopic={() => setFailedNote("New topic — the composer resets to a clean thread.")}
          />
          {failedNote ? <PreviewNote text={failedNote} /> : null}
        </Section>

        <Section id="AUTH-005" title="Restored account found">
          <View style={s.card}>
            <Text style={s.eyebrow}>✦ RESTORED ACCOUNT FOUND</Text>
            <Text style={s.cardTitle}>Your Lumis account</Text>
            <Text style={s.cardLead}>Your active chart and Past Reflections have been restored on this account.</Text>
            <View style={s.innerRow}>
              <Text style={s.rowTitle}>Chart and reflections found</Text>
              <Text style={s.rowSub}>Linked to your private account.</Text>
            </View>
            <BrandPrimaryButton label="Continue to Lumis" onPress={() => {}} accessibilityLabel="Continue to Lumis (preview)" />
            <SoftButton label="Log out" onPress={() => {}} style={s.softSpace} />
          </View>
          <PreviewNote text="Review state only — appears in the real app after a deliberate account reload; not a normal cold-launch screen." />
        </Section>

        <Section id="CHART-004" title="Chart-generation error">
          <View style={s.card}>
            <Text style={s.eyebrow}>✦ CHART NOT COMPLETED</Text>
            <Text style={s.cardTitle}>We couldn't finish your chart.</Text>
            <Text style={s.cardLead}>Something interrupted the calculation. Your birth details are still saved — nothing has been charged.</Text>
            <View style={s.innerRow}>
              <Text style={s.rowLabel}>YOUR SAVED DETAILS</Text>
              <Text style={s.rowSub}>12 October 1992 · 6:00 AM · London, UK</Text>
            </View>
            <BrandPrimaryButton
              label={chartRetried ? "Trying again…" : "Try again"}
              busy={chartRetried}
              onPress={() => setChartRetried(true)}
              accessibilityLabel="Try again (preview)"
            />
            <SoftButton label="Edit birth details" onPress={() => setChartRetried(false)} style={s.softSpace} />
          </View>
          <PreviewNote text="Review state only — reached when chart generation fails. No chart is created and no charge is made." />
        </Section>

        <Section id="PERS-003" title="Persona save error">
          <View style={s.card}>
            <View style={s.warnBanner}>
              <Text style={s.warnText}>
                <Text style={s.warnBold}>Please check this. </Text>
                We couldn't save your Lumis choice. Your active persona hasn't changed. Please try again.
              </Text>
            </View>
            <BrandPrimaryButton
              label="Retry saving"
              onPress={() => setPersonaNote("Retry saving — the last persona save is retried. The save call is inactive in this preview.")}
              accessibilityLabel="Retry saving (preview)"
            />
            <Text
              accessibilityRole="button"
              onPress={() => setPersonaNote("Cancelled — the pending selection is discarded; your current Lumis is kept.")}
              style={s.cancelText}
            >
              Cancel — keep current Lumis
            </Text>
            {personaNote ? <PreviewNote text={personaNote} /> : null}
          </View>
          <PreviewNote text="Review state only — a failed persona save never silently changes your active persona." />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { backgroundColor: "#0B1930", flex: 1 },
  content: { paddingBottom: 40, paddingHorizontal: 20, paddingTop: 6 },
  intro: { ...type.bodySmall, marginBottom: 18 },
  section: { marginBottom: 26 },
  sectionId: { ...type.eyebrow, marginBottom: 4 },
  sectionTitle: { ...type.sectionHeading, fontSize: 18, marginBottom: 12 },
  card: { backgroundColor: CARD_BG, borderColor: CARD_LINE, borderRadius: 18, borderWidth: 1, padding: 18 },
  eyebrow: { ...type.eyebrow, marginBottom: 8 },
  cardTitle: { ...type.sectionHeading, marginBottom: 8 },
  cardLead: { ...type.body, marginBottom: 14 },
  innerRow: { backgroundColor: "rgba(58,80,118,0.24)", borderRadius: 12, marginBottom: 14, paddingHorizontal: 14, paddingVertical: 12 },
  rowLabel: { ...type.fieldLabel, marginBottom: 4 },
  rowTitle: { ...type.cardHeading, fontSize: 14.5, marginBottom: 3 },
  rowSub: { ...type.bodySmall },
  softSpace: { marginTop: 10 },
  warnBanner: { backgroundColor: "rgba(227,142,124,0.1)", borderColor: "rgba(227,142,124,0.34)", borderRadius: 14, borderWidth: 1, marginBottom: 14, paddingHorizontal: 14, paddingVertical: 12 },
  warnText: { color: ink.strong, fontFamily: type.body.fontFamily, fontSize: 13, lineHeight: 19 },
  warnBold: { color: WARN, fontWeight: "700" },
  cancelText: { ...type.buttonLabelSmall, color: ink.soft, marginTop: 14, textAlign: "center" },
  note: { backgroundColor: "rgba(123,199,132,0.08)", borderColor: "rgba(123,199,132,0.3)", borderRadius: 12, borderWidth: 1, marginTop: 10, paddingHorizontal: 12, paddingVertical: 10 },
  noteText: { ...type.bodySmall, color: ink.soft }
});
