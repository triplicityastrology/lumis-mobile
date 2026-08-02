import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Keyboard,
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
import {
  CareCirclePairingCodeMark,
  CareCircleProductFrame,
} from "../../src/features/careCircle/CareCircleScreen";
import { LineMotif, SafetyNote } from "../../src/components/states/StateKit";
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
  resolveCareCircleProductLayout,
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
  onCodeCopied,
  onBack,
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
  onCodeCopied?: () => void;
  onBack: () => void;
}) {
  const { width, height, fontScale } = useWindowDimensions();
  const actionFlight = useRef(createWorkbenchSingleFlight()).current;
  const role = capabilities.accountRole;
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
  const [productView, setProductView] = useState<"home" | "code" | "enter">("home");
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (!pairingCodeExpiresAt) return;
    const remaining = Date.parse(pairingCodeExpiresAt) - now();
    if (remaining <= 0) {
      setPairingCode(null);
      return;
    }
    const timeout = setTimeout(() => setPairingCode(null), remaining);
    return () => clearTimeout(timeout);
  }, [now, pairingCodeExpiresAt]);

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
  const layout = resolveCareCircleProductLayout({
    width,
    height,
    fontScale,
    keyboardVisible,
  });
  const stackActions = shouldStackWorkbenchActions(fontScale) || layout.stackActions;

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
      if (lifetime <= 0 || lifetime > 11 * 60 * 1000) {
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
        text: "Reusable pairing code ready for this ten-minute staging window.",
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
    const result = await runAction({
      action: rotation ? "rotate_pairing_code" : "create_pairing_code",
      clientRequestId: requestIdFactory(),
    });
    if (result.ok && result.code === "CARE_CIRCLE_PAIRING_CODE_READY") {
      setProductView("code");
    }
  }

  async function copyPairingCode() {
    if (!pairingCode || codeIsExpired) return;
    try {
      await Clipboard.setStringAsync(pairingCode);
      setNotice({
        tone: "success",
        text: "Pairing code copied. It remains valid only until the shown expiry.",
      });
      onCodeCopied?.();
    } catch {
      setNotice({
        tone: "error",
        text: "The pairing code could not be copied. You can enter it manually.",
      });
    }
  }

  async function submitPairingCode() {
    const transientCode = pairingCodeInput;
    setPairingCodeInput("");
    await runAndConfirm({
      action: "submit_pairing_code",
      clientRequestId: requestIdFactory(),
      pairingCode: transientCode,
    });
    setProductView("home");
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

  const frameTitle = productView === "code"
    ? "My check-in code"
    : productView === "enter"
      ? "Add someone to care for"
      : "Care Circle";

  return (
    <CareCircleProductFrame
      onBack={productView === "home" ? onBack : () => setProductView("home")}
      productBackground
      showPreviewBadge={false}
      title={frameTitle}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.safe}
      >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          layout.compactPadding && styles.contentCompact,
        ]}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
      >
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

        {productView === "code" ? (
          <>
            <View style={styles.codeCard}>
              <CareCirclePairingCodeMark />
              <Text style={styles.codeOwner}>Your check-in code</Text>
              {pairingCode && !codeIsExpired ? (
                <>
                  <View style={styles.codeBox}>
                    <Text style={styles.codeLabel}>ENTER CODE</Text>
                    <Text selectable style={styles.codeValue}>{pairingCode}</Text>
                  </View>
                  <View style={styles.expiryChip}>
                    <Text style={styles.expiryText}>Expires {formatStagingTime(pairingCodeExpiresAt)}</Text>
                  </View>
                  <Action disabled={disabled} label="Copy code" onPress={() => void copyPairingCode()} secondary />
                </>
              ) : (
                <Text style={styles.errorText}>This code has expired. Refresh it before sharing.</Text>
              )}
            </View>
            <Text style={styles.codeExplain}>
              Let someone you trust enter this code to request a Care Circle link. You can accept or decline their request.
            </Text>
            <Action disabled={disabled} label="Refresh code" onPress={() => void createOrRotateCode(true)} secondary />
            <SafetyNote text="Care Circle is for gentle check-ins only. It cannot guarantee push delivery, urgent response, or emergency support." />
          </>
        ) : productView === "enter" ? (
          <>
            <View style={styles.entryHero}>
              <CareCirclePairingCodeMark />
              <Text style={styles.codeExplain}>Enter the Caree's four-digit code. Your request stays pending until they accept it.</Text>
            </View>
            <TextInput
              accessibilityLabel="Caree pairing code"
              autoCorrect={false}
              editable={!disabled}
              keyboardType="number-pad"
              maxLength={4}
              onChangeText={(value) => setPairingCodeInput(value.replace(/\D/g, "").slice(0, 4))}
              placeholder="4-digit code"
              placeholderTextColor={colors.muted}
              style={styles.productInput}
              textContentType="oneTimeCode"
              returnKeyType="done"
              value={pairingCodeInput}
            />
            <Action disabled={disabled || pairingCodeInput.length !== 4} label={busy === "submit_pairing_code" ? "Submitting..." : "Send request"} onPress={() => void submitPairingCode()} />
            <SafetyNote text="A request gives no Care Circle authority until the Caree accepts it." />
          </>
        ) : (
          <>
            <View style={styles.emblem}><LineMotif name="hands" size={30} /></View>
            <Text style={styles.sectionLabel}>YOUR CHECK-INS (YOU ARE THE CAREE)</Text>
            <View style={styles.productCard}>
              <View style={styles.scheduleRow}>
                <View style={styles.scheduleChip}><Text style={styles.scheduleChipText}>{paused ? "Paused" : "Every 2 days"}</Text></View>
                <Text style={styles.scheduleNext}>{paused ? "Check-ins paused" : "Next check-in: tomorrow, 10:00"}</Text>
              </View>
              {pending.map((relationship) => (
                <RelationshipRow key={relationship.relationshipId} relationship={relationship} actions={[
                  { label: atCapacity ? "Test sixth rejection" : "Accept", disabled, onPress: () => void actOnRelationship("accept_relationship", relationship.relationshipId) },
                  { label: "Decline", disabled, onPress: () => void actOnRelationship("decline_relationship", relationship.relationshipId) },
                ]} />
              ))}
              {accepted.map((relationship) => (
                <RelationshipRow key={relationship.relationshipId} relationship={relationship} actions={[
                  { label: "Remove", disabled, onPress: () => void actOnRelationship("remove_relationship", relationship.relationshipId) },
                ]} />
              ))}
              {pending.length === 0 && accepted.length === 0 ? <Text style={styles.empty}>No Carers linked yet.</Text> : null}
              <View style={[styles.actionRow, stackActions && styles.actionColumn]}>
                <Action disabled={disabled || !capabilities.canActAsCaree} label="Show my check-in code" onPress={() => pairingCode && !codeIsExpired ? setProductView("code") : void createOrRotateCode(false)} secondary />
                <Action disabled={disabled || !capabilities.canActAsCaree} label={paused ? "Resume" : "Pause"} onPress={() => void runAndConfirm(paused ? { action: "resume_care", clientRequestId: requestIdFactory() } : { action: "pause_care", clientRequestId: requestIdFactory(), pausedUntil: new Date(now() + 24 * 60 * 60 * 1000).toISOString() })} secondary />
              </View>
              <Text style={styles.helper}>Show this to a new Carer to enter. Up to 5 accepted Carers.</Text>
            </View>
            <Text style={styles.sectionLabel}>PEOPLE YOU CARE FOR (YOU ARE THE CARER)</Text>
            <View style={styles.productCard}>
              {carerRelationships.map((relationship) => (
                <RelationshipRow key={relationship.relationshipId} relationship={relationship} actions={relationship.status === "pending_caree_acceptance" || relationship.status === "active" ? [
                  { label: "Leave", disabled, onPress: () => void actOnRelationship("remove_relationship", relationship.relationshipId) },
                ] : []} />
              ))}
              {carerRelationships.length === 0 ? <Text style={styles.empty}>You are not caring for anyone yet.</Text> : null}
              <Action disabled={disabled || !capabilities.canActAsCarer} label="Scan or enter someone's code" onPress={() => setProductView("enter")} secondary />
              <Text style={styles.helper}>Enter a code someone shows you. They must accept before the link becomes active.</Text>
            </View>
            <Action disabled={disabled} label={busy === "refresh_relationships" ? "Refreshing..." : "Refresh status"} onPress={() => void refreshRelationships()} secondary />
            <SafetyNote text="Care Circle is for gentle check-ins only. It cannot guarantee push delivery, urgent response, or emergency support." />
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </CareCircleProductFrame>
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
      <View style={[styles.rowActions, styles.rowActionsResponsive]}>
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
      <Text style={[styles.actionText, !secondary && styles.actionTextPrimary]}>{label}</Text>
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
  contentCompact: { paddingHorizontal: 16, paddingTop: 14 },
  emblem: { alignItems: "center", alignSelf: "center", backgroundColor: "#D9B76C", borderRadius: 50, height: 100, justifyContent: "center", marginBottom: 30, width: 100 },
  sectionLabel: { color: "#B8C9D8", fontSize: 12, fontWeight: "800", letterSpacing: 1.4, marginBottom: 12, marginTop: 14 },
  productCard: { backgroundColor: "rgba(28,69,96,0.94)", borderColor: "rgba(147,178,208,0.32)", borderRadius: 28, borderWidth: 1, gap: 14, marginBottom: 24, padding: 20 },
  scheduleRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 12 },
  scheduleChip: { backgroundColor: "rgba(217,183,108,0.18)", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  scheduleChipText: { color: "#E4C476", fontSize: 16, fontWeight: "800" },
  scheduleNext: { color: "#CAD8E5", flex: 1, fontSize: 14, minWidth: 160 },
  helper: { color: "#B4C7D7", fontSize: 13, lineHeight: 20, textAlign: "center" },
  codeCard: { alignItems: "center", alignSelf: "center", backgroundColor: "rgba(35,72,99,0.96)", borderColor: "rgba(217,183,108,0.58)", borderRadius: 28, borderWidth: 1, gap: 14, maxWidth: 380, padding: 28, width: "100%" },
  codeOwner: { color: colors.ice, fontFamily: "Georgia", fontSize: 22 },
  codeBox: { alignItems: "center", backgroundColor: "rgba(217,183,108,0.1)", borderColor: "rgba(217,183,108,0.44)", borderRadius: 14, borderWidth: 1, paddingHorizontal: 24, paddingVertical: 10 },
  expiryChip: { backgroundColor: "rgba(217,183,108,0.16)", borderColor: "rgba(217,183,108,0.5)", borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 7 },
  expiryText: { color: colors.goldLight, fontSize: 13, fontWeight: "700" },
  codeExplain: { color: "#D1DDE7", fontSize: 16, lineHeight: 25, marginVertical: 22, textAlign: "center" },
  entryHero: { alignItems: "center", marginTop: 8 },
  productInput: { backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(217,183,108,0.5)", borderRadius: 14, borderWidth: 1, color: colors.ice, fontSize: 24, letterSpacing: 8, minHeight: 58, paddingHorizontal: 16, textAlign: "center" },
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
    backgroundColor: "rgba(58,80,118,0.42)",
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 24,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { color: colors.ice, fontSize: 18, fontWeight: "700" },
  body: { color: colors.textSoft, fontSize: 13, lineHeight: 19 },
  codeArea: { alignItems: "center", gap: 6, paddingVertical: 12 },
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
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.gold,
  },
  actionSecondary: {
    backgroundColor: "rgba(69,99,145,0.92)",
    borderWidth: 1,
    borderColor: colors.line,
  },
  actionText: { color: colors.ice, fontWeight: "800", textAlign: "center" },
  actionTextPrimary: { color: colors.navy950 },
  disabled: { opacity: 0.45 },
  empty: { color: colors.muted, fontStyle: "italic" },
  relationship: {
    minHeight: 58,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
    paddingVertical: 8,
  },
  relationshipCopy: { flex: 1, minWidth: 180 },
  relationshipName: { color: colors.ice, fontWeight: "700" },
  rowActions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  rowActionsResponsive: { maxWidth: "100%" },
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
