import { randomUUID } from "expo-crypto";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CareCircleStagingSessionGate } from "../../test-workbenches/care-circle-staging/CareCircleStagingSessionGate";
import { CareCircleStagingWorkbench } from "../../test-workbenches/care-circle-staging/CareCircleStagingWorkbench";
import { resolveFounderCareCircleEntryBoundary } from "../../test-workbenches/care-circle-staging/stagingWorkbenchBoundary";
import { createStagingWorkbenchPorts } from "../../test-workbenches/care-circle-staging/stagingWorkbenchPort";
import { createInactiveCareCircleClient } from "../services/inactiveCareCircleClient";
import { getSupabaseClient, getSupabaseConfig } from "../services/supabase";
import { colors, spacing } from "../theme/tokens";
import { CareCircleLocalRehearsal } from "./CareCircleLocalRehearsal";

export function FounderCareCircleWorkbench({ onBack }: { onBack: () => void }) {
  const [localRehearsal, setLocalRehearsal] = useState(false);
  if (localRehearsal) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header
          onBack={() => setLocalRehearsal(false)}
          subtitle="Synthetic states only"
          title="Care Circle rehearsal"
        />
        <CareCircleLocalRehearsal />
      </SafeAreaView>
    );
  }

  const boundary = resolveFounderCareCircleEntryBoundary({
    flag: process.env.EXPO_PUBLIC_CARE_CIRCLE_STAGING_WORKBENCH,
    projectRef: process.env.EXPO_PUBLIC_SUPABASE_PROJECT_REF,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    hasSupabasePublicKey: getSupabaseConfig().isConfigured,
    deploymentReady:
      process.env.EXPO_PUBLIC_CARE_CIRCLE_STAGING_DEPLOYMENT_READY,
    isDevelopment: __DEV__,
  });

  if (!boundary.enabled) {
    return (
      <BlockedState
        message={safeReadinessMessage(boundary.code)}
        onBack={onBack}
        onOpenRehearsal={() => setLocalRehearsal(true)}
      />
    );
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return (
      <BlockedState
        message="The normal Expo staging configuration is incomplete."
        onBack={onBack}
      />
    );
  }
  const ports = createStagingWorkbenchPorts(supabase);
  return (
    <SafeAreaView style={styles.safe}>
      <Header onBack={onBack} />
      <View style={styles.workbench}>
        <CareCircleStagingSessionGate sessionPort={ports.sessionPort}>
          {(capabilities, journeyPort) => (
            <CareCircleStagingWorkbench
              capabilities={capabilities}
              client={createInactiveCareCircleClient(ports.operationPort)}
              onEvidenceState={journeyPort.onEvidenceState}
              relationshipPort={ports.relationshipPort}
              requestIdFactory={randomUUID}
            />
          )}
        </CareCircleStagingSessionGate>
      </View>
    </SafeAreaView>
  );
}

function BlockedState({
  message,
  onBack,
  onOpenRehearsal,
}: {
  message: string;
  onBack: () => void;
  onOpenRehearsal?: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <Header onBack={onBack} />
      <View style={styles.blocked}>
        <ShieldCheck color={colors.gold} size={28} />
        <Text accessibilityRole="header" style={styles.blockedTitle}>
          Care Circle test is not ready
        </Text>
        <Text accessibilityLiveRegion="polite" style={styles.blockedBody}>
          {message}
        </Text>
        <Text style={styles.blockedDetail}>
          No staging operation was attempted.
        </Text>
        {onOpenRehearsal ? (
          <Pressable
            accessibilityLabel="Open local Care Circle rehearsal"
            accessibilityRole="button"
            onPress={onOpenRehearsal}
            style={styles.rehearsalButton}
          >
            <Text style={styles.rehearsalText}>Open local rehearsal</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Header({
  onBack,
  subtitle = "Disposable accounts only",
  title = "Care Circle staging test",
}: {
  onBack: () => void;
  subtitle?: string;
  title?: string;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Back to Founder Test Hub"
        accessibilityRole="button"
        onPress={onBack}
        style={styles.back}
      >
        <ArrowLeft color={colors.ice} size={20} />
      </Pressable>
      <View style={styles.headerCopy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function safeReadinessMessage(code: string): string {
  if (code === "CARE_CIRCLE_WORKBENCH_DEPLOYMENT_NOT_READY") {
    return "The inactive staging function has not been confirmed for this build.";
  }
  if (code === "CARE_CIRCLE_WORKBENCH_CONFIGURATION_REQUIRED") {
    return "The normal Expo staging configuration is incomplete.";
  }
  if (
    code === "CARE_CIRCLE_WORKBENCH_STAGING_REQUIRED" ||
    code === "CARE_CIRCLE_WORKBENCH_STAGING_URL_REQUIRED"
  ) {
    return "The configured project does not match the approved Care Circle staging project.";
  }
  return "This development-only staging workbench is disabled.";
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.navy950, flex: 1 },
  header: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 64,
    paddingHorizontal: spacing.lg,
  },
  back: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  headerCopy: { alignItems: "center", flex: 1 },
  title: { color: colors.ice, fontSize: 17, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 11, marginTop: 2 },
  headerSpacer: { width: 44 },
  workbench: { flex: 1 },
  blocked: {
    alignItems: "center",
    flex: 1,
    gap: spacing.sm,
    justifyContent: "center",
    padding: spacing.xl,
  },
  blockedTitle: {
    color: colors.ice,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  blockedBody: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 360,
    textAlign: "center",
  },
  blockedDetail: { color: colors.muted, fontSize: 12, marginTop: spacing.xs },
  rehearsalButton: {
    backgroundColor: colors.gold,
    justifyContent: "center",
    marginTop: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  rehearsalText: { color: colors.navy950, fontWeight: "800" },
});
