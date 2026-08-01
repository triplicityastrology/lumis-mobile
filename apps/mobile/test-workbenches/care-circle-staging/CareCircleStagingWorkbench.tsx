import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type {
  CareCircleClientInput,
  CareCircleClientResult,
  InactiveCareCircleClient,
} from "../../src/services/inactiveCareCircleClient";
import { colors, spacing } from "../../src/theme/tokens";
import type { WorkbenchCapabilities } from "./stagingWorkbenchPort";
import { resolveWorkbenchProgress } from "./workbenchProgress";

export type WorkbenchRelationship = {
  relationshipId: string;
  participantRole: "caree" | "carer";
  otherDisplayName: string;
  status:
    | "pending_caree_acceptance"
    | "active"
    | "declined"
    | "removed_by_caree"
    | "removed_by_carer"
    | "expired";
};

export type WorkbenchRelationshipPort = {
  listRelationships(): Promise<WorkbenchRelationship[]>;
};

type Notice = {
  tone: "info" | "success" | "error";
  text: string;
};

export function CareCircleStagingWorkbench({
  capabilities,
  client,
  relationshipPort,
  requestIdFactory,
  now = () => Date.now(),
}: {
  capabilities: WorkbenchCapabilities;
  client: InactiveCareCircleClient;
  relationshipPort: WorkbenchRelationshipPort;
  requestIdFactory: () => string;
  now?: () => number;
}) {
  const [role, setRole] = useState<"caree" | "carer">(
    capabilities.canActAsCaree ? "caree" : "carer"
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingCodeExpiresAt, setPairingCodeExpiresAt] = useState<
    string | null
  >(null);
  const [pairingCodeInput, setPairingCodeInput] = useState("");
  const [relationships, setRelationships] = useState<WorkbenchRelationship[]>(
    []
  );
  const [paused, setPaused] = useState(capabilities.careCirclePaused);
  const [lastSuccessfulOperation, setLastSuccessfulOperation] = useState<
    "relationship_removed" | null
  >(null);

  const careeRelationships = relationships.filter(
    (relationship) => relationship.participantRole === "caree"
  );
  const pending = careeRelationships.filter(
    (relationship) => relationship.status === "pending_caree_acceptance"
  );
  const accepted = careeRelationships.filter(
    (relationship) => relationship.status === "active"
  );
  const carerRelationships = relationships.filter(
    (relationship) => relationship.participantRole === "carer"
  );
  const atCapacity = accepted.length >= 5;
  const codeIsExpired =
    pairingCodeExpiresAt !== null &&
    Date.parse(pairingCodeExpiresAt) <= now();
  const progress = resolveWorkbenchProgress({
    authenticated: true,
    role,
    hasUsablePairingCode: Boolean(pairingCode) && !codeIsExpired,
    paused,
    relationships,
    lastSuccessfulOperation,
  });

  function switchRole(nextRole: "caree" | "carer") {
    if (
      (nextRole === "caree" && !capabilities.canActAsCaree) ||
      (nextRole === "carer" && !capabilities.canActAsCarer)
    ) {
      return;
    }
    setRole(nextRole);
    setPairingCode(null);
    setPairingCodeExpiresAt(null);
    setPairingCodeInput("");
    setRelationships([]);
    setNotice(null);
    setLastSuccessfulOperation(null);
  }

  async function runAction(
    input: CareCircleClientInput
  ): Promise<CareCircleClientResult> {
    setBusy(input.action);
    setNotice(null);
    const result = await client.execute(input);
    setBusy(null);

    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return result;
    }

    if (result.code === "CARE_CIRCLE_PAIRING_CODE_READY") {
      const lifetime = Date.parse(result.expiresAt) - now();
      if (lifetime <= 0 || lifetime > 61 * 60 * 1000) {
        setPairingCode(null);
        setPairingCodeExpiresAt(null);
        setNotice({
          tone: "error",
          text: "The staging pairing code expiry could not be verified.",
        });
        return result;
      }
      setPairingCode(result.pairingCode);
      setPairingCodeExpiresAt(result.expiresAt);
      setNotice({
        tone: "success",
        text: "Reusable pairing code ready for this one-hour staging window.",
      });
      return result;
    }

    if (result.code === "CARE_CIRCLE_PENDING_CAREE_ACCEPTANCE") {
      setNotice({
        tone: "success",
        text: "Request sent. It is pending Caree acceptance and has no active authority.",
      });
      return result;
    }

    if (result.code === "CARE_CIRCLE_RELATIONSHIP_ACCEPTED") {
      setNotice({
        tone: "success",
        text: "Carer accepted. Refresh relationships to verify active status.",
      });
      return result;
    }
    if (result.code === "CARE_CIRCLE_RELATIONSHIP_DECLINED") {
      setNotice({
        tone: "success",
        text: "Pending request declined.",
      });
      return result;
    }
    if (result.code === "CARE_CIRCLE_RELATIONSHIP_REMOVED") {
      setLastSuccessfulOperation("relationship_removed");
      setNotice({
        tone: "success",
        text: "Accepted relationship removed.",
      });
      return result;
    }
    if (result.code === "CARE_CIRCLE_PAUSED") {
      setPaused(true);
      setNotice({
        tone: "success",
        text: "Care Circle is paused for this staging account.",
      });
      return result;
    }

    setPaused(false);
    setNotice({
      tone: "success",
      text: "Care Circle resumed for this staging account.",
    });
    return result;
  }

  async function refreshRelationships(announce = true) {
    setBusy("refresh_relationships");
    if (announce) setNotice(null);
    try {
      setRelationships(await relationshipPort.listRelationships());
      setLastSuccessfulOperation(null);
      if (announce) {
        setNotice({
          tone: "info",
          text: "Participant-safe staging relationships refreshed.",
        });
      }
    } catch {
      setNotice({
        tone: "error",
        text: "Relationships could not be refreshed. Try again.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function createOrRotateCode(rotation: boolean) {
    if (rotation) {
      setPairingCode(null);
      setPairingCodeExpiresAt(null);
    }
    await runAction({
      action: rotation ? "rotate_pairing_code" : "create_pairing_code",
      clientRequestId: requestIdFactory(),
    });
  }

  async function submitPairingCode() {
    const transientCode = pairingCodeInput;
    setPairingCodeInput("");
    const result = await runAction({
      action: "submit_pairing_code",
      clientRequestId: requestIdFactory(),
      pairingCode: transientCode,
    });
    if (result.ok) await refreshRelationships(false);
  }

  async function actOnRelationship(
    action:
      | "accept_relationship"
      | "decline_relationship"
      | "remove_relationship",
    relationshipId: string
  ) {
    const result = await runAction({
      action,
      clientRequestId: requestIdFactory(),
      relationshipId,
    });
    if (
      !result.ok &&
      action === "accept_relationship" &&
      atCapacity &&
      result.code === "CARE_CIRCLE_REQUEST_CONFLICT"
    ) {
      setNotice({
        tone: "success",
        text: "Backend rejected the sixth active Carer. The maximum remains five.",
      });
      return;
    }
    if (result.ok && action !== "remove_relationship") {
      await refreshRelationships(false);
    }
  }

  const disabled = busy !== null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>STAGING TEST WORKBENCH</Text>
        <Text style={styles.title}>Care Circle validation</Text>
        <Text style={styles.warning}>
          Disposable staging accounts only. This is not a release feature.
        </Text>

        <View
          accessibilityLabel={`Care Circle test progress: ${progress.label}. ${progress.guidance}`}
          accessibilityLiveRegion="polite"
          style={styles.progress}
        >
          <Text style={styles.progressName}>{progress.label}</Text>
          <Text style={styles.progressGuidance}>{progress.guidance}</Text>
          <Text style={styles.progressEvidence}>
            Evidence state: {progress.evidenceName}
          </Text>
        </View>

        <View style={styles.roleRow} accessibilityRole="tablist">
          {(["caree", "carer"] as const).map((item) => {
            const roleAllowed =
              item === "caree"
                ? capabilities.canActAsCaree
                : capabilities.canActAsCarer;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{
                  disabled: !roleAllowed,
                  selected: role === item,
                }}
                disabled={disabled || !roleAllowed}
                key={item}
                onPress={() => switchRole(item)}
                style={[
                  styles.roleButton,
                  role === item && styles.roleSelected,
                  !roleAllowed && styles.disabled,
                ]}
              >
                <Text style={styles.roleText}>
                  {item === "caree" ? "Caree" : "Carer"}
                  {roleAllowed ? " enabled" : " blocked"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {notice ? (
          <View
            accessibilityLiveRegion="polite"
            style={[
              styles.notice,
              notice.tone === "error" && styles.noticeError,
            ]}
          >
            <Text style={styles.noticeText}>{notice.text}</Text>
          </View>
        ) : null}

        {role === "caree" ? (
          <>
            <Section title="Reusable pairing code">
              <Text style={styles.body}>
                A newly created or rotated code is reusable for one hour.
                Rotation blocks new submissions with the previous code.
              </Text>
              {pairingCode && !codeIsExpired ? (
                <View style={styles.codeArea}>
                  <Text style={styles.codeLabel}>STAGING PAIRING CODE</Text>
                  <Text selectable style={styles.codeValue}>
                    {pairingCode}
                  </Text>
                  <Text style={styles.meta}>
                    Expires {formatStagingTime(pairingCodeExpiresAt)}
                  </Text>
                </View>
              ) : pairingCodeExpiresAt ? (
                <Text style={styles.errorText}>
                  This code has expired and cannot accept new submissions.
                </Text>
              ) : null}
              <View style={styles.actionRow}>
                <Action
                  disabled={disabled}
                  label="Create code"
                  onPress={() => void createOrRotateCode(false)}
                />
                <Action
                  disabled={disabled}
                  label="Rotate code"
                  onPress={() => void createOrRotateCode(true)}
                  secondary
                />
              </View>
            </Section>

            <Section title="Pending Caree acceptance">
              <Text style={styles.body}>
                Pending requests have no active Care Circle authority.
              </Text>
              <Action
                disabled={disabled}
                label={busy === "refresh_relationships" ? "Loading..." : "Refresh requests"}
                onPress={() => void refreshRelationships()}
                secondary
              />
              {pending.length === 0 ? (
                <Text style={styles.empty}>No pending requests loaded.</Text>
              ) : (
                pending.map((relationship) => (
                  <RelationshipRow
                    key={relationship.relationshipId}
                    relationship={relationship}
                    actions={[
                      {
                        label: atCapacity ? "Test sixth rejection" : "Accept",
                        disabled,
                        onPress: () =>
                          void actOnRelationship(
                            "accept_relationship",
                            relationship.relationshipId
                          ),
                      },
                      {
                        label: "Decline",
                        disabled,
                        onPress: () =>
                          void actOnRelationship(
                            "decline_relationship",
                            relationship.relationshipId
                          ),
                      },
                    ]}
                  />
                ))
              )}
            </Section>

            <Section title={`Accepted Carers · ${accepted.length}/5`}>
              <Text style={styles.body}>
                Five accepted Carers is the maximum. The backend remains authoritative.
              </Text>
              {accepted.map((relationship) => (
                <RelationshipRow
                  key={relationship.relationshipId}
                  relationship={relationship}
                  actions={[
                    {
                      label: "Remove",
                      disabled,
                      onPress: () =>
                        void actOnRelationship(
                          "remove_relationship",
                          relationship.relationshipId
                        ),
                    },
                  ]}
                />
              ))}
              <Action
                disabled={disabled}
                label={paused ? "Resume Care Circle" : "Pause Care Circle"}
                onPress={() =>
                  void runAction(
                    paused
                      ? {
                          action: "resume_care",
                          clientRequestId: requestIdFactory(),
                        }
                      : {
                          action: "pause_care",
                          clientRequestId: requestIdFactory(),
                          pausedUntil: new Date(
                            now() + 24 * 60 * 60 * 1000
                          ).toISOString(),
                        }
                  )
                }
                secondary
              />
            </Section>
          </>
        ) : (
          <>
            <Section title="Submit Caree pairing code">
              <Text style={styles.body}>
                Submission creates a pending request only. The Caree must accept
                it before this account receives any Care Circle authority.
              </Text>
              <TextInput
                accessibilityLabel="Staging pairing code"
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!disabled}
                onChangeText={setPairingCodeInput}
                placeholder="Enter the Caree staging code"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={pairingCodeInput}
              />
              <Action
                disabled={disabled || pairingCodeInput.trim().length === 0}
                label={
                  busy === "submit_pairing_code"
                    ? "Submitting..."
                    : "Submit code"
                }
                onPress={() => void submitPairingCode()}
              />
            </Section>
            <Section title="My Caree relationships">
              <Text style={styles.body}>
                Pending means no active authority. Active appears only after
                Caree acceptance.
              </Text>
              <Action
                disabled={disabled}
                label={
                  busy === "refresh_relationships"
                    ? "Loading..."
                    : "Refresh status"
                }
                onPress={() => void refreshRelationships()}
                secondary
              />
              {carerRelationships.length === 0 ? (
                <Text style={styles.empty}>No relationships loaded.</Text>
              ) : (
                carerRelationships.map((relationship) => (
                  <RelationshipRow
                    actions={
                      relationship.status === "pending_caree_acceptance" ||
                      relationship.status === "active"
                        ? [
                            {
                              label: "Remove myself",
                              disabled,
                              onPress: () =>
                                void actOnRelationship(
                                  "remove_relationship",
                                  relationship.relationshipId
                                ),
                            },
                          ]
                        : []
                    }
                    key={relationship.relationshipId}
                    relationship={relationship}
                  />
                ))
              )}
            </Section>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function RelationshipRow({
  relationship,
  actions,
}: {
  relationship: WorkbenchRelationship;
  actions: Array<{
    label: string;
    disabled: boolean;
    onPress: () => void;
  }>;
}) {
  return (
    <View style={styles.relationship}>
      <View style={styles.relationshipCopy}>
        <Text style={styles.relationshipName}>
          {relationship.otherDisplayName}
        </Text>
        <Text style={styles.meta}>
          {relationshipStatusLabel(relationship.status)}
        </Text>
      </View>
      <View style={styles.rowActions}>
        {actions.map((action) => (
          <Pressable
            accessibilityRole="button"
            disabled={action.disabled}
            key={action.label}
            onPress={action.onPress}
            style={[styles.smallAction, action.disabled && styles.disabled]}
          >
            <Text style={styles.smallActionText}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Action({
  disabled,
  label,
  onPress,
  secondary = false,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.action,
        secondary && styles.actionSecondary,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function formatStagingTime(value: string | null) {
  if (!value) return "unavailable";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relationshipStatusLabel(
  status: WorkbenchRelationship["status"]
): string {
  const labels: Record<WorkbenchRelationship["status"], string> = {
    pending_caree_acceptance: "Pending Caree acceptance · no authority",
    active: "Active · accepted by Caree",
    declined: "Declined",
    removed_by_caree: "Removed by Caree",
    removed_by_carer: "Removed by Carer",
    expired: "Expired",
  };
  return labels[status];
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy950 },
  content: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    padding: spacing.lg,
    paddingBottom: 48,
  },
  eyebrow: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: {
    color: colors.ice,
    fontSize: 28,
    fontWeight: "700",
    marginTop: 8,
  },
  warning: {
    color: colors.warn,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  progress: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    marginTop: 14,
    padding: 12,
  },
  progressName: { color: colors.ice, fontSize: 15, fontWeight: "800" },
  progressGuidance: { color: colors.textSoft, fontSize: 12, lineHeight: 18 },
  progressEvidence: { color: colors.muted, fontSize: 10 },
  roleRow: { flexDirection: "row", gap: 8, marginTop: 20 },
  roleButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  roleSelected: { backgroundColor: colors.periwinkleFill },
  roleText: { color: colors.ice, fontWeight: "700" },
  notice: {
    padding: 12,
    marginTop: 14,
    borderLeftWidth: 3,
    borderLeftColor: colors.periwinkle,
    backgroundColor: colors.surface,
  },
  noticeError: { borderLeftColor: colors.warn },
  noticeText: { color: colors.textSoft, lineHeight: 19 },
  section: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 18,
    gap: 12,
  },
  sectionTitle: { color: colors.ice, fontSize: 18, fontWeight: "700" },
  body: { color: colors.textSoft, fontSize: 13, lineHeight: 19 },
  codeArea: { paddingVertical: 12 },
  codeLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  codeValue: {
    color: colors.goldLight,
    fontSize: 24,
    fontWeight: "800",
    marginTop: 6,
  },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  errorText: { color: colors.warn, lineHeight: 19 },
  actionRow: { flexDirection: "row", gap: 8 },
  action: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.gold,
  },
  actionSecondary: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
  },
  actionText: { color: colors.navy950, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  empty: { color: colors.muted, fontStyle: "italic" },
  relationship: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
    paddingVertical: 8,
  },
  relationshipCopy: { flex: 1 },
  relationshipName: { color: colors.ice, fontWeight: "700" },
  rowActions: { flexDirection: "row", gap: 6 },
  smallAction: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  smallActionText: { color: colors.textSoft, fontSize: 12, fontWeight: "700" },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    color: colors.ice,
    paddingHorizontal: 12,
  },
});
