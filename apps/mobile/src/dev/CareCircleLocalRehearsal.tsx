import { randomUUID } from "expo-crypto";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CareCircleStagingWorkbench } from "../../test-workbenches/care-circle-staging/CareCircleStagingWorkbench";
import { createLocalCareCircleRehearsal, type LocalRehearsalRole } from "../../test-workbenches/care-circle-staging/localCareCircleRehearsal";
import { advanceSinglePhoneJourney, createSinglePhoneJourney } from "../../test-workbenches/care-circle-staging/singlePhoneJourney";
import { createInactiveCareCircleClient } from "../services/inactiveCareCircleClient";
import { colors, spacing } from "../theme/tokens";

export function CareCircleLocalRehearsal() {
  const [harness, setHarness] = useState(createLocalCareCircleRehearsal);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [role, setRole] = useState<LocalRehearsalRole>("caree");
  const [journey, setJourney] = useState(createSinglePhoneJourney);
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

  return (
    <View style={styles.shell}>
      <View accessibilityLiveRegion="polite" style={styles.banner}>
        <Text accessibilityRole="header" style={styles.title}>
          Local rehearsal — not live backend
        </Text>
        <Text style={styles.body}>
          Disposable synthetic states only. Nothing here is staging evidence.
        </Text>
        <Text style={styles.current}>Current: {journey.label}</Text>
        <Text style={styles.body}>{journey.nextLabel}</Text>
      </View>
      <View accessibilityRole="tablist" style={styles.switcher}>
        {(["caree", "carer"] as const).map((item) => (
          <Pressable
            accessibilityLabel={`Use synthetic ${item === "caree" ? "Caree" : "Carer"} account`}
            accessibilityRole="tab"
            accessibilityState={{ selected: role === item }}
            key={item}
            onPress={() => switchAccount(item)}
            style={[styles.switchButton, role === item && styles.selected]}
          >
            <Text style={styles.switchText}>
              Synthetic {item === "caree" ? "Caree" : "Carer"}
            </Text>
          </Pressable>
        ))}
      </View>
      <CareCircleStagingWorkbench
        key={`${role}-${sessionEpoch}`}
        capabilities={{
          accountRole: role,
          canActAsCaree: role === "caree",
          canActAsCarer: role === "carer",
          careCirclePaused: harness.snapshot().paused,
        }}
        client={client}
        mode="local_rehearsal"
        onEvidenceState={(input) =>
          setJourney((current) => advanceSinglePhoneJourney(current, input))
        }
        relationshipPort={harness.relationshipPort(role)}
        requestIdFactory={randomUUID}
      />
      <View style={styles.footer}>
        <Pressable
          accessibilityLabel="Confirm synthetic relationship cleanup"
          accessibilityRole="button"
          onPress={confirmCleanup}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>Confirm synthetic cleanup</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Reset local Care Circle rehearsal"
          accessibilityRole="button"
          onPress={reset}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>Reset rehearsal</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  banner: {
    backgroundColor: colors.surface,
    borderColor: colors.gold,
    borderWidth: 1,
    gap: 6,
    margin: spacing.md,
    padding: spacing.md,
  },
  title: { color: colors.goldLight, fontSize: 18, fontWeight: "800" },
  current: { color: colors.ice, fontSize: 15, fontWeight: "700" },
  body: { color: colors.textSoft, fontSize: 13, lineHeight: 19 },
  switcher: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md },
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
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    padding: spacing.md,
  },
  secondary: {
    borderColor: colors.line,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  secondaryText: { color: colors.textSoft, fontWeight: "700" },
});
