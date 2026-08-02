import { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type {
  CareCircleClientInput,
  CareCircleClientResult,
  InactiveCareCircleClient,
} from "../../src/services/inactiveCareCircleClient";
import { INACTIVE_CARE_CIRCLE_CLIENT_VERSION } from "../../src/services/inactiveCareCircleClient";
import { colors, spacing } from "../../src/theme/tokens";
import type { WorkbenchCapabilities } from "./stagingWorkbenchPort";
import {
  createWorkbenchSingleFlight,
  resolveWorkbenchBackAction,
  shouldStackWorkbenchActions,
} from "./workbenchDeviceSafety";
import { resolveWorkbenchProgress } from "./workbenchProgress";
import {
  resolveWorkbenchRecovery,
  type WorkbenchRecovery,
} from "./workbenchRecovery";
import { confirmWorkbenchOutcome } from "./workbenchOutcomeIntegrity";
import type { WorkbenchProgressName } from "./workbenchProgress";
import type { JourneyConfirmationSource } from "./singlePhoneJourney";

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
  readProjection(): Promise<WorkbenchProjection>;
};

export type WorkbenchProjection = {
  relationships: WorkbenchRelationship[];
  paused: boolean;
};

type Notice = {
  tone: "info" | "success" | "error";
  text: string;
  evidenceName?: WorkbenchRecovery["evidenceName"];
};

type SafeRetryInput = Exclude<
  CareCircleClientInput,
  { action: "submit_pairing_code" }
>;

