import { randomUUID } from "expo-crypto";
import { registerRootComponent } from "expo";
import { createElement } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";

import { createInactiveCareCircleClient } from "../../src/services/inactiveCareCircleClient";
import { getSupabaseClient } from "../../src/services/supabase";
import { CareCircleStagingWorkbench } from "./CareCircleStagingWorkbench";
import { resolveCareCircleWorkbenchBoundary } from "./stagingWorkbenchBoundary";
import { createStagingWorkbenchPorts } from "./stagingWorkbenchPort";

const boundary = resolveCareCircleWorkbenchBoundary({
  flag: process.env.EXPO_PUBLIC_CARE_CIRCLE_STAGING_WORKBENCH,
  projectRef: process.env.EXPO_PUBLIC_SUPABASE_PROJECT_REF,
  isDevelopment: __DEV__,
});
const supabase = boundary.enabled ? getSupabaseClient() : null;
const ports = supabase ? createStagingWorkbenchPorts(supabase) : null;

function Root() {
  const content =
    boundary.enabled && ports ? (
      <CareCircleStagingWorkbench
        client={createInactiveCareCircleClient(ports.operationPort)}
        relationshipPort={ports.relationshipPort}
        requestIdFactory={randomUUID}
      />
    ) : (
      <View style={styles.blocked}>
        <Text style={styles.title}>Care Circle workbench unavailable</Text>
        <Text style={styles.body}>
          This test-only entry requires an explicit development staging build
          and configured authenticated staging session.
        </Text>
      </View>
    );

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      {content}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  blocked: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#06101C",
  },
  title: { color: "#F0F4F8", fontSize: 20, fontWeight: "700" },
  body: {
    color: "#C4CEDB",
    maxWidth: 360,
    marginTop: 10,
    lineHeight: 20,
    textAlign: "center",
  },
});

registerRootComponent(Root);
