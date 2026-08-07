import { randomUUID } from "expo-crypto";
import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { CareCircleStagingWorkbench } from "../../test-workbenches/care-circle-staging/CareCircleStagingWorkbench";
import { createLocalCareCircleRehearsal, type LocalRehearsalRole } from "../../test-workbenches/care-circle-staging/localCareCircleRehearsal";
import { advanceSinglePhoneJourney, createSinglePhoneJourney } from "../../test-workbenches/care-circle-staging/singlePhoneJourney";
import { createInactiveCareCircleClient } from "../services/inactiveCareCircleClient";
import { colors, spacing } from "../theme/tokens";
import { CARE_CIRCLE_FOUNDER_PRODUCT_STATES, CARE_CIRCLE_FOUNDER_STATE_LABELS, founderProductStateRole, type CareCircleFounderProductState } from "../../test-workbenches/care-circle-staging/founderProductStates";

export function CareCircleLocalRehearsal({ onBack }: { onBack: () => void }) {
  const [harness, setHarness] = useState(createLocalCareCircleRehearsal);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [role, setRole] = useState<LocalRehearsalRole>("caree");
  const [journey, setJourney] = useState(createSinglePhoneJourney);
  const [testPanelVisible, setTestPanelVisible] = useState(false);
  const client = useMemo(
    () => createInactiveCareCircleClient(harness.operationPort(role)),
    [harness, role]
  );

  function switchAccount(nextRole: LocalRehearsalRole) {
    setRole(nextRole);
    setSessionEpoch((value) => value + 1);
  }

  function reset() {
    setHarness(createLocalCareCircleRehearsal());
    setRole("caree");
    setJourney(createSinglePhoneJourney());
    setSessionEpoch((value) => value + 1);
  }

  function confirmCleanup() {
    if (!harness.cleanup()) return;
    setJourney((current) =>
      advanceSinglePhoneJourney(current, {
        accountRole: "carer",
        evidenceName: "relationship_cleanup_complete",
        confirmationSource: "safe_projection",
      })
    );
    setSessionEpoch((value) => value + 1);
  }

  function openFounderState(state: CareCircleFounderProductState) {
    harness.loadFounderState(state);
    setRole(founderProductStateRole(state));
    setSessionEpoch((value) => value + 1);
    setTestPanelVisible(false);
  }

  return (
    <View style={styles.shell}>
      <CareCircleStagingWorkbench
        key={`${role}-${sessionEpoch}`}
        capabilities={{
          accountRole: role,
          canActAsCaree: role === "caree",
          canActAsCarer: role === "carer",
          careCirclePaused: harness.snapshot().paused,
        }}
        client={client}
        onBack={() => setTestPanelVisible(true)}
        onEvidenceState={(input) =>
          setJourney((current) => advanceSinglePhoneJourney(current, input))
        }
        relationshipPort={harness.relationshipPort(role)}
        requestIdFactory={randomUUID}
        founderState={harness.snapshot().founderState}
      />
      <Modal animationType="fade" onRequestClose={() => setTestPanelVisible(false)} transparent visible={testPanelVisible}>
        <View style={styles.scrim}>
          <View style={styles.panel}>
            <Text accessibilityRole="header" style={styles.title}>Founder test controls</Text>
            <Text style={styles.body}>Local rehearsal only. No live backend or staging evidence.</Text>
            <Text style={styles.step}>Current: {journey.label}</Text>
            <Text style={styles.body}>Next: {journey.nextLabel}</Text>
            <Text style={styles.stateHeading}>Open a product state</Text>
            <View style={styles.stateGrid}>
              {CARE_CIRCLE_FOUNDER_PRODUCT_STATES.map((state) => (
                <Pressable accessibilityLabel={`Open ${CARE_CIRCLE_FOUNDER_STATE_LABELS[state]}`} accessibilityRole="button" key={state} onPress={() => openFounderState(state)} style={styles.stateButton}>
                  <Text style={styles.stateButtonText}>{CARE_CIRCLE_FOUNDER_STATE_LABELS[state]}</Text>
                </Pressable>
              ))}
            </View>
            <View accessibilityRole="tablist" style={styles.switcher}>
              {(["caree", "carer"] as const).map((item) => (
                <Pressable accessibilityRole="tab" accessibilityState={{ selected: role === item }} key={item} onPress={() => { switchAccount(item); setTestPanelVisible(false); }} style={[styles.switchButton, role === item && styles.selected]}>
                  <Text style={styles.switchText}>{item === "caree" ? "Use Caree" : "Use Carer"}</Text>
                </Pressable>
              ))}
            </View>
        <Pressable
          accessibilityLabel="Confirm local relationship cleanup"
          accessibilityRole="button"
          onPress={confirmCleanup}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>Confirm cleanup</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Start the local Care Circle test over"
          accessibilityRole="button"
          onPress={reset}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>Start over</Text>
        </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setTestPanelVisible(false)} style={styles.close}><Text style={styles.secondaryText}>Close</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={onBack} style={styles.close}><Text style={styles.secondaryText}>Back to Founder Tests</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  title: { color: colors.goldLight, fontSize: 18, fontWeight: "800" },
  body: { color: colors.textSoft, fontSize: 13, lineHeight: 19 },
  step: { color: colors.ice, fontSize: 16, fontWeight: "800", marginTop: spacing.sm },
  switcher: { flexDirection: "row", gap: spacing.sm },
  stateHeading: { color: colors.goldLight, fontSize: 12, fontWeight: "800", marginTop: spacing.sm },
  stateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  stateButton: { borderColor: colors.line, borderRadius: 8, borderWidth: 1, justifyContent: "center", minHeight: 40, paddingHorizontal: 8 },
  stateButtonText: { color: colors.textSoft, fontSize: 11 },
  switchButton: {
    borderColor: colors.line,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    padding: spacing.sm,
  },
  selected: {
    backgroundColor: colors.periwinkleFill,
    borderColor: colors.periwinkle,
  },
  switchText: {
    color: colors.ice,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  scrim: { alignItems: "center", backgroundColor: "rgba(2,10,18,0.7)", flex: 1, justifyContent: "center", padding: spacing.lg },
  panel: { backgroundColor: colors.surface, borderColor: colors.gold, borderRadius: 18, borderWidth: 1, gap: spacing.sm, maxWidth: 420, padding: spacing.lg, width: "100%" },
  secondary: {
    borderColor: colors.line,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  secondaryText: { color: colors.textSoft, fontWeight: "700" },
  close: { alignItems: "center", justifyContent: "center", minHeight: 48 },
});