export function CareCircleStagingWorkbench({
  capabilities,
  client,
  relationshipPort,
  requestIdFactory,
  now = () => Date.now(),
  onEvidenceState,
}: {
  capabilities: WorkbenchCapabilities;
  client: InactiveCareCircleClient;
  relationshipPort: WorkbenchRelationshipPort;
  requestIdFactory: () => string;
  now?: () => number;
  onEvidenceState?: (input: {
    accountRole: "caree" | "carer";
    evidenceName: WorkbenchProgressName;
    confirmationSource: JourneyConfirmationSource;
  }) => void;
}) {
  const { fontScale } = useWindowDimensions();
  const actionFlight = useRef(createWorkbenchSingleFlight()).current;
  const [role, setRole] = useState<"caree" | "carer">(
    capabilities.accountRole
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
  const [projectionConfirmed, setProjectionConfirmed] = useState(false);
  const [hadRelationship, setHadRelationship] = useState(false);
  const [retryInput, setRetryInput] = useState<SafeRetryInput | null>(null);
  const [retryRefresh, setRetryRefresh] = useState(false);

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
    projectionConfirmed,
    hadRelationship,
  });
  const stackActions = shouldStackWorkbenchActions(fontScale);

  useEffect(() => {
    onEvidenceState?.({
      accountRole: capabilities.accountRole,
      evidenceName: progress.evidenceName,
      confirmationSource:
        progress.evidenceName === "caree_code_ready" && Boolean(pairingCode)
          ? "operation_result"
          : projectionConfirmed
            ? "safe_projection"
            : "unconfirmed",
    });
  }, [
    capabilities.accountRole,
    onEvidenceState,
    pairingCode,
    progress.evidenceName,
    projectionConfirmed,
  ]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        const action = resolveWorkbenchBackAction({
          busy: actionFlight.isActive(),
          hasTransientInput: pairingCodeInput.length > 0,
        });
        if (action === "block_busy") return true;
        if (action === "clear_transient_input") {
          setPairingCodeInput("");
          return true;
        }
        return false;
      }
    );
    return () => subscription.remove();
  }, [actionFlight, pairingCodeInput]);

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
    setProjectionConfirmed(false);
    setHadRelationship(false);
    setRetryInput(null);
    setRetryRefresh(false);
  }

  async function runAction(
    input: CareCircleClientInput
  ): Promise<CareCircleClientResult> {
    if (!actionFlight.enter()) {
      return {
        ok: false,
        clientVersion: INACTIVE_CARE_CIRCLE_CLIENT_VERSION,
        code: "CARE_CIRCLE_UNAVAILABLE",
        message: "Care Circle could not complete this request. Try again later.",
        retryable: true,
      };
    }
    setBusy(input.action);
    setNotice(null);
    setRetryInput(null);
    setRetryRefresh(false);
    let result: CareCircleClientResult;
    try {
      result = await client.execute(input);
    } finally {
      actionFlight.leave();
      setBusy(null);
    }

    if (!result.ok) {
      const recovery = resolveWorkbenchRecovery({
        kind: "operation",
        action: input.action,
        failureCode: result.code,
      });
      setNotice({
        tone: "error",
        text: recovery.message,
        evidenceName: recovery.evidenceName,
      });
      if (
        recovery.retryKind === "repeat_safe_action" &&
        input.action !== "submit_pairing_code"
      ) {
        setRetryInput(input as SafeRetryInput);
      }
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

    setNotice({
      tone: "info",
      text: "Backend response received. Confirming the participant-safe state...",
    });
    return result;
  }

  async function refreshRelationships(
    announce = true
  ): Promise<WorkbenchProjection | null> {
    if (!actionFlight.enter()) return null;
    setBusy("refresh_relationships");
    setRetryRefresh(false);
    if (announce) setNotice(null);
    try {
      const projection = await relationshipPort.readProjection();
      setRelationships(projection.relationships);
      setPaused(projection.paused);
      setProjectionConfirmed(true);
      if (projection.relationships.length > 0) setHadRelationship(true);
      if (announce) {
        setNotice({
          tone: "info",
          text: "Participant-safe staging relationships refreshed.",
        });
      }
      return projection;
    } catch {
      const recovery = resolveWorkbenchRecovery({
        kind: "relationship_refresh",
      });
      setNotice({
        tone: "error",
        text: recovery.message,
        evidenceName: recovery.evidenceName,
      });
      setRetryRefresh(true);
      return null;
    } finally {
      actionFlight.leave();
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
    await runAndConfirm({
      action: "submit_pairing_code",
      clientRequestId: requestIdFactory(),
      pairingCode: transientCode,
    });
  }

  async function actOnRelationship(
    action:
      | "accept_relationship"
      | "decline_relationship"
      | "remove_relationship",
    relationshipId: string
  ) {
    await runAndConfirm({
      action,
      clientRequestId: requestIdFactory(),
      relationshipId,
    });
  }

  async function runAndConfirm(request: CareCircleClientInput) {
    const result = await runAction(request);
    if (result.ok && result.code === "CARE_CIRCLE_PAIRING_CODE_READY") return;
    const possibleCapacityRejection =
      !result.ok &&
      request.action === "accept_relationship" &&
      atCapacity &&
      result.code === "CARE_CIRCLE_REQUEST_CONFLICT";
    if (!result.ok && !possibleCapacityRejection) return;

    const projection = await refreshRelationships(false);
    if (!projection) return;
    const confirmation = confirmWorkbenchOutcome({ request, result, projection });
    setNotice({
      tone: confirmation.confirmed ? "success" : "error",
      text: confirmation.message,
    });
  }

  const disabled = busy !== null;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.safe}
      >
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

          <View
            style={[styles.roleRow, stackActions && styles.actionColumn]}
            accessibilityRole="tablist"
          >
          {(["caree", "carer"] as const).map((item) => {
            const roleAllowed =
              item === capabilities.accountRole &&
              (item === "caree"
                ? capabilities.canActAsCaree
                : capabilities.canActAsCarer);
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{
                  disabled: disabled || !roleAllowed,
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
        <Text style={styles.body}>
          Test identity is fixed by this signed-in account. Use Switch account
          to change between the disposable Caree and Carer.
        </Text>

        {notice ? (
          <View
            accessibilityLiveRegion={notice.tone === "error" ? "assertive" : "polite"}
            style={[
              styles.notice,
              notice.tone === "error" && styles.noticeError,
            ]}
          >
            <Text style={styles.noticeText}>{notice.text}</Text>
            {retryRefresh ? (
              <Action
                disabled={disabled}
                label="Retry refresh"
                onPress={() => void refreshRelationships()}
                secondary
              />
            ) : retryInput ? (
              <Action
                disabled={disabled}
                label="Retry request"
                onPress={() => void runAndConfirm(retryInput)}
                secondary
              />
            ) : null}
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
              <View style={[styles.actionRow, stackActions && styles.actionColumn]}>
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
                  void runAndConfirm(
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
      </KeyboardAvoidingView>
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
            accessibilityLabel={`${action.label} ${relationship.otherDisplayName}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: action.disabled }}
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
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
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
  actionColumn: { flexDirection: "column" },
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
