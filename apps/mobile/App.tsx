import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { randomUUID } from "expo-crypto";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Bell from "lucide-react-native/icons/bell";
import Check from "lucide-react-native/icons/check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Compass from "lucide-react-native/icons/compass";
import History from "lucide-react-native/icons/history";
import MessageCircle from "lucide-react-native/icons/message-circle";
import Plus from "lucide-react-native/icons/plus";
import Search from "lucide-react-native/icons/search";
import Send from "lucide-react-native/icons/send";
import Sparkles from "lucide-react-native/icons/sparkles";
import UsersRound from "lucide-react-native/icons/users-round";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView as SafeAreaViewCtx } from "react-native-safe-area-context";

import {
  PERSONA_STYLES,
  FEATURE_LABELS,
  PLAN_ENTITLEMENTS,
  PRODUCT_TERMS,
  PRODUCTS,
  ROUTE_CREDITS,
  ROUTE_PLAN_REQUIREMENTS,
  canUseRoute,
  type ChartV2,
  type PlanTier,
  type PersonaStyleKey
} from "@lumis/shared";

import {
  savePersonaStylePreference,
  submitChartProfile,
  validateBirthProfileForm,
  type BirthProfileForm,
  type ChartProfileResult,
  type PersonaIdentityPreference
} from "./src/services/profile";
import {
  loadSupabaseAccountState,
  type RestoredReflectionThread,
  type SupabaseAccountState
} from "./src/services/accountState";
import {
  getAuthStatus,
  handleAuthRedirectFromUrl,
  sendMagicLink,
  signOut,
  type AuthStatus
} from "./src/services/auth";
import { sendChatMessage, type SendChatMessageResult } from "./src/services/chat";
import {
  clearLocalDemoSession,
  type LocalDemoChatTurn,
  loadLocalDemoSession,
  saveLocalDemoSession
} from "./src/services/localDemoSession";
import { ChartInsightsScreen } from "./src/screens/ChartInsightsScreen";
import { CelestialBackground } from "./src/components/CelestialBackground";
import { LumisPersonaAvatar, PERSONA_AVATARS } from "./src/components/LumisPersonaAvatar";
import { MainTabBar, type MainTab } from "./src/components/MainTabBar";
import { LumisAuthScreen } from "./src/screens/LumisAuthScreen";
import { LumisBirthProfileScreen } from "./src/screens/LumisBirthProfileScreen";
import { LumisDiceScreen } from "./src/screens/LumisDiceScreen";
import { DiceRitualScreen } from "./src/features/dice/DiceRitualScreen";
import { NotificationCenterScreen } from "./src/features/notifications/NotificationCenterScreen";
import { CareCircleScreen as CareCircleFlowScreen } from "./src/features/careCircle/CareCircleScreen";
import { BirthDetailsChangeScreen } from "./src/features/birthDetails/BirthDetailsChangeScreen";
import { LumisSplashScreen } from "./src/screens/LumisSplashScreen";
import { DICE_RITUAL_ENABLED } from "./src/features/dice/featureFlag";
import { LumisHomeScreen } from "./src/screens/LumisHomeScreen";
import { LumisProfileScreen } from "./src/screens/LumisProfileScreen";

const highlightRoutes = ROUTE_CREDITS.filter((route) =>
  ["casual", "dice", "astro_deep"].includes(route.route)
);

type ProfileData = BirthProfileForm;

type ChatTurn = LocalDemoChatTurn;
type AccountSource = "none" | "local_demo" | "supabase";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  category: "Care Circle" | "System";
  isUnread: boolean;
};

type CareCircleItem = {
  id: string;
  name: string;
  relationship: string;
  status: "Active" | "Pending";
  lastEvent: string;
};

const STARTER_CREDITS = 50;
const BIRTH_DETAIL_CHANGE_LIMIT = 3;
const QUICK_CHAT_PROMPTS = [
  "What should I pay attention to this week?",
  "Help me understand one repeating pattern.",
  "Give me a gentle chart-based reflection."
];

const LOCAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "care-confirmation",
    title: "Care Circle request ready",
    body: "Carer confirmation requests will appear here after QR linking is connected.",
    category: "Care Circle",
    isUnread: true
  },
  {
    id: "push-permission",
    title: "Push permission check",
    body: "Lumis will use this area for missed check-in alerts, Need help alerts, and push setup issues.",
    category: "System",
    isUnread: true
  }
];

const LOCAL_CARE_CIRCLE: CareCircleItem[] = [
  {
    id: "care-demo-active",
    name: "Family contact",
    relationship: "Next of kin",
    status: "Active",
    lastEvent: "Check-in alerts will appear after push is connected."
  },
  {
    id: "care-demo-pending",
    name: "Trusted carer",
    relationship: "Care Circle invite",
    status: "Pending",
    lastEvent: "Waiting for carer acceptance after caree confirmation."
  }
];

export default function App() {
  const [screen, setScreen] = useState<"splash" | "home" | "auth" | "profile" | "preview" | "persona" | "chat" | "reflections" | "notifications" | "care" | "plans" | "birthDetails" | "insights" | "dice" | "profileTab">("splash");
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [chartProfile, setChartProfile] = useState<ChartV2 | null>(null);
  const [personaStyle, setPersonaStyle] = useState<PersonaStyleKey>("acceptance");
  const [personaName, setPersonaName] = useState("Lumis");
  const [personaAvatarKey, setPersonaAvatarKey] = useState("psyche");
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [authNotice, setAuthNotice] = useState("");
  const [authError, setAuthError] = useState("");
  const [hasLocalDemoSession, setHasLocalDemoSession] = useState(false);
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [reflectionThreads, setReflectionThreads] = useState<RestoredReflectionThread[]>([]);
  const [mainFocus, setMainFocus] = useState<string | null>(null);
  const [planTier, setPlanTier] = useState<PlanTier>("starter");
  const [remainingCredits, setRemainingCredits] = useState(STARTER_CREDITS);
  const [birthDetailChanges, setBirthDetailChanges] = useState(0);
  const [notificationsReturn, setNotificationsReturn] = useState<
    "home" | "chat" | "insights" | "dice" | "profileTab"
  >("home");
  const [accountSource, setAccountSource] = useState<AccountSource>("none");
  const [accountLoadStatus, setAccountLoadStatus] = useState<"idle" | "loading" | "loaded" | "empty" | "error">("idle");
  const [accountLoadMessage, setAccountLoadMessage] = useState("");
  const [forceNewSupabaseThread, setForceNewSupabaseThread] = useState(false);
  const [activeSupabaseThreadId, setActiveSupabaseThreadId] = useState<string | null>(null);
  const [pendingChatDraft, setPendingChatDraft] = useState<string | null>(null);
  const unreadNotificationCount = LOCAL_NOTIFICATIONS.filter((item) => item.isUnread).length;

  async function refreshAuthStatus() {
    const status = await getAuthStatus();
    setAuthStatus(status);
    return status;
  }

  function clearVisibleAccountState(message = "") {
    setProfileData(null);
    setChartProfile(null);
    setPersonaStyle("acceptance");
    setPersonaName("Lumis");
    setPersonaAvatarKey("psyche");
    setChatTurns([]);
    setReflectionThreads([]);
    setMainFocus(null);
    setPlanTier("starter");
    setRemainingCredits(STARTER_CREDITS);
    setHasLocalDemoSession(false);
    setAccountSource("none");
    setAccountLoadStatus(message ? "empty" : "idle");
    setAccountLoadMessage(message);
    setForceNewSupabaseThread(false);
    setActiveSupabaseThreadId(null);
  }

  async function startOver() {
    await clearLocalDemoSession();
    clearVisibleAccountState();
    setScreen("home");
  }

  function applySupabaseAccountState(accountState: SupabaseAccountState) {
    if (accountState.status === "loaded" && accountState.profileData && accountState.chartProfile) {
      setProfileData(accountState.profileData);
      setChartProfile(accountState.chartProfile);
      setPersonaStyle(accountState.personaStyle);
      setPersonaName(accountState.buddyName);
      setPersonaAvatarKey(accountState.buddyAvatarKey);
      setChatTurns(accountState.chatTurns);
      setReflectionThreads(accountState.reflectionThreads);
      setMainFocus(accountState.mainFocus);
      setPlanTier(accountState.planTier);
      setRemainingCredits(accountState.remainingCredits ?? STARTER_CREDITS);
      setHasLocalDemoSession(false);
      setAccountSource("supabase");
      setAccountLoadStatus("loaded");
      setAccountLoadMessage(accountState.message);
      setForceNewSupabaseThread(false);
      setActiveSupabaseThreadId(
        accountState.reflectionThreads.find((thread) => thread.canContinue)?.id ?? null
      );
      return true;
    }

    clearVisibleAccountState(accountState.message);
    setAccountLoadStatus("empty");
    return false;
  }

  async function restoreAccountForStatus(status: AuthStatus, routeLoadedAccount = false) {
    if (status.isConfigured && status.user) {
      setAccountLoadStatus("loading");
      setAccountLoadMessage("Loading your Lumis profile...");
      setHasLocalDemoSession(false);

      try {
        const accountState = await loadSupabaseAccountState();
        const restored = applySupabaseAccountState(accountState);
        if (restored && routeLoadedAccount) {
          setScreen("chat");
        } else if (!restored && routeLoadedAccount) {
          setScreen("home");
        }
      } catch (error) {
        clearVisibleAccountState("We could not load your Lumis profile. Please try again.");
        setAccountLoadStatus("error");
        if (routeLoadedAccount) {
          setScreen("home");
        }
      }

      return;
    }

    const localSession = await loadLocalDemoSession();

    if (localSession) {
      setProfileData(localSession.profileData);
      setChartProfile(localSession.chartProfile);
      setPersonaStyle(localSession.personaStyle);
      setPersonaName(localSession.buddyName ?? "Lumis");
      setPersonaAvatarKey(localSession.buddyAvatarKey ?? "psyche");
      setChatTurns(localSession.chatTurns ?? []);
      setReflectionThreads([]);
      setMainFocus(localSession.mainFocus ?? null);
      setPlanTier("starter");
      setRemainingCredits(localSession.remainingCredits ?? STARTER_CREDITS);
      setHasLocalDemoSession(true);
      setAccountSource("local_demo");
      setAccountLoadStatus("loaded");
      setAccountLoadMessage("Your saved profile is ready on this device.");
      setForceNewSupabaseThread(false);
      setActiveSupabaseThreadId(null);
      return;
    }

    clearVisibleAccountState("No saved Lumis profile was found on this device.");
  }

  async function saveDemoSession(
    nextProfileData: ProfileData,
    nextChartProfile: ChartV2,
    nextPersonaStyle: PersonaStyleKey,
    nextChatTurns = chatTurns,
    nextRemainingCredits = remainingCredits,
    nextIdentity: PersonaIdentityPreference = {
      buddyName: personaName,
      avatarKey: personaAvatarKey,
      mainFocus
    }
  ) {
    if (authStatus?.isConfigured && authStatus.user) {
      return;
    }

    await saveLocalDemoSession({
      profileData: nextProfileData,
      chartProfile: nextChartProfile,
      personaStyle: nextPersonaStyle,
      buddyName: nextIdentity.buddyName,
      buddyAvatarKey: nextIdentity.avatarKey,
      mainFocus: nextIdentity.mainFocus,
      chatTurns: nextChatTurns,
      remainingCredits: nextRemainingCredits
    });
    setHasLocalDemoSession(true);
  }

  async function startNewTopic() {
    if (!profileData || !chartProfile) {
      setScreen("profile");
      return;
    }

    setChatTurns([]);
    setForceNewSupabaseThread(accountSource === "supabase");
    setActiveSupabaseThreadId(null);
    await saveDemoSession(profileData, chartProfile, personaStyle, [], remainingCredits);
    setScreen("chat");
  }

  // Notifications is reachable from every tab's bell; Back should return to the
  // screen it was opened from (Profile subpages always return to Profile).
  function openNotifications() {
    if (screen === "chat" || screen === "insights" || screen === "dice" || screen === "profileTab") {
      setNotificationsReturn(screen);
    } else {
      setNotificationsReturn("home");
    }
    setScreen("notifications");
  }

  function openMainTab(tab: MainTab) {
    if (tab === "profile") {
      setScreen("profileTab");
      return;
    }

    if (!profileData || !chartProfile) {
      setScreen("profile");
      return;
    }

    setScreen(tab);
  }

  useEffect(() => {
    async function initializeAuth() {
      try {
        const result = await handleAuthRedirectFromUrl();

        if (result.message) {
          setAuthNotice(result.message);
        }

        const status = await refreshAuthStatus();
        await restoreAccountForStatus(status, true);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Unable to confirm account.");
      }
    }

    void initializeAuth();
  }, []);

  if (screen === "splash") {
    return <LumisSplashScreen onDone={() => setScreen("home")} />;
  }

  if (screen === "auth") {
    return (
      <LumisAuthScreen
        authStatus={authStatus}
        onBack={() => setScreen("home")}
        onContinueLocal={() => setScreen("profile")}
        onAccountStatusRefreshed={(status) => restoreAccountForStatus(status, true)}
        onSignedOut={() => clearVisibleAccountState("Signed out.")}
        authNotice={authNotice}
        authError={authError}
        onClearAuthError={() => setAuthError("")}
      />
    );
  }

  if (screen === "profile") {
    return (
      <LumisBirthProfileScreen
        onBack={() => setScreen("home")}
        onContinue={(nextProfileData) => {
          setProfileData(nextProfileData);
          setScreen("preview");
        }}
      />
    );
  }

  if (screen === "preview" && profileData) {
    return (
      <ChartPreviewScreen
        profileData={profileData}
        onBack={() => setScreen("profile")}
        onStartOver={startOver}
        onContinuePersona={(result) => {
          setChartProfile(result.chart);
          setChatTurns([]);
          setReflectionThreads([]);
          setMainFocus(null);
          setPlanTier("starter");
          setRemainingCredits(STARTER_CREDITS);

          if (result.mode === "supabase") {
            setAccountSource("supabase");
            setAccountLoadStatus("loaded");
            setAccountLoadMessage("Your chart and Lumis profile are ready.");
            setHasLocalDemoSession(false);
          } else {
            setAccountSource("local_demo");
            void saveDemoSession(profileData, result.chart, personaStyle, [], STARTER_CREDITS);
          }

          setScreen("persona");
        }}
      />
    );
  }

  if (screen === "persona" && profileData) {
    return (
      <PersonaStyleScreen
        name={profileData.name}
        initialIdentity={{
          buddyName: personaName,
          avatarKey: personaAvatarKey,
          mainFocus
        }}
        selectedStyle={personaStyle}
        onSelectStyle={setPersonaStyle}
        onBack={() => setScreen("preview")}
        onEnterChat={async (identity) => {
          await savePersonaStylePreference(personaStyle, identity);
          setPersonaName(identity.buddyName);
          setPersonaAvatarKey(identity.avatarKey);
          setMainFocus(identity.mainFocus);
          if (chartProfile) {
            await saveDemoSession(
              profileData,
              chartProfile,
              personaStyle,
              chatTurns,
              remainingCredits,
              identity
            );
          }
          setScreen("chat");
        }}
      />
    );
  }

  if (screen === "chat" && profileData) {
    const activeReflection = reflectionThreads.find(
      (thread) => thread.id === activeSupabaseThreadId
    );

    return (
      <ChatShellScreen
        name={profileData.name}
        lumisName={personaName}
        lumisAvatarKey={personaAvatarKey}
        chart={chartProfile}
        initialDraft={pendingChatDraft}
        selectedStyle={personaStyle}
        chatTurns={chatTurns}
        remainingCredits={remainingCredits}
        forceNewSupabaseThread={forceNewSupabaseThread}
        activeSupabaseThreadId={activeSupabaseThreadId}
        readOnlyReason={activeReflection?.canContinue === false ? activeReflection.unavailableReason : null}
        onChatStateChange={async (nextChatTurns, nextRemainingCredits) => {
          setChatTurns(nextChatTurns);
          setRemainingCredits(nextRemainingCredits);

          if (chartProfile) {
            await saveDemoSession(
              profileData,
              chartProfile,
              personaStyle,
              nextChatTurns,
              nextRemainingCredits
            );
          }
        }}
        onInitialDraftConsumed={() => setPendingChatDraft(null)}
        onSupabaseThreadStarted={(threadId) => {
          setForceNewSupabaseThread(false);
          setActiveSupabaseThreadId(threadId);
        }}
        onPastReflections={() => setScreen("reflections")}
        onNotifications={openNotifications}
        onStartNewTopic={() => void startNewTopic()}
        onSelectTab={openMainTab}
        onBack={() => setScreen("home")}
      />
    );
  }

  if (screen === "reflections") {
    return (
      <PastReflectionsScreen
        hasLocalDemoSession={hasLocalDemoSession}
        accountSource={accountSource}
        profileData={profileData}
        selectedStyle={personaStyle}
        chatTurns={chatTurns}
        reflectionThreads={reflectionThreads}
        onBack={() => setScreen("home")}
        onContinueReflection={(thread) => {
          if (thread) {
            setChatTurns(thread.turns);
            setPersonaStyle(thread.personaStyle);
            setForceNewSupabaseThread(false);
            setActiveSupabaseThreadId(thread.id);
          }
          setScreen(profileData && chartProfile ? "chat" : "profile");
        }}
        onStartNewTopic={startNewTopic}
      />
    );
  }

  if (screen === "notifications") {
    return (
      <NotificationCenterScreen
        onBack={() => setScreen(notificationsReturn)}
      />
    );
  }

  if (screen === "care") {
    return (
      <CareCircleFlowScreen
        onBack={() => setScreen("profileTab")}
        // Care Circle is a paid feature; during UAT it's left reviewable. Wire the
        // real gate with `eligible={planTier !== "starter"}` once entitlements land.
        eligible
      />
    );
  }

  if (screen === "plans") {
    return (
      <PlansAccessScreen
        currentPlan={planTier}
        onBack={() => setScreen("profileTab")}
      />
    );
  }

  if (screen === "dice" && profileData && chartProfile) {
    // Feature-flagged physics ritual (AC-DICE-01/04); LumisDiceScreen stays as
    // the identical-flow fallback path until the device spike passes.
    const DiceScreenComponent = DICE_RITUAL_ENABLED ? DiceRitualScreen : LumisDiceScreen;
    return (
      <DiceScreenComponent
        onNotifications={openNotifications}
        onReflect={(chatDraft) => {
          setPendingChatDraft(chatDraft);
          setScreen("chat");
        }}
        onSelectTab={openMainTab}
        onBack={() => setScreen("home")}
      />
    );
  }

  if (screen === "profileTab" && profileData) {
    return (
      <LumisProfileScreen
        birthDate={profileData.birthDate}
        birthPlace={profileData.birthPlace}
        birthTime={profileData.birthTime}
        email={authStatus?.user?.email}
        name={profileData.name}
        personaName={personaName}
        personaAvatarKey={personaAvatarKey}
        mainFocus={mainFocus}
        planTier={planTier}
        personaStyle={personaStyle}
        remainingCredits={remainingCredits}
        timeUnknown={profileData.timeUnknown}
        onAccount={() => setScreen("auth")}
        onBirthDetails={() => setScreen("birthDetails")}
        onCareCircle={() => setScreen("care")}
        onNotifications={openNotifications}
        onPersona={() => setScreen("persona")}
        onPlans={() => setScreen("plans")}
        onSelectTab={openMainTab}
      />
    );
  }

  if (screen === "birthDetails") {
    return (
      <BirthDetailsChangeScreen
        details={
          profileData
            ? {
                birthDate: profileData.birthDate,
                birthTime: profileData.birthTime,
                birthPlace: profileData.birthPlace,
                timeUnknown: profileData.timeUnknown
              }
            : null
        }
        successfulChanges={birthDetailChanges}
        onBack={() => setScreen("profileTab")}
        onCommitted={() => setBirthDetailChanges((n) => n + 1)}
      />
    );
  }

  if (screen === "insights" && profileData && chartProfile) {
    return (
      <ChartInsightsScreen
        chart={chartProfile}
        name={profileData.name}
        onBack={() => setScreen("home")}
        onAskLumis={() => setScreen("chat")}
        onNotifications={openNotifications}
        onSelectTab={openMainTab}
      />
    );
  }

  const hasVisibleProfile = Boolean(profileData && chartProfile);

  return (
    <>
      <StatusBar style="light" />
      <LumisHomeScreen
        accountLoadStatus={accountLoadStatus}
        accountLoadMessage={accountLoadMessage}
        chart={chartProfile}
        reflectionCount={
          accountSource === "supabase" ? reflectionThreads.length : chatTurns.length > 0 ? 1 : 0
        }
        email={authStatus?.user?.email}
        isAuthenticated={Boolean(authStatus?.user)}
        name={profileData?.name}
        onAccount={async () => {
          await refreshAuthStatus();
          setScreen("auth");
        }}
        onCreateChart={() => setScreen("profile")}
        onDice={() => openMainTab("dice")}
        onInsights={() => setScreen(chartProfile ? "insights" : "profile")}
        onNotifications={openNotifications}
        onOpenChat={() => setScreen(hasVisibleProfile ? "chat" : "profile")}
        onOpenProfile={() => openMainTab("profile")}
        onPastReflections={async () => {
          if (authStatus?.isConfigured && authStatus.user) {
            setAccountLoadStatus("loading");
            setAccountLoadMessage("Refreshing Past Reflections...");

            try {
              applySupabaseAccountState(await loadSupabaseAccountState());
            } catch (error) {
              setAccountLoadStatus("error");
              setAccountLoadMessage(
                error instanceof Error ? error.message : "Unable to refresh Past Reflections."
              );
            }
          }
          setScreen("reflections");
        }}
        onReload={async () => {
          const status = await refreshAuthStatus();
          await restoreAccountForStatus(status);
        }}
      />
    </>
  );
}

function AuthScreen({
  authStatus,
  onBack,
  onContinueLocal,
  onRefreshAuthStatus,
  onAccountStatusRefreshed,
  onSignedOut,
  authNotice,
  authError,
  onClearAuthError
}: {
  authStatus: AuthStatus | null;
  onBack: () => void;
  onContinueLocal: () => void;
  onRefreshAuthStatus: () => Promise<AuthStatus>;
  onAccountStatusRefreshed: (status: AuthStatus) => Promise<void>;
  onSignedOut: () => void;
  authNotice: string;
  authError: string;
  onClearAuthError: () => void;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSendMagicLink() {
    const cleanedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    onClearAuthError();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const result = await sendMagicLink(cleanedEmail);
      setMessage(result.message);
      const status = await onRefreshAuthStatus();
      await onAccountStatusRefreshed(status);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Unable to send magic link.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      await signOut();
      await onRefreshAuthStatus();
      onSignedOut();
      setMessage("Signed out.");
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Unable to sign out.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCheckAccountStatus() {
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const status = await onRefreshAuthStatus();
      await onAccountStatusRefreshed(status);
      setMessage("Account status refreshed.");
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Unable to refresh account status.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileTopBar}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <View style={styles.formStepPill}>
            <Text style={styles.formStepText}>
              {authStatus?.isConfigured ? "Secure account" : "Private session"}
            </Text>
          </View>
        </View>

        <View style={styles.formHero}>
          <View style={styles.formLogo}>
            <LumisLogo size={84} />
          </View>
          <Text style={styles.kicker}>Lumis account</Text>
          <Text style={styles.formTitle}>Sign in before your chart is saved.</Text>
          <Text style={styles.formIntro}>
            Use the secure link sent to your email. You can also continue without saving for now.
          </Text>
        </View>

        <View style={styles.formPanel}>
          {authStatus?.user?.email ? (
            <View style={styles.accountCard}>
              <Text style={styles.accountLabel}>Signed in</Text>
              <Text style={styles.accountEmail}>{authStatus.user.email}</Text>
            </View>
          ) : (
            <FormField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="ruby@example.com"
            />
          )}
        </View>

        {authNotice ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Account ready</Text>
            <Text style={styles.successBody}>{authNotice}</Text>
          </View>
        ) : null}

        {message ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Account update</Text>
            <Text style={styles.successBody}>{message}</Text>
          </View>
        ) : null}

        {error || authError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error || authError}</Text>
          </View>
        ) : null}

        {authStatus?.user ? (
          <Pressable
            style={[styles.fullPrimaryButton, isSubmitting && styles.disabledButton]}
            onPress={handleSignOut}
            disabled={isSubmitting}
          >
            <Text style={styles.fullPrimaryButtonText}>{isSubmitting ? "Signing out..." : "Sign out"}</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.fullPrimaryButton, isSubmitting && styles.disabledButton]}
            onPress={handleSendMagicLink}
            disabled={isSubmitting}
          >
            <Text style={styles.fullPrimaryButtonText}>
              {isSubmitting ? "Sending magic link..." : "Send magic link"}
            </Text>
          </Pressable>
        )}

        <Pressable
          style={styles.secondaryFullButton}
          onPress={handleCheckAccountStatus}
          disabled={isSubmitting}
        >
          <Text style={styles.secondaryFullButtonText}>Check account status</Text>
        </Pressable>

        <Pressable style={styles.ghostButton} onPress={onContinueLocal}>
          <Text style={styles.ghostButtonText}>Continue without saving</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileFormScreen({
  onBack,
  onContinue
}: {
  onBack: () => void;
  onContinue: (profileData: ProfileData) => void;
}) {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [birthPlace, setBirthPlace] = useState("");
  const [error, setError] = useState("");

  function handleContinue() {
    const nextProfileData = {
      name: name.trim(),
      birthDate: birthDate.trim(),
      birthTime: timeUnknown ? "" : birthTime.trim(),
      timeUnknown,
      birthPlace: birthPlace.trim()
    };

    const validation = validateBirthProfileForm(nextProfileData);

    if (!validation.isValid) {
      setError(validation.message ?? "Please check the birth details before continuing.");
      return;
    }

    setError("");
    onContinue(nextProfileData);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileTopBar}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <View style={styles.formStepPill}>
            <Text style={styles.formStepText}>Profile 1 of 3</Text>
          </View>
        </View>

        <View style={styles.formHero}>
          <View style={styles.formLogo}>
            <LumisLogo size={84} />
          </View>
          <Text style={styles.kicker}>Birth chart profile</Text>
          <Text style={styles.formTitle}>Create your Lumis Persona.</Text>
          <Text style={styles.formIntro}>
            Lumis needs accurate birth details to calculate your chart. This is the first step
            before chart generation and chat.
          </Text>
        </View>

        <View style={styles.formPanel}>
          <FormField
            label="Display name"
            value={name}
            onChangeText={setName}
            placeholder="Ruby"
          />
          <FormField
            label="Birth date"
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="YYYY-MM-DD"
          />
          <FormField
            label="Birth time"
            value={birthTime}
            onChangeText={setBirthTime}
            placeholder="HH:MM"
            editable={!timeUnknown}
          />
          <Pressable
            style={[styles.toggleRow, timeUnknown && styles.toggleRowActive]}
            onPress={() => setTimeUnknown((current) => !current)}
          >
            <View style={[styles.toggleBox, timeUnknown && styles.toggleBoxActive]}>
              <Text style={styles.toggleCheck}>{timeUnknown ? "✓" : ""}</Text>
            </View>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>I do not know my birth time</Text>
              <Text style={styles.toggleBody}>Lumis can still generate a lower-precision chart.</Text>
            </View>
          </Pressable>
          <FormField
            label="Birth place"
            value={birthPlace}
            onChangeText={setBirthPlace}
            placeholder="Hong Kong"
          />
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Your chart stays personal</Text>
          <Text style={styles.noticeBody}>
            Lumis uses these details to calculate your chart and shape your personal reflections.
          </Text>
        </View>

        <Pressable style={styles.fullPrimaryButton} onPress={handleContinue}>
          <Text style={styles.fullPrimaryButtonText}>Continue to chart preview</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChartPreviewScreen({
  profileData,
  onBack,
  onStartOver,
  onContinuePersona
}: {
  profileData: ProfileData;
  onBack: () => void;
  onStartOver: () => void;
  onContinuePersona: (result: ChartProfileResult) => void;
}) {
  const [chartResult, setChartResult] = useState<ChartProfileResult | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const previewValidation = validateBirthProfileForm(profileData);
  const canGenerate = previewValidation.isValid && !isSubmitting;

  useEffect(() => {
    if (!isSubmitting) {
      setGenerationStep(0);
      return;
    }

    const interval = setInterval(() => {
      setGenerationStep((current) => Math.min(current + 1, 3));
    }, 900);

    return () => clearInterval(interval);
  }, [isSubmitting]);

  async function handleGenerateChartProfile() {
    if (!previewValidation.isValid) {
      setSubmitError(previewValidation.message ?? "Please edit the birth details before generating.");
      return;
    }

    setSubmitError("");
    setIsSubmitting(true);

    try {
      const result = await submitChartProfile(profileData);
      setChartResult(result);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to prepare chart request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitting) {
    return <ChartGeneratingScreen activeStep={generationStep} name={profileData.name} />;
  }

  if (chartResult) {
    return (
      <ChartRevealScreen
        chart={chartResult.chart}
        name={profileData.name}
        onBack={onBack}
        onContinue={() => onContinuePersona(chartResult)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileTopBar}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <View style={styles.formStepPill}>
            <Text style={styles.formStepText}>Profile 2 of 3</Text>
          </View>
        </View>

        <View style={styles.previewHero}>
          <View style={styles.previewWheel}>
            <ChartWheel />
          </View>
          <Text style={styles.kicker}>Chart preview</Text>
          <Text style={styles.formTitle}>Ready to generate {profileData.name}'s chart.</Text>
          <Text style={styles.formIntro}>
            Review the details below. Lumis will use them to calculate your chart and create your profile.
          </Text>
        </View>

        <View style={styles.summaryPanel}>
          <SummaryRow label="Display name" value={profileData.name} />
          <SummaryRow label="Birth date" value={profileData.birthDate} />
          <SummaryRow
            label="Birth time"
            value={profileData.timeUnknown ? "Unknown - no birth time precision" : profileData.birthTime}
          />
          <SummaryRow label="Birth place" value={profileData.birthPlace} />
        </View>

        {!previewValidation.isValid ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>
              {previewValidation.message ?? "Please edit the birth details before generating."}
            </Text>
          </View>
        ) : null}

        {submitError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{submitError}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.fullPrimaryButton, !canGenerate && styles.disabledButton]}
          onPress={handleGenerateChartProfile}
          disabled={!canGenerate}
        >
          <Text style={styles.fullPrimaryButtonText}>
            Create my chart
          </Text>
        </Pressable>
        <Pressable style={styles.ghostButton} onPress={onStartOver}>
          <Text style={styles.ghostButtonText}>Start over</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChartGeneratingScreen({ activeStep, name }: { activeStep: number; name: string }) {
  const steps = [
    "Validating your birth details",
    "Positioning your sky",
    "Building your natal chart",
    "Shaping your Lumis profile"
  ];

  return (
    <SafeAreaView style={styles.generatingSafe}>
      <StatusBar style="light" />
      <CelestialBackground />
      <View style={styles.generatingFrame}>
        <View style={styles.generatingWheel}><ChartWheel /></View>
        <Text style={styles.generatingEyebrow}>READING YOUR SKY</Text>
        <Text style={styles.generatingTitle}>Building your sanctuary, {name}.</Text>
        <Text style={styles.generatingBody}>Lumis is calculating your chart and shaping your private profile.</Text>
        <View style={styles.generatingSteps}>
          {steps.map((step, index) => {
            const isComplete = index < activeStep;
            const isActive = index === activeStep;
            return (
              <View key={step} style={styles.generatingStep}>
                <View style={[styles.generatingStepIcon, isActive && styles.generatingStepIconActive, isComplete && styles.generatingStepIconComplete]}>
                  {isComplete ? <Check color="#071321" size={15} strokeWidth={3} /> : <Text style={[styles.generatingStepNumber, isActive && styles.generatingStepNumberActive]}>{index + 1}</Text>}
                </View>
                <Text style={[styles.generatingStepText, (isActive || isComplete) && styles.generatingStepTextActive]}>{step}</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.generatingPrivacy}>Your birth details stay linked to your private Lumis account.</Text>
      </View>
    </SafeAreaView>
  );
}

function ChartRevealScreen({
  chart,
  name,
  onBack,
  onContinue
}: {
  chart: ChartV2;
  name: string;
  onBack: () => void;
  onContinue: () => void;
}) {
  const sun = chart.planets.find((planet) => planet.key === "sun");
  const moon = chart.planets.find((planet) => planet.key === "moon");
  const ascendant = chart.precision === "full" ? chart.angles.ascendant : undefined;

  return (
    <SafeAreaView style={styles.chartRevealSafe}>
      <StatusBar style="light" />
      <CelestialBackground />
      <ScrollView contentContainerStyle={styles.chartRevealContent} showsVerticalScrollIndicator={false}>
        <View style={styles.chartRevealTopBar}>
          <Pressable accessibilityLabel="Back" onPress={onBack} style={styles.chartRevealIconButton}>
            <ArrowLeft color="#F7EBDD" size={20} />
          </Pressable>
          <View accessibilityLabel="Language: English" style={styles.chartRevealLanguage}>
            <Text style={styles.chartRevealLanguageText}>EN</Text>
          </View>
        </View>

        <Text style={styles.chartRevealEyebrow}>YOUR CHART</Text>
        <Text style={styles.chartRevealTitle}>{name}, this is your inner universe.</Text>
        <Text style={styles.chartRevealIntro}>
          Your chart is a map of the sky at the moment you were born. Lumis uses it to make every reflection more personal to you.
        </Text>

        <Text style={styles.chartRevealSectionLabel}>YOUR PSYCHOLOGICAL CHART</Text>
        <View style={styles.chartRevealWheelPanel}>
          <View style={styles.chartRevealWheelCanvas}>
            <NatalChartWheel chart={chart} />
          </View>
          <Text style={styles.chartRevealPrecision}>
            {chart.precision === "full"
              ? "Calculated with your birth time"
              : "Birth time unknown - planets shown without Ascendant, MC, houses, or planet house placements"}
          </Text>
        </View>

        <View style={styles.chartRevealPlacements}>
          <BigThreeCard label="Sun" value={formatPlacement(sun)} />
          <BigThreeCard label="Moon" value={formatPlacement(moon)} />
          {ascendant ? <BigThreeCard label="Rising" value={formatPlacement(ascendant)} /> : null}
        </View>

        <Text style={styles.chartRevealStory}>
          These placements are the opening notes of your Lumis Persona. You can explore their patterns gently, one conversation at a time.
        </Text>

        <Pressable accessibilityRole="button" onPress={onContinue} style={styles.chartRevealCta}>
          <Text style={styles.chartRevealCtaText}>Meet Lumis</Text>
          <ChevronRight color="#132238" size={19} strokeWidth={2.5} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatPlacement(placement: ChartV2["planets"][number] | undefined) {
  if (!placement) return "Not available";

  const normalizedDegree = ((placement.degree % 30) + 30) % 30;
  const totalMinutes = Math.floor(normalizedDegree * 60);
  const degrees = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${placement.sign} ${degrees}°${String(minutes).padStart(2, "0")}′`;
}

const SIGN_INDEX: Record<string, number> = {
  aries: 0,
  taurus: 1,
  gemini: 2,
  cancer: 3,
  leo: 4,
  virgo: 5,
  libra: 6,
  scorpio: 7,
  sagittarius: 8,
  capricorn: 9,
  aquarius: 10,
  pisces: 11
};

const PLANET_GLYPHS: Partial<Record<ChartV2["planets"][number]["key"], string>> = {
  sun: "☉",
  moon: "☽",
  mercury: "☿",
  venus: "♀",
  mars: "♂",
  jupiter: "♃",
  saturn: "♄",
  uranus: "♅",
  neptune: "♆",
  pluto: "♇",
  chiron: "⚷",
  true_node: "☊",
  south_node: "☋"
};

function NatalChartWheel({ chart }: { chart: ChartV2 }) {
  const center = 150;
  const plottedPlanets = chart.planets.filter(
    (planet) => planet.key !== "ascendant" && planet.key !== "medium_coeli"
  );
  const houseAngles = chart.precision === "full"
    ? chart.houses.map((house) => zodiacLongitude(house.sign, house.cuspDegree))
    : [];

  return (
    <Svg accessibilityLabel="Natal chart wheel" height="100%" viewBox="0 0 300 300" width="100%">
      <Circle cx={center} cy={center} fill="rgba(7,19,33,0.82)" r="137" stroke="#D7A950" strokeWidth="1.2" />
      <Circle cx={center} cy={center} fill="none" opacity="0.72" r="112" stroke="#EDE3D4" strokeWidth="0.7" />
      <Circle cx={center} cy={center} fill="none" opacity="0.52" r="80" stroke="#9298D5" strokeWidth="0.8" />
      <Circle cx={center} cy={center} fill="none" opacity="0.42" r="46" stroke="#EDE3D4" strokeWidth="0.6" />
      {Array.from({ length: 12 }).map((_, index) => {
        const outer = pointOnWheel(index * 30, 136);
        const inner = pointOnWheel(index * 30, 112);
        return <Line key={`sign-${index}`} opacity="0.48" stroke="#EDE3D4" strokeWidth="0.65" x1={inner.x} x2={outer.x} y1={inner.y} y2={outer.y} />;
      })}
      {houseAngles.map((angle, index) => {
        const outer = pointOnWheel(angle, 111);
        const inner = pointOnWheel(angle, 46);
        return <Line key={`house-${index}`} opacity="0.28" stroke="#D7A950" strokeWidth="0.7" x1={inner.x} x2={outer.x} y1={inner.y} y2={outer.y} />;
      })}
      {plottedPlanets.map((planet, index) => {
        const angle = planet.absoluteLongitude ?? zodiacLongitude(planet.sign, planet.degree);
        const point = pointOnWheel(angle, 94 - (index % 3) * 9);
        return (
          <SvgText
            fill={planet.key === "sun" || planet.key === "moon" ? "#F1C56B" : "#F7EBDD"}
            fontSize={planet.key === "sun" || planet.key === "moon" ? 17 : 14}
            fontWeight="600"
            key={`${planet.key}-${index}`}
            textAnchor="middle"
            x={point.x}
            y={point.y + 5}
          >
            {PLANET_GLYPHS[planet.key] ?? "•"}
          </SvgText>
        );
      })}
      <Circle cx={center} cy={center} fill="#D7A950" r="3.5" />
    </Svg>
  );
}

function zodiacLongitude(sign: string, degree: number) {
  return (SIGN_INDEX[sign.toLowerCase()] ?? 0) * 30 + degree;
}

function pointOnWheel(longitude: number, radius: number) {
  const radians = ((longitude - 90) * Math.PI) / 180;
  return {
    x: 150 + Math.cos(radians) * radius,
    y: 150 + Math.sin(radians) * radius
  };
}

function PersonaStyleScreen({
  name,
  initialIdentity,
  selectedStyle,
  onSelectStyle,
  onBack,
  onEnterChat
}: {
  name: string;
  initialIdentity: PersonaIdentityPreference;
  selectedStyle: PersonaStyleKey;
  onSelectStyle: (style: PersonaStyleKey) => void;
  onBack: () => void;
  onEnterChat: (identity: PersonaIdentityPreference) => Promise<void>;
}) {
  const [step, setStep] = useState<"style" | "identity">("style");
  const [buddyName, setBuddyName] = useState(initialIdentity.buddyName);
  const [avatarKey, setAvatarKey] = useState(initialIdentity.avatarKey);
  const [focus, setFocus] = useState<string | null>(initialIdentity.mainFocus);
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleEnterChat() {
    setSaveError("");
    setIsSaving(true);

    try {
      await onEnterChat({
        buddyName: buddyName.trim() || "Lumis",
        avatarKey,
        mainFocus: focus
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save Lumis Persona.");
    } finally {
      setIsSaving(false);
    }
  }

  if (step === "identity") {
    const selectedPersona = PERSONA_STYLES.find((style) => style.key === selectedStyle) ?? PERSONA_STYLES[0];
    const selectedAvatar = PERSONA_AVATARS.find((avatar) => avatar.key === avatarKey) ?? PERSONA_AVATARS[5];

    return (
      <SafeAreaView style={styles.personaSafe}>
        <StatusBar style="light" />
        <CelestialBackground />
        <ScrollView contentContainerStyle={styles.personaContent} showsVerticalScrollIndicator={false}>
          <View style={styles.personaTopBar}>
            <Pressable accessibilityLabel="Back" style={styles.personaBackButton} onPress={() => setStep("style")}>
              <ArrowLeft color="#F7EBDD" size={20} />
            </Pressable>
            <View accessibilityLabel="Language: English" style={styles.personaLanguage}>
              <Text style={styles.personaLanguageText}>EN</Text>
            </View>
          </View>

          <Text style={styles.personaEyebrow}>ENTER YOUR SANCTUARY</Text>
          <Text style={styles.personaTitle}>Give Lumis a face.</Text>
          <Text style={styles.personaIntro}>Pick a celestial spirit or choose your own name. This becomes their face in chat.</Text>

          <View style={styles.personaIdentityPreview}>
            <LumisPersonaAvatar avatarKey={selectedAvatar.key} size={72} />
            <View style={styles.personaIdentityPreviewText}>
              <Text style={styles.personaIdentityName}>{buddyName.trim() || "(unnamed)"}</Text>
              <Text style={styles.personaIdentityRole}>{selectedPersona.labelEn}</Text>
            </View>
          </View>

          <View style={styles.personaAvatarGrid}>
            {PERSONA_AVATARS.map((avatar) => {
              const selected = avatar.key === avatarKey;
              return (
                <Pressable
                  accessibilityLabel={`Choose ${avatar.label} avatar`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={avatar.key}
                  onPress={() => {
                    setAvatarKey(avatar.key);
                    setBuddyName(avatar.label);
                  }}
                  style={[styles.personaAvatarOption, selected && styles.personaAvatarOptionActive]}
                >
                  <LumisPersonaAvatar avatarKey={avatar.key} size={48} />
                  <Text style={styles.personaAvatarLabel}>{avatar.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.personaNameField}>
            <Text style={styles.personaFieldLabel}>CUSTOM NAME</Text>
            <TextInput
              accessibilityLabel="Custom Lumis Persona name"
              maxLength={24}
              onChangeText={setBuddyName}
              placeholder="Lumis"
              placeholderTextColor="rgba(247,235,221,0.42)"
              style={styles.personaNameInput}
              value={buddyName}
            />
          </View>

          <Text style={styles.personaFieldLabel}>WHAT SHOULD LUMIS HELP YOU FOCUS ON?</Text>
          <View style={styles.personaFocusRow}>
            {PERSONA_FOCUSES.map((option) => {
              const selected = focus === option.key;
              return (
                <Pressable
                  accessibilityState={{ selected }}
                  key={option.key}
                  onPress={() => setFocus(selected ? null : option.key)}
                  style={[styles.personaFocusChip, selected && styles.personaFocusChipActive]}
                >
                  {selected ? <Check color="#152238" size={13} strokeWidth={3} /> : null}
                  <Text style={[styles.personaFocusText, selected && styles.personaFocusTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {saveError ? <View style={styles.errorCard}><Text style={styles.errorText}>{saveError}</Text></View> : null}

          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={handleEnterChat}
            style={[styles.personaContinue, isSaving && styles.disabledButton]}
          >
            <Text style={styles.personaContinueText}>{isSaving ? "Saving your Persona..." : "Enter your sanctuary"}</Text>
            <ChevronRight color="#152238" size={19} strokeWidth={2.5} />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.personaSafe}>
      <StatusBar style="light" />
      <CelestialBackground />
      <ScrollView contentContainerStyle={styles.personaContent} showsVerticalScrollIndicator={false}>
        <View style={styles.personaTopBar}>
          <Pressable accessibilityLabel="Back" style={styles.personaBackButton} onPress={onBack}>
            <ArrowLeft color="#F7EBDD" size={20} />
          </Pressable>
          <View accessibilityLabel="Language: English" style={styles.personaLanguage}>
            <Text style={styles.personaLanguageText}>EN</Text>
          </View>
        </View>

        <Text style={styles.personaEyebrow}>CHOOSE YOUR LUMIS PERSONA</Text>
        <Text style={styles.personaTitle}>How should Lumis show up for you?</Text>
        <Text style={styles.personaIntro}>Pick the persona that fits you, {name}. You can change it anytime.</Text>

        <View style={styles.personaChoiceList}>
          {PERSONA_STYLES.map((style, index) => {
            const isSelected = style.key === selectedStyle;

            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                key={style.key}
                style={[styles.personaChoiceCard, isSelected && styles.personaChoiceCardActive]}
                onPress={() => onSelectStyle(style.key)}
              >
                <View style={[styles.personaIcon, isSelected && styles.personaIconActive]}>
                  <PersonaRoleIcon index={index} />
                </View>
                <View style={styles.personaText}>
                  <View style={styles.personaCardHeading}>
                    <Text style={styles.personaName}>{style.labelEn}</Text>
                    {isSelected ? (
                      <View style={styles.personaSelectedMark}>
                        <Check color="#152238" size={13} strokeWidth={3} />
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.personaPromise}>{style.promiseEn}</Text>
                  <Text style={styles.personaQuote}>{personaExample(style.key)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {saveError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{saveError}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          style={styles.personaContinue}
          onPress={() => setStep("identity")}
        >
          <Text style={styles.personaContinueText}>Continue</Text>
          <ChevronRight color="#152238" size={19} strokeWidth={2.5} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const PERSONA_FOCUSES = [
  { key: "career", label: "Career" },
  { key: "love", label: "Relationships" },
  { key: "emotion", label: "Emotions" },
  { key: "timing", label: "Timing" },
  { key: "growth", label: "Growth" }
];

function PersonaRoleIcon({ index }: { index: number }) {
  if (index === 0) return <UsersRound color="#D8DDFB" size={27} strokeWidth={1.6} />;
  if (index === 1) return <Sparkles color="#F3C96F" size={27} strokeWidth={1.7} />;
  return <Compass color="#9DD6B7" size={27} strokeWidth={1.7} />;
}

function personaExample(style: PersonaStyleKey) {
  if (style === "acceptance") return "I will take this slowly with you. No pressure.";
  if (style === "spark") return "Let us find the fresh angle that gets things moving.";
  return "Let us notice the pattern beneath what keeps repeating.";
}

function ChatShellScreen({
  name,
  lumisName,
  lumisAvatarKey,
  chart,
  initialDraft,
  selectedStyle,
  chatTurns,
  remainingCredits,
  forceNewSupabaseThread,
  activeSupabaseThreadId,
  readOnlyReason,
  onChatStateChange,
  onInitialDraftConsumed,
  onNotifications,
  onPastReflections,
  onSupabaseThreadStarted,
  onStartNewTopic,
  onSelectTab,
  onBack
}: {
  name: string;
  lumisName: string;
  lumisAvatarKey: string;
  chart: ChartV2 | null;
  initialDraft: string | null;
  selectedStyle: PersonaStyleKey;
  chatTurns: ChatTurn[];
  remainingCredits: number;
  forceNewSupabaseThread: boolean;
  activeSupabaseThreadId: string | null;
  readOnlyReason: string | null;
  onChatStateChange: (nextChatTurns: ChatTurn[], nextRemainingCredits: number) => Promise<void>;
  onInitialDraftConsumed: () => void;
  onNotifications: () => void;
  onPastReflections: () => void;
  onSupabaseThreadStarted: (threadId: string) => void;
  onStartNewTopic: () => void;
  onSelectTab: (tab: MainTab) => void;
  onBack: () => void;
}) {
  const [draftMessage, setDraftMessage] = useState(initialDraft ?? "");
  const [isSending, setIsSending] = useState(false);
  const [retryClientMessageId, setRetryClientMessageId] = useState<string | null>(null);
  const selectedPersona = PERSONA_STYLES.find((style) => style.key === selectedStyle) ?? PERSONA_STYLES[0];
  const sun = chart?.planets.find((planet) => planet.key === "sun");
  const moon = chart?.planets.find((planet) => planet.key === "moon");
  const ascendant = chart?.angles.ascendant;
  const canSend = !readOnlyReason && draftMessage.trim().length > 0 && !isSending;

  useEffect(() => {
    if (initialDraft) onInitialDraftConsumed();
  }, [initialDraft, onInitialDraftConsumed]);

  async function handleSend() {
    if (!canSend) {
      return;
    }

    const nextMessage = draftMessage.trim();
    const clientMessageId = retryClientMessageId ?? randomUUID();
    const turnId = clientMessageId;
    const nextPendingTurns = [
      ...chatTurns,
      {
        id: turnId,
        clientMessageId,
        userMessage: nextMessage,
        result: null,
        error: ""
      }
    ];

    setDraftMessage("");
    setRetryClientMessageId(null);
    setIsSending(true);
    await onChatStateChange(nextPendingTurns, remainingCredits);

    try {
      const result = await sendChatMessage({
        message: nextMessage,
        clientMessageId,
        personaStyle: selectedStyle,
        chart,
        forceNewThread: forceNewSupabaseThread,
        threadId: forceNewSupabaseThread ? null : activeSupabaseThreadId
      });
      if (result.mode === "supabase" && result.persistenceMode === "not_persisted") {
        throw new Error(getChatPersistenceMessage(result.persistenceError));
      }
      if (result.threadId && forceNewSupabaseThread) {
        onSupabaseThreadStarted(result.threadId);
      }
      const nextRemainingCredits =
        result.mode === "supabase" && result.remainingCredits != null
          ? result.remainingCredits
          : result.mode === "supabase"
            ? remainingCredits
          : Math.max(0, remainingCredits - result.creditsCost);
      await onChatStateChange(
        nextPendingTurns.map((turn) => (turn.id === turnId ? { ...turn, result } : turn)),
        nextRemainingCredits
      );
    } catch (error) {
      await onChatStateChange(
        nextPendingTurns.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                error: error instanceof Error ? error.message : "Unable to send message."
              }
            : turn
        ),
        remainingCredits
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <SafeAreaViewCtx edges={["top", "left", "right"]} style={styles.lumisDarkSafe}>
      <StatusBar style="light" />
      <CelestialBackground />
      <View style={styles.chatShell}>
        <View style={styles.chatTopBar}>
          <Pressable style={styles.chatIconButton} onPress={onBack} accessibilityLabel="Back to home">
            <ArrowLeft color="#F0F4F8" size={20} />
          </Pressable>
          <View style={styles.chatAvatar}>
            <LumisPersonaAvatar avatarKey={lumisAvatarKey} size={38} />
          </View>
          <View style={styles.chatTitleWrap}>
            <Text style={styles.chatTitle}>{lumisName}</Text>
            <Pressable
              style={styles.chatPersonaChip}
              onPress={() => onSelectTab("insights")}
              accessibilityRole="button"
              accessibilityLabel={`${selectedPersona.labelEn} — open your Sky`}
            >
              <View style={styles.chatPresenceDot} />
              <Text style={styles.chatChipText}>{selectedPersona.labelEn}</Text>
              <Compass color="#C4CEDB" size={12} />
            </Pressable>
          </View>
          <Pressable style={styles.chatIconButton} onPress={onPastReflections} accessibilityLabel="Past Reflections">
            <History color="#F0F4F8" size={18} />
          </Pressable>
          <Pressable style={styles.chatIconButton} onPress={onStartNewTopic} accessibilityLabel="Start a new topic">
            <Plus color="#F0F4F8" size={18} />
          </Pressable>
          <Pressable style={styles.chatIconButton} onPress={onNotifications} accessibilityLabel="Notifications">
            <Bell color="#F0F4F8" size={18} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.chatContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.chatDayLabel}>TODAY</Text>
          <View style={styles.messageRowLumis}>
            <View style={styles.messageAvatar}><Sparkles color="#071321" size={13} /></View>
            <View style={styles.messageBubbleLumis}>
              <Text style={styles.messageTextLumis}>
                Hi {name}. What feels most worth understanding today?
              </Text>
            </View>
          </View>

          {chatTurns.length === 0 ? (
            <View style={styles.quickPromptGrid}>
              {QUICK_CHAT_PROMPTS.map((prompt) => (
                <Pressable
                  key={prompt}
                  style={styles.quickPromptButton}
                  onPress={() => setDraftMessage(prompt)}
                >
                  <Text style={styles.quickPromptText}>{prompt}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {chatTurns.map((turn) => (
            <View key={turn.id}>
              <View style={styles.messageBubbleUser}>
                <Text style={styles.messageTextUser}>{turn.userMessage}</Text>
              </View>
              {turn.result ? (
                <View style={styles.messageRowLumis}>
                  <View style={styles.messageAvatar}><Sparkles color="#071321" size={13} /></View>
                  <View style={styles.messageBubbleLumis}>
                    <Text style={styles.messageTextLumis}>{turn.result.reply}</Text>
                  </View>
                </View>
              ) : null}
              {isSending && !turn.result && !turn.error && turn.id === chatTurns[chatTurns.length - 1]?.id ? (
                <View style={styles.messageRowLumis}>
                  <View style={styles.messageAvatar}><Sparkles color="#071321" size={13} /></View>
                  <View style={styles.messageBubbleLumis}>
                    <Text style={styles.messageTextLumis}>Reflecting...</Text>
                  </View>
                </View>
              ) : null}
              {turn.error ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>{turn.error}</Text>
                  <View style={styles.chatErrorActions}>
                    <Pressable
                      style={styles.chatErrorButton}
                      onPress={() => {
                        setDraftMessage(turn.userMessage);
                        setRetryClientMessageId(turn.clientMessageId ?? randomUUID());
                      }}
                    >
                      <Text style={styles.chatErrorButtonText}>Retry</Text>
                    </Pressable>
                    <Pressable style={styles.chatErrorButton} onPress={onStartNewTopic}>
                      <Text style={styles.chatErrorButtonText}>New topic</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          ))}

        </ScrollView>

        {readOnlyReason ? (
          <View style={styles.chatReadOnlyNotice}>
            <Text style={styles.chatReadOnlyTitle}>Past Reflection · Read only</Text>
            <Text style={styles.chatReadOnlyText}>{readOnlyReason} Start a new topic to continue with your current chart.</Text>
            <Pressable style={styles.chatReadOnlyButton} onPress={onStartNewTopic}>
              <Text style={styles.chatReadOnlyButtonText}>Start new topic</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.chatComposer}>
            <TextInput
              style={styles.chatInput}
              placeholder="Ask Lumis..."
              placeholderTextColor="#71839A"
              value={draftMessage}
              onChangeText={setDraftMessage}
            />
            <Pressable
              style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!canSend}
            >
              {isSending ? <Text style={styles.sendButtonText}>...</Text> : <Send color="#071321" size={19} />}
            </Pressable>
          </View>
        )}
      </View>
      <MainTabBar active="chat" onSelect={onSelectTab} />
    </SafeAreaViewCtx>
  );
}

function PastReflectionsScreen({
  hasLocalDemoSession,
  accountSource,
  profileData,
  selectedStyle,
  chatTurns,
  reflectionThreads,
  onBack,
  onContinueReflection,
  onStartNewTopic
}: {
  hasLocalDemoSession: boolean;
  accountSource: AccountSource;
  profileData: ProfileData | null;
  selectedStyle: PersonaStyleKey;
  chatTurns: ChatTurn[];
  reflectionThreads: RestoredReflectionThread[];
  onBack: () => void;
  onContinueReflection: (thread: RestoredReflectionThread | null) => void;
  onStartNewTopic: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const selectedPersona = PERSONA_STYLES.find((style) => style.key === selectedStyle) ?? PERSONA_STYLES[0];
  const localThread: RestoredReflectionThread | null = chatTurns.length > 0
    ? {
        id: "local-reflection",
        title: chatTurns[0]?.userMessage ?? "Lumis reflection",
        personaStyle: selectedStyle,
        chartVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        canContinue: true,
        unavailableReason: null,
        turns: chatTurns
      }
    : null;
  const visibleThreads = accountSource === "supabase"
    ? reflectionThreads
    : localThread
      ? [localThread]
      : [];
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredThreads = normalizedQuery
    ? visibleThreads.filter((thread) => {
        const searchableText = [
          thread.title,
          ...thread.turns.flatMap((turn) => [turn.userMessage, turn.result?.reply ?? ""])
        ].join(" ").toLowerCase();

        return searchableText.includes(normalizedQuery);
      })
    : visibleThreads;

  return (
    <SafeAreaView style={styles.lumisDarkSafe}>
      <StatusBar style="light" />
      <CelestialBackground />
      <View style={styles.reflectionsShell}>
        <View style={styles.reflectionsHeader}>
          <Pressable style={styles.chatIconButton} onPress={onBack} accessibilityLabel="Back to home">
            <ArrowLeft color="#F0F4F8" size={20} />
          </Pressable>
          <View style={styles.reflectionsHeaderCopy}>
            <Text style={styles.reflectionsTitle}>Past Reflections</Text>
            <Text style={styles.reflectionsSubtitle}>
              Your ongoing reflections with Lumis
            </Text>
          </View>
          <Pressable style={styles.newTopicIconButton} onPress={onStartNewTopic} accessibilityLabel="Start a new topic">
            <Plus color="#071321" size={20} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.reflectionsContent} showsVerticalScrollIndicator={false}>
          {(hasLocalDemoSession || accountSource === "supabase") && profileData ? (
            visibleThreads.length > 0 ? (
              <>
                <Pressable style={styles.reflectionsNewTopic} onPress={onStartNewTopic}>
                  <Plus color="#071321" size={18} />
                  <Text style={styles.reflectionsNewTopicText}>Start a new topic</Text>
                </Pressable>

                <View style={styles.reflectionsSearch}>
                  <Search color="#71839A" size={18} />
                  <TextInput
                    accessibilityLabel="Search reflections"
                    onChangeText={setSearchQuery}
                    placeholder="Search reflections"
                    placeholderTextColor="#71839A"
                    style={styles.reflectionsSearchInput}
                    value={searchQuery}
                  />
                </View>

                <View style={styles.reflectionsSectionHeading}>
                  <Text style={styles.reflectionsSectionLabel}>PAST REFLECTIONS</Text>
                  <Text style={styles.reflectionsSectionCount}>{filteredThreads.length}</Text>
                </View>

                {filteredThreads.length > 0 ? filteredThreads.map((thread) => {
                  const latestTurn = thread.turns[thread.turns.length - 1];
                  const preview = latestTurn?.result?.reply ?? latestTurn?.userMessage ?? "Continue your reflection with Lumis.";
                  const persona = PERSONA_STYLES.find((style) => style.key === thread.personaStyle) ?? selectedPersona;

                  return (
                    <Pressable
                      accessibilityLabel={thread.canContinue ? "Continue reflection" : "Read reflection"}
                      key={thread.id}
                      style={styles.reflectionThreadCard}
                      onPress={() => onContinueReflection(thread)}
                    >
                      <View style={styles.reflectionThreadIcon}>
                        <MessageCircle color="#8B93D4" size={20} />
                      </View>
                      <View style={styles.reflectionThreadCopy}>
                        <Text style={styles.reflectionThreadTitle} numberOfLines={2}>{thread.title}</Text>
                        <Text style={styles.reflectionThreadPreview} numberOfLines={2}>{preview}</Text>
                        <Text style={styles.reflectionThreadMeta}>
                          {formatReflectionDate(thread.updatedAt)} · {persona.labelEn} · Chart v{thread.chartVersion}
                        </Text>
                        <Text style={styles.reflectionThreadAction}>
                          {thread.canContinue ? "Continue reflection" : "Read reflection"}
                        </Text>
                      </View>
                      <View style={styles.reflectionThreadStatus}>
                        {!thread.canContinue ? <Text style={styles.reflectionReadOnlyLabel}>READ ONLY</Text> : null}
                        <ChevronRight color="#71839A" size={19} />
                      </View>
                    </Pressable>
                  );
                }) : (
                  <View style={styles.reflectionsNoResults}>
                    <Text style={styles.reflectionThreadTitle}>No matching reflections</Text>
                    <Text style={styles.reflectionThreadPreview}>Try a different word or clear your search.</Text>
                    <Pressable onPress={() => setSearchQuery("")}>
                      <Text style={styles.reflectionThreadAction}>Clear search</Text>
                    </Pressable>
                  </View>
                )}

                <View style={styles.savedInsightsSection}>
                  <Text style={styles.reflectionsSectionLabel}>SAVED INSIGHTS</Text>
                  <View style={styles.savedInsightsEmpty}>
                    <Sparkles color="#C9A96E" size={19} />
                    <View style={styles.reflectionThreadCopy}>
                      <Text style={styles.reflectionThreadTitle}>Nothing saved yet</Text>
                      <Text style={styles.reflectionThreadPreview}>
                        Saved Insights will appear here after this feature becomes available.
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.reflectionsEmpty}>
                <View style={styles.reflectionsEmptyIcon}><History color="#C9A96E" size={25} /></View>
                <Text style={styles.noticeTitle}>No saved Past Reflections yet</Text>
                <Text style={styles.noticeBody}>
                  Your chart is ready. Start a conversation and it will appear here when it has been saved.
                </Text>
                <Pressable style={styles.reflectionsPrimary} onPress={onStartNewTopic}>
                  <Text style={styles.reflectionsPrimaryText}>Start first reflection</Text>
                </Pressable>
              </View>
            )
          ) : (
            <View style={styles.reflectionsEmpty}>
              <View style={styles.reflectionsEmptyIcon}><History color="#C9A96E" size={25} /></View>
              <Text style={styles.noticeTitle}>Create your chart first</Text>
              <Text style={styles.noticeBody}>Past Reflections will be saved after your first Lumis conversation.</Text>
              <Pressable style={styles.reflectionsPrimary} onPress={onStartNewTopic}>
                <Text style={styles.reflectionsPrimaryText}>Create my chart</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.reflectionPrivacyNote}>
            <Sparkles color="#C9A96E" size={15} />
            <Text style={styles.reflectionPrivacyText}>
              Private to {profileData?.name ?? "your account"}
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function formatReflectionDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Saved";

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getChatPersistenceMessage(errorCode?: string | null) {
  if (errorCode === "REFLECTION_THREAD_NOT_AVAILABLE") {
    return "This Past Reflection is no longer available to continue. Your message was not saved. Start a new topic and try again.";
  }

  if (errorCode === "ACTIVE_PROFILE_REQUIRED") {
    return "Your active Lumis profile could not be loaded. Your message was not saved. Refresh your account before trying again.";
  }

  return "This reply was not saved. Please try sending your message again.";
}

function PlansAccessScreen({
  currentPlan,
  onBack
}: {
  currentPlan: PlanTier;
  onBack: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileTopBar}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <View style={styles.formStepPill}>
            <Text style={styles.formStepText}>Plans & Access</Text>
          </View>
        </View>

        <View style={styles.formHero}>
          <View style={styles.formLogo}>
            <Text style={styles.planHeroIcon}>HK$</Text>
          </View>
          <Text style={styles.kicker}>Plans & Access</Text>
          <Text style={styles.formTitle}>Credits, routes, and premium gates.</Text>
          <Text style={styles.formIntro}>
            This scaffold shows the current entitlement rules. Live purchases will be connected
            after RevenueCat and App Store setup.
          </Text>
        </View>

        <View style={styles.planCardGrid}>
          {PRODUCTS.map((product) => {
            const tier = product.tier as PlanTier;
            const isCurrent = tier === currentPlan;
            const features = PLAN_ENTITLEMENTS[tier] ?? [];

            return (
              <View key={product.code} style={[styles.planAccessCard, isCurrent && styles.planAccessCardCurrent]}>
                <View style={styles.planAccessHeader}>
                  <View>
                    <Text style={styles.planAccessName}>{product.name}</Text>
                    <Text style={styles.planAccessPrice}>
                      HK${product.priceHkd} · {product.credits} credits
                    </Text>
                  </View>
                  {isCurrent ? <Text style={styles.currentPlanPill}>Current</Text> : null}
                </View>
                <View style={styles.featureList}>
                  {features.map((feature) => (
                    <Text key={feature} style={styles.featureText}>
                      {FEATURE_LABELS[feature]}
                    </Text>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.routeAccessPanel}>
          <Text style={styles.noticeTitle}>Route access</Text>
          {ROUTE_CREDITS.map((route) => (
            <View key={route.route} style={styles.routeAccessRow}>
              <View style={styles.routeAccessCopy}>
                <Text style={styles.routeAccessTitle}>{route.label}</Text>
                <Text style={styles.routeAccessMeta}>
                  {route.credits} credits · {ROUTE_PLAN_REQUIREMENTS[route.route]}
                </Text>
              </View>
              <Text style={[styles.routeAccessStatus, canUseRoute(currentPlan, route.route) && styles.routeAccessStatusOpen]}>
                {canUseRoute(currentPlan, route.route) ? "Available" : "Upgrade"}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Implementation note</Text>
          <Text style={styles.noticeBody}>
            Backend functions must enforce credits and plan gates. Mobile copy is only a guide and
            must never be trusted for billing or access control.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MiniChartStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniChartStat}>
      <Text style={styles.miniChartLabel}>{label}</Text>
      <Text style={styles.miniChartValue}>{value}</Text>
    </View>
  );
}

function NotificationBellIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6.6 10.4C6.6 7.1 8.7 5 12 5s5.4 2.1 5.4 5.4v2.9l1.3 2.2H5.3l1.3-2.2v-2.9Z"
        fill="none"
        stroke="#7B5A27"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <Path
        d="M10 18.1c.4.7 1.1 1.1 2 1.1s1.6-.4 2-1.1"
        fill="none"
        stroke="#7B5A27"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <Circle cx="12" cy="4" r="1.2" fill="#B4863F" />
    </Svg>
  );
}

function BigThreeCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.bigThreeCard}>
      <Text style={styles.bigThreeLabel}>{label}</Text>
      <Text style={styles.bigThreeValue}>{value}</Text>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  editable = true
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  editable?: boolean;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, !editable && styles.fieldInputDisabled]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#B2A48F"
        editable={editable}
      />
    </View>
  );
}

function LumisLogo({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx="60" cy="60" r="44" fill="none" stroke="#B4863F" strokeWidth="1.8" opacity="0.72" />
      <Circle cx="60" cy="60" r="25" fill="none" stroke="#5B63B7" strokeWidth="1.55" opacity="0.72" />
      <Circle cx="66.6" cy="21.4" r="7" fill="#D2A24F" />
      <SvgText
        x="60"
        y="68"
        textAnchor="middle"
        fontSize="28"
        fontWeight="600"
        fill="#B4863F"
      >
        ☉
      </SvgText>
    </Svg>
  );
}

function ChartWheel() {
  return (
    <Svg width={94} height={94} viewBox="0 0 94 94">
      <Circle cx="47" cy="47" r="43" fill="#0F2038" stroke="#D2A24F" strokeWidth="1" opacity="0.96" />
      <Circle cx="47" cy="47" r="30" fill="none" stroke="#EEE0C9" strokeWidth="0.7" opacity="0.62" />
      <Circle cx="47" cy="47" r="17" fill="none" stroke="#8B93D4" strokeWidth="0.8" opacity="0.72" />
      {Array.from({ length: 12 }).map((_, index) => {
        const angle = (Math.PI * 2 * index) / 12;
        const x1 = 47 + Math.cos(angle) * 18;
        const y1 = 47 + Math.sin(angle) * 18;
        const x2 = 47 + Math.cos(angle) * 42;
        const y2 = 47 + Math.sin(angle) * 42;
        return (
          <Line
            key={index}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#EEE0C9"
            strokeWidth="0.55"
            opacity="0.32"
          />
        );
      })}
      <Path d="M28 46 C36 28, 56 30, 66 42 S66 68, 45 69 S22 57, 28 46" fill="none" stroke="#D2A24F" strokeWidth="1.2" />
      <Circle cx="47" cy="47" r="4" fill="#D2A24F" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F3ECE0"
  },
  content: {
    padding: 20,
    paddingBottom: 34,
    gap: 18
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  topBarActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  wordmark: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  wordmarkTitle: {
    color: "#2F2B25",
    fontSize: 17,
    fontWeight: "700"
  },
  wordmarkSub: {
    color: "#8A7659",
    fontSize: 12,
    marginTop: 1
  },
  notificationButton: {
    alignItems: "center",
    backgroundColor: "rgba(180,134,63,0.12)",
    borderColor: "rgba(180,134,63,0.28)",
    borderRadius: 999,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    position: "relative",
    width: 38
  },
  notificationBadge: {
    alignItems: "center",
    backgroundColor: "#9B3F31",
    borderColor: "#F3ECE0",
    borderRadius: 999,
    borderWidth: 1,
    height: 17,
    justifyContent: "center",
    position: "absolute",
    right: -4,
    top: -4,
    width: 17
  },
  notificationBadgeText: {
    color: "#FBF7EE",
    fontSize: 10,
    fontWeight: "800"
  },
  hero: {
    alignItems: "center",
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 28,
    borderWidth: 1,
    gap: 12,
    overflow: "hidden",
    paddingHorizontal: 24,
    paddingVertical: 32
  },
  heroOrb: {
    alignItems: "center",
    backgroundColor: "#F3ECE0",
    borderColor: "rgba(180,134,63,0.18)",
    borderRadius: 86,
    borderWidth: 1,
    height: 164,
    justifyContent: "center",
    width: 164
  },
  kicker: {
    color: "#B4863F",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: 8,
    textTransform: "uppercase"
  },
  title: {
    color: "#2F2B25",
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 37,
    maxWidth: 330,
    textAlign: "center"
  },
  body: {
    color: "#6F6252",
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 340,
    textAlign: "center"
  },
  heroActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8
  },
  primaryButton: {
    backgroundColor: "#2F2B25",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 13
  },
  primaryButtonText: {
    color: "#FBF7EE",
    fontSize: 14,
    fontWeight: "700"
  },
  secondaryButton: {
    backgroundColor: "rgba(180,134,63,0.13)",
    borderColor: "rgba(180,134,63,0.22)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 13
  },
  secondaryButtonText: {
    color: "#6D4F23",
    fontSize: 14,
    fontWeight: "700"
  },
  accountStatusCard: {
    alignItems: "center",
    backgroundColor: "#10243E",
    borderColor: "rgba(210,162,79,0.32)",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
    padding: 16
  },
  accountStatusTitle: {
    color: "#FBF7EE",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21
  },
  accountStatusBody: {
    color: "#D8CCBA",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 5
  },
  accountStatusAction: {
    backgroundColor: "rgba(210,162,79,0.18)",
    borderColor: "rgba(210,162,79,0.28)",
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
    paddingHorizontal: 13,
    paddingVertical: 9
  },
  accountStatusActionText: {
    color: "#F7D99F",
    fontSize: 12,
    fontWeight: "800"
  },
  reflectionEntryCard: {
    alignItems: "center",
    backgroundColor: "rgba(91,99,183,0.10)",
    borderColor: "rgba(91,99,183,0.16)",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
    padding: 16
  },
  reflectionEntryTitle: {
    color: "#36366C",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21
  },
  reflectionEntryBody: {
    color: "#5D5A7C",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 5
  },
  reflectionEntryAction: {
    color: "#454286",
    flexShrink: 0,
    fontSize: 12,
    fontWeight: "800"
  },
  birthDetailsEntryCard: {
    alignItems: "center",
    backgroundColor: "rgba(180,134,63,0.10)",
    borderColor: "rgba(180,134,63,0.20)",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
    padding: 16
  },
  birthDetailsEntryTitle: {
    color: "#2F2B25",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21
  },
  birthDetailsEntryBody: {
    color: "#6F6252",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 5
  },
  careEntryCard: {
    alignItems: "center",
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 16
  },
  careEntryIcon: {
    alignItems: "center",
    backgroundColor: "rgba(180,134,63,0.13)",
    borderColor: "rgba(180,134,63,0.24)",
    borderRadius: 19,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  careEntryIconText: {
    color: "#8B6429",
    fontSize: 20,
    fontWeight: "900"
  },
  careEntryCopy: {
    flex: 1
  },
  careEntryTitle: {
    color: "#2F2B25",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21
  },
  careEntryBody: {
    color: "#6F6252",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5
  },
  chartCard: {
    alignItems: "center",
    backgroundColor: "#10213A",
    borderColor: "rgba(238,224,201,0.18)",
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 15,
    padding: 16
  },
  chartArt: {
    alignItems: "center",
    backgroundColor: "#0B1930",
    borderRadius: 22,
    height: 106,
    justifyContent: "center",
    width: 106
  },
  chartCopy: {
    flex: 1
  },
  sectionEyebrow: {
    color: "#D2A24F",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 6,
    textTransform: "uppercase"
  },
  cardTitle: {
    color: "#F9F0E1",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 23
  },
  cardBody: {
    color: "#CFC6B6",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6
  },
  sectionHeader: {
    gap: 4,
    marginTop: 4
  },
  sectionTitle: {
    color: "#2F2B25",
    fontSize: 22,
    fontWeight: "700"
  },
  sectionSub: {
    color: "#7B6E5F",
    fontSize: 14
  },
  personaList: {
    gap: 10
  },
  personaChoiceList: {
    gap: 11
  },
  personaCard: {
    alignItems: "center",
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 13,
    padding: 15
  },
  personaCardActive: {
    backgroundColor: "rgba(180,134,63,0.08)",
    borderColor: "#B4863F"
  },
  personaIcon: {
    alignItems: "center",
    backgroundColor: "rgba(121,133,204,0.18)",
    borderRadius: 8,
    height: 54,
    justifyContent: "center",
    width: 54
  },
  personaIconActive: {
    backgroundColor: "rgba(121,133,204,0.30)"
  },
  personaText: {
    flex: 1
  },
  personaName: {
    color: "#FFF5E8",
    fontSize: 18,
    fontWeight: "800"
  },
  personaZh: {
    color: "#8A7659",
    fontSize: 13,
    marginTop: 2
  },
  personaChoiceCard: {
    alignItems: "flex-start",
    backgroundColor: "rgba(25,43,70,0.72)",
    borderColor: "rgba(247,235,221,0.16)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 15
  },
  personaChoiceCardActive: {
    backgroundColor: "rgba(42,61,94,0.86)",
    borderColor: "#DDB45E",
    borderWidth: 1.5
  },
  personaCardHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  personaSelectedMark: {
    alignItems: "center",
    backgroundColor: "#F0C76D",
    borderRadius: 999,
    height: 24,
    justifyContent: "center",
    width: 24
  },
  personaPromise: {
    color: "rgba(247,235,221,0.76)",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4
  },
  personaQuote: {
    borderLeftColor: "rgba(224,180,93,0.55)",
    borderLeftWidth: 2,
    color: "#E3CA93",
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 18,
    marginTop: 9,
    paddingLeft: 9
  },
  personaSafe: {
    backgroundColor: "#091525",
    flex: 1
  },
  personaContent: {
    alignSelf: "center",
    gap: 15,
    maxWidth: 480,
    paddingBottom: 36,
    paddingHorizontal: 22,
    width: "100%"
  },
  personaTopBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8
  },
  personaBackButton: {
    alignItems: "center",
    backgroundColor: "rgba(9,21,37,0.52)",
    borderColor: "rgba(247,235,221,0.22)",
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  personaLanguage: {
    alignItems: "center",
    backgroundColor: "rgba(9,21,37,0.52)",
    borderColor: "rgba(247,235,221,0.22)",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    minWidth: 46
  },
  personaLanguageText: {
    color: "#F7EBDD",
    fontSize: 12,
    fontWeight: "800"
  },
  personaEyebrow: {
    color: "#E0B45D",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.15,
    marginTop: 6
  },
  personaTitle: {
    color: "#FFF5E8",
    fontSize: 31,
    fontWeight: "700",
    lineHeight: 38
  },
  personaIntro: {
    color: "rgba(247,235,221,0.76)",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4
  },
  personaContinue: {
    alignItems: "center",
    backgroundColor: "#F1C86F",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 3,
    minHeight: 54,
    paddingHorizontal: 20
  },
  personaContinueText: {
    color: "#152238",
    fontSize: 16,
    fontWeight: "800"
  },
  personaIdentityPreview: {
    alignItems: "center",
    backgroundColor: "rgba(38,57,88,0.76)",
    borderColor: "rgba(247,235,221,0.18)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 15,
    padding: 15
  },
  personaIdentityPreviewText: {
    flex: 1,
    gap: 4
  },
  personaIdentityName: {
    color: "#FFF5E8",
    fontSize: 20,
    fontWeight: "800"
  },
  personaIdentityRole: {
    color: "#D9B35D",
    fontSize: 13,
    fontWeight: "700"
  },
  personaAvatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  personaAvatarOption: {
    alignItems: "center",
    backgroundColor: "rgba(18,34,56,0.64)",
    borderColor: "rgba(247,235,221,0.14)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    minHeight: 78,
    paddingHorizontal: 5,
    paddingVertical: 8,
    width: "22.8%"
  },
  personaAvatarOptionActive: {
    backgroundColor: "rgba(48,61,91,0.88)",
    borderColor: "#DDB45E",
    borderWidth: 1.5
  },
  personaAvatarLabel: {
    color: "rgba(247,235,221,0.82)",
    fontSize: 10,
    fontWeight: "700"
  },
  personaNameField: {
    gap: 7,
    marginTop: 3
  },
  personaFieldLabel: {
    color: "rgba(247,235,221,0.68)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.9
  },
  personaNameInput: {
    backgroundColor: "rgba(9,21,37,0.68)",
    borderColor: "rgba(247,235,221,0.18)",
    borderRadius: 8,
    borderWidth: 1,
    color: "#FFF5E8",
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14
  },
  personaFocusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  personaFocusChip: {
    alignItems: "center",
    backgroundColor: "rgba(18,34,56,0.66)",
    borderColor: "rgba(247,235,221,0.17)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    minHeight: 38,
    paddingHorizontal: 11
  },
  personaFocusChipActive: {
    backgroundColor: "#E8BE66",
    borderColor: "#E8BE66"
  },
  personaFocusText: {
    color: "rgba(247,235,221,0.8)",
    fontSize: 12,
    fontWeight: "700"
  },
  personaFocusTextActive: {
    color: "#152238"
  },
  quickGrid: {
    flexDirection: "row",
    gap: 10
  },
  quickCard: {
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minHeight: 92,
    padding: 14
  },
  quickTitle: {
    color: "#2F2B25",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18
  },
  quickMeta: {
    color: "#B4863F",
    fontSize: 12,
    fontWeight: "700",
    marginTop: "auto"
  },
  planStrip: {
    backgroundColor: "rgba(91,99,183,0.10)",
    borderColor: "rgba(91,99,183,0.16)",
    borderRadius: 18,
    borderWidth: 1,
    padding: 16
  },
  planTitle: {
    color: "#36366C",
    fontSize: 15,
    fontWeight: "800"
  },
  planBody: {
    color: "#5D5A7C",
    fontSize: 13,
    marginTop: 4
  },
  chatShell: {
    flex: 1,
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 8
  },
  chatTopBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  chatTitleWrap: {
    flex: 1
  },
  chatTitle: {
    color: "#F0F4F8",
    fontSize: 17,
    fontWeight: "800"
  },
  chatSubtitle: {
    color: "#C9A96E",
    fontSize: 11,
    fontWeight: "600"
  },
  chatContent: {
    gap: 14,
    paddingBottom: 18,
    paddingTop: 4
  },
  chatContextCard: {
    alignItems: "center",
    backgroundColor: "#152943",
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12
  },
  chatContextTitle: {
    color: "#F9F0E1",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28
  },
  chatContextBody: {
    color: "#CFC6B6",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8
  },
  chatChartRow: {
    flex: 1,
    flexDirection: "row",
    gap: 8
  },
  miniChartStat: {
    flex: 1,
    paddingVertical: 2
  },
  miniChartLabel: {
    color: "#D2A24F",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  miniChartValue: {
    color: "#F9F0E1",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 3
  },
  messageBubbleLumis: {
    backgroundColor: "#152943",
    borderColor: "rgba(255,255,255,0.09)",
    borderBottomLeftRadius: 6,
    borderRadius: 18,
    borderWidth: 1,
    flexShrink: 1,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  messageBubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: "#C9A96E",
    borderBottomRightRadius: 6,
    borderRadius: 18,
    maxWidth: "88%",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  messageAuthor: {
    color: "#B4863F",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6
  },
  messageAuthorUser: {
    color: "#6D4F23",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6
  },
  messageText: {
    color: "#2F2B25",
    fontSize: 15,
    lineHeight: 22
  },
  quickPromptGrid: {
    gap: 9
  },
  quickPromptButton: {
    alignSelf: "flex-start",
    backgroundColor: "#152943",
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: "92%",
    paddingHorizontal: 13,
    paddingVertical: 10
  },
  quickPromptText: {
    color: "#C4CEDB",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  chatComposer: {
    alignItems: "center",
    backgroundColor: "#152943",
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10
  },
  chatReadOnlyNotice: {
    backgroundColor: "#152943",
    borderColor: "rgba(201,169,110,0.28)",
    borderRadius: 14,
    borderWidth: 1,
    gap: 7,
    padding: 14
  },
  chatReadOnlyTitle: {
    color: "#C9A96E",
    fontSize: 13,
    fontWeight: "800"
  },
  chatReadOnlyText: {
    color: "#C4CEDB",
    fontSize: 12.5,
    lineHeight: 18
  },
  chatReadOnlyButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#C9A96E",
    borderRadius: 999,
    marginTop: 3,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  chatReadOnlyButtonText: {
    color: "#071321",
    fontSize: 12,
    fontWeight: "800"
  },
  chatErrorActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10
  },
  chatErrorButton: {
    borderColor: "rgba(152,47,33,0.28)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  chatErrorButtonText: {
    color: "#8E3025",
    fontSize: 12,
    fontWeight: "800"
  },
  chatInput: {
    backgroundColor: "transparent",
    color: "#F0F4F8",
    flex: 1,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: "#C9A96E",
    borderRadius: 999,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  sendButtonDisabled: {
    opacity: 0.5
  },
  sendButtonText: {
    color: "#FBF7EE",
    fontSize: 13,
    fontWeight: "800"
  },
  chatStartOverButton: {
    alignItems: "center",
    paddingVertical: 4
  },
  reflectionList: {
    gap: 14
  },
  reflectionCard: {
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    padding: 16
  },
  reflectionCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 13
  },
  reflectionCardText: {
    flex: 1
  },
  reflectionCardTitle: {
    color: "#2F2B25",
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 22
  },
  reflectionCardMeta: {
    color: "#8A7659",
    fontSize: 13,
    marginTop: 5
  },
  reflectionActions: {
    gap: 10
  },
  emptyReflectionCard: {
    backgroundColor: "#10213A",
    borderColor: "rgba(238,224,201,0.18)",
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18
  },
  notificationList: {
    gap: 12
  },
  notificationCard: {
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 22,
    borderWidth: 1,
    padding: 16
  },
  notificationCardUnread: {
    backgroundColor: "rgba(180,134,63,0.09)",
    borderColor: "rgba(180,134,63,0.28)"
  },
  notificationCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8
  },
  notificationCategory: {
    color: "#B4863F",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  unreadDot: {
    backgroundColor: "#9B3F31",
    borderRadius: 999,
    height: 9,
    width: 9
  },
  notificationTitle: {
    color: "#2F2B25",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21
  },
  notificationBody: {
    color: "#6F6252",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6
  },
  careHeroIcon: {
    color: "#8B6429",
    fontSize: 34,
    fontWeight: "900"
  },
  careFlowPanel: {
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  careFlowStep: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  },
  careStepNumber: {
    alignItems: "center",
    backgroundColor: "#F1E4C8",
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  careStepNumberText: {
    color: "#8B6429",
    fontSize: 12,
    fontWeight: "900"
  },
  careFlowText: {
    color: "#2F2B25",
    flex: 1,
    fontSize: 14,
    fontWeight: "700"
  },
  careActionGrid: {
    gap: 10
  },
  careList: {
    gap: 10
  },
  careCard: {
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 22,
    borderWidth: 1,
    padding: 16
  },
  careCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  careName: {
    color: "#2F2B25",
    fontSize: 16,
    fontWeight: "800"
  },
  careRelationship: {
    color: "#8A7659",
    fontSize: 13,
    marginTop: 4
  },
  careStatusPill: {
    backgroundColor: "rgba(91,99,183,0.10)",
    borderColor: "rgba(91,99,183,0.16)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  careStatusPillActive: {
    backgroundColor: "rgba(47,111,80,0.10)",
    borderColor: "rgba(47,111,80,0.18)"
  },
  careStatusText: {
    color: "#454286",
    fontSize: 11,
    fontWeight: "800"
  },
  careEvent: {
    color: "#6F6252",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12
  },
  planHeroIcon: {
    color: "#8B6429",
    fontSize: 18,
    fontWeight: "900"
  },
  planCardGrid: {
    gap: 12
  },
  planAccessCard: {
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  planAccessCardCurrent: {
    backgroundColor: "rgba(180,134,63,0.09)",
    borderColor: "rgba(180,134,63,0.28)"
  },
  planAccessHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  planAccessName: {
    color: "#2F2B25",
    fontSize: 17,
    fontWeight: "800"
  },
  planAccessPrice: {
    color: "#8A7659",
    fontSize: 13,
    marginTop: 4
  },
  currentPlanPill: {
    backgroundColor: "rgba(47,111,80,0.10)",
    borderColor: "rgba(47,111,80,0.18)",
    borderRadius: 999,
    borderWidth: 1,
    color: "#2F6F50",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  featureList: {
    gap: 6
  },
  featureText: {
    color: "#6F6252",
    fontSize: 13,
    lineHeight: 18
  },
  routeAccessPanel: {
    backgroundColor: "#10213A",
    borderColor: "rgba(238,224,201,0.18)",
    borderRadius: 24,
    borderWidth: 1,
    padding: 16
  },
  routeAccessRow: {
    alignItems: "center",
    borderTopColor: "rgba(238,224,201,0.13)",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingVertical: 12
  },
  routeAccessCopy: {
    flex: 1
  },
  routeAccessTitle: {
    color: "#F9F0E1",
    fontSize: 14,
    fontWeight: "800"
  },
  routeAccessMeta: {
    color: "#CFC6B6",
    fontSize: 12,
    marginTop: 4
  },
  routeAccessStatus: {
    color: "#D2A24F",
    fontSize: 12,
    fontWeight: "800"
  },
  routeAccessStatusOpen: {
    color: "#87C7A3"
  },
  birthPolicyCard: {
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 24,
    borderWidth: 1,
    padding: 16
  },
  birthPolicyText: {
    color: "#2F2B25",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10
  },
  birthPolicyTextZh: {
    color: "#6F6252",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10
  },
  birthPolicyCount: {
    color: "#B4863F",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 12
  },
  profileTopBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  backButton: {
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.14)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 10
  },
  backButtonText: {
    color: "#6D4F23",
    fontSize: 13,
    fontWeight: "800"
  },
  formStepPill: {
    backgroundColor: "rgba(91,99,183,0.10)",
    borderColor: "rgba(91,99,183,0.16)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  formStepText: {
    color: "#454286",
    fontSize: 12,
    fontWeight: "800"
  },
  formHero: {
    alignItems: "center",
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 28,
    borderWidth: 1,
    padding: 24
  },
  formLogo: {
    alignItems: "center",
    backgroundColor: "#F3ECE0",
    borderColor: "rgba(180,134,63,0.18)",
    borderRadius: 58,
    borderWidth: 1,
    height: 112,
    justifyContent: "center",
    marginBottom: 14,
    width: 112
  },
  formTitle: {
    color: "#2F2B25",
    fontSize: 29,
    fontWeight: "700",
    lineHeight: 34,
    marginTop: 6,
    textAlign: "center"
  },
  formIntro: {
    color: "#6F6252",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 10,
    textAlign: "center"
  },
  formPanel: {
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 16
  },
  accountCard: {
    backgroundColor: "#F7F0E3",
    borderColor: "rgba(120,90,40,0.14)",
    borderRadius: 16,
    borderWidth: 1,
    padding: 15
  },
  accountLabel: {
    color: "#8A7659",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  accountEmail: {
    color: "#2F2B25",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 5
  },
  fieldGroup: {
    gap: 7
  },
  fieldLabel: {
    color: "#6D4F23",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  fieldInput: {
    backgroundColor: "#F7F0E3",
    borderColor: "rgba(120,90,40,0.14)",
    borderRadius: 16,
    borderWidth: 1,
    color: "#2F2B25",
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 15,
    paddingVertical: 12
  },
  fieldInputDisabled: {
    opacity: 0.5
  },
  toggleRow: {
    alignItems: "center",
    backgroundColor: "#F7F0E3",
    borderColor: "rgba(120,90,40,0.14)",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14
  },
  toggleRowActive: {
    backgroundColor: "rgba(180,134,63,0.12)",
    borderColor: "rgba(180,134,63,0.30)"
  },
  toggleBox: {
    alignItems: "center",
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.22)",
    borderRadius: 8,
    borderWidth: 1,
    height: 26,
    justifyContent: "center",
    width: 26
  },
  toggleBoxActive: {
    backgroundColor: "#B4863F",
    borderColor: "#B4863F"
  },
  toggleCheck: {
    color: "#FBF7EE",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18
  },
  toggleTextWrap: {
    flex: 1,
    gap: 2
  },
  toggleTitle: {
    color: "#2F2B25",
    fontSize: 14,
    fontWeight: "800"
  },
  toggleBody: {
    color: "#7B6E5F",
    fontSize: 12,
    lineHeight: 17
  },
  errorCard: {
    backgroundColor: "rgba(146,49,36,0.10)",
    borderColor: "rgba(146,49,36,0.24)",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14
  },
  errorText: {
    color: "#923124",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  },
  successCard: {
    backgroundColor: "rgba(52,117,86,0.12)",
    borderColor: "rgba(52,117,86,0.24)",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14
  },
  successTitle: {
    color: "#2F6F50",
    fontSize: 14,
    fontWeight: "800"
  },
  successBody: {
    color: "#3F735A",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5
  },
  noticeCard: {
    backgroundColor: "#10213A",
    borderColor: "rgba(238,224,201,0.18)",
    borderRadius: 20,
    borderWidth: 1,
    padding: 16
  },
  noticeTitle: {
    color: "#F9F0E1",
    fontSize: 15,
    fontWeight: "800"
  },
  noticeBody: {
    color: "#CFC6B6",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6
  },
  fullPrimaryButton: {
    alignItems: "center",
    backgroundColor: "#2F2B25",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 15
  },
  disabledButton: {
    opacity: 0.62
  },
  fullPrimaryButtonText: {
    color: "#FBF7EE",
    fontSize: 15,
    fontWeight: "800"
  },
  secondaryFullButton: {
    alignItems: "center",
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.16)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 15
  },
  secondaryFullButtonText: {
    color: "#2F2B25",
    fontSize: 15,
    fontWeight: "800"
  },
  previewHero: {
    alignItems: "center",
    backgroundColor: "#10213A",
    borderColor: "rgba(238,224,201,0.18)",
    borderRadius: 28,
    borderWidth: 1,
    padding: 24
  },
  previewWheel: {
    alignItems: "center",
    backgroundColor: "#0B1930",
    borderColor: "rgba(238,224,201,0.12)",
    borderRadius: 66,
    borderWidth: 1,
    height: 132,
    justifyContent: "center",
    marginBottom: 14,
    width: 132
  },
  generatingSafe: {
    backgroundColor: "#071321",
    flex: 1
  },
  generatingFrame: {
    alignItems: "center",
    alignSelf: "center",
    flex: 1,
    justifyContent: "center",
    maxWidth: 480,
    paddingHorizontal: 28,
    width: "100%"
  },
  generatingWheel: {
    alignItems: "center",
    backgroundColor: "rgba(11,25,48,0.88)",
    borderColor: "rgba(201,169,110,0.36)",
    borderRadius: 78,
    borderWidth: 1,
    height: 156,
    justifyContent: "center",
    marginBottom: 25,
    width: 156
  },
  generatingEyebrow: {
    color: "#C9A96E",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6
  },
  generatingTitle: {
    color: "#F0F4F8",
    fontFamily: "Georgia",
    fontSize: 28,
    lineHeight: 35,
    marginTop: 12,
    textAlign: "center"
  },
  generatingBody: {
    color: "#AEBAC8",
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 10,
    maxWidth: 340,
    textAlign: "center"
  },
  generatingSteps: {
    alignSelf: "stretch",
    gap: 14,
    marginTop: 30
  },
  generatingStep: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  },
  generatingStepIcon: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 17,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  generatingStepIconActive: {
    backgroundColor: "rgba(139,147,212,0.2)",
    borderColor: "#8B93D4"
  },
  generatingStepIconComplete: {
    backgroundColor: "#C9A96E",
    borderColor: "#C9A96E"
  },
  generatingStepNumber: {
    color: "#71839A",
    fontSize: 11,
    fontWeight: "800"
  },
  generatingStepNumberActive: {
    color: "#F0F4F8"
  },
  generatingStepText: {
    color: "#71839A",
    fontSize: 13
  },
  generatingStepTextActive: {
    color: "#E4EAF0",
    fontWeight: "700"
  },
  generatingPrivacy: {
    color: "#71839A",
    fontSize: 10.5,
    lineHeight: 16,
    marginTop: 28,
    textAlign: "center"
  },
  summaryPanel: {
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden"
  },
  summaryRow: {
    borderTopColor: "rgba(120,90,40,0.12)",
    borderTopWidth: 1,
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  summaryLabel: {
    color: "#8A7659",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  summaryValue: {
    color: "#2F2B25",
    fontSize: 16,
    fontWeight: "700"
  },
  apiCard: {
    backgroundColor: "#10213A",
    borderColor: "rgba(238,224,201,0.18)",
    borderRadius: 20,
    borderWidth: 1,
    padding: 16
  },
  completionCard: {
    backgroundColor: "#10213A",
    borderColor: "rgba(238,224,201,0.18)",
    borderRadius: 20,
    borderWidth: 1,
    padding: 16
  },
  apiLine: {
    color: "#D2A24F",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 8
  },
  apiBody: {
    color: "#CFC6B6",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 5
  },
  ghostButton: {
    alignItems: "center",
    backgroundColor: "rgba(180,134,63,0.11)",
    borderColor: "rgba(180,134,63,0.20)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 15
  },
  ghostButtonText: {
    color: "#6D4F23",
    fontSize: 15,
    fontWeight: "800"
  },
  chartRevealSafe: {
    backgroundColor: "#091525",
    flex: 1
  },
  chartRevealContent: {
    alignSelf: "center",
    gap: 14,
    maxWidth: 480,
    paddingBottom: 38,
    paddingHorizontal: 22,
    width: "100%"
  },
  chartRevealTopBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8
  },
  chartRevealIconButton: {
    alignItems: "center",
    backgroundColor: "rgba(9,21,37,0.52)",
    borderColor: "rgba(247,235,221,0.22)",
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  chartRevealLanguage: {
    alignItems: "center",
    backgroundColor: "rgba(9,21,37,0.52)",
    borderColor: "rgba(247,235,221,0.22)",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    minWidth: 46
  },
  chartRevealLanguageText: {
    color: "#F7EBDD",
    fontSize: 12,
    fontWeight: "800"
  },
  chartRevealEyebrow: {
    color: "#E0B45D",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 8
  },
  chartRevealTitle: {
    color: "#FFF5E8",
    fontSize: 31,
    fontWeight: "800",
    lineHeight: 38
  },
  chartRevealIntro: {
    color: "rgba(247,235,221,0.78)",
    fontSize: 15,
    lineHeight: 23
  },
  chartRevealSectionLabel: {
    color: "rgba(247,235,221,0.68)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginTop: 10
  },
  chartRevealWheelPanel: {
    alignItems: "center",
    backgroundColor: "rgba(8,19,34,0.66)",
    borderColor: "rgba(224,180,93,0.32)",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14
  },
  chartRevealWheelCanvas: {
    aspectRatio: 1,
    maxWidth: 330,
    width: "100%"
  },
  chartRevealPrecision: {
    color: "rgba(247,235,221,0.68)",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    textAlign: "center"
  },
  chartRevealPlacements: {
    flexDirection: "row",
    gap: 8
  },
  bigThreeCard: {
    backgroundColor: "rgba(9,21,37,0.64)",
    borderColor: "rgba(247,235,221,0.18)",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 76,
    padding: 12
  },
  bigThreeLabel: {
    color: "#E0B45D",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  bigThreeValue: {
    color: "#FFF5E8",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
    marginTop: 8
  },
  chartRevealStory: {
    color: "rgba(247,235,221,0.74)",
    fontSize: 14,
    lineHeight: 22,
    paddingVertical: 4
  },
  chartRevealCta: {
    alignItems: "center",
    backgroundColor: "#F2C86F",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 20
  },
  chartRevealCtaText: {
    color: "#132238",
    fontSize: 16,
    fontWeight: "800"
  },
  lumisDarkSafe: {
    backgroundColor: "#071321",
    flex: 1
  },
  chatIconButton: {
    alignItems: "center",
    backgroundColor: "#152943",
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  chatAvatar: {
    alignItems: "center",
    borderRadius: 999,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  chatPresenceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    marginTop: 2
  },
  chatPersonaChip: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(78,100,142,0.4)",
    borderColor: "rgba(206,216,255,0.16)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    marginTop: 3,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  chatChipText: {
    color: "#C4CEDB",
    fontSize: 11,
    fontWeight: "600"
  },
  chatPresenceDot: {
    backgroundColor: "#86C8A6",
    borderRadius: 999,
    height: 5,
    width: 5
  },
  chatContextWheel: {
    alignItems: "center",
    backgroundColor: "rgba(201,169,110,0.12)",
    borderRadius: 12,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  chatDayLabel: {
    alignSelf: "center",
    color: "#71839A",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1
  },
  messageRowLumis: {
    alignItems: "flex-start",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 8,
    maxWidth: "90%",
    marginTop: 8
  },
  messageAvatar: {
    alignItems: "center",
    backgroundColor: "#C9A96E",
    borderRadius: 999,
    height: 26,
    justifyContent: "center",
    marginTop: 2,
    width: 26
  },
  messageTextLumis: {
    color: "#E4EAF0",
    fontSize: 14.5,
    lineHeight: 22
  },
  messageTextUser: {
    color: "#071321",
    fontSize: 14.5,
    lineHeight: 22
  },
  reflectionsShell: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 8
  },
  reflectionsHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingBottom: 18
  },
  reflectionsHeaderCopy: {
    flex: 1
  },
  reflectionsTitle: {
    color: "#F0F4F8",
    fontSize: 21,
    fontWeight: "800"
  },
  reflectionsSubtitle: {
    color: "#8A9BB0",
    fontSize: 12,
    marginTop: 3
  },
  newTopicIconButton: {
    alignItems: "center",
    backgroundColor: "#C9A96E",
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  reflectionsContent: {
    gap: 12,
    paddingBottom: 28
  },
  reflectionsNewTopic: {
    alignItems: "center",
    backgroundColor: "#C9A96E",
    borderRadius: 10,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 18
  },
  reflectionsNewTopicText: {
    color: "#071321",
    fontSize: 14,
    fontWeight: "800"
  },
  reflectionsSearch: {
    alignItems: "center",
    backgroundColor: "#10243D",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 46,
    paddingHorizontal: 14
  },
  reflectionsSearchInput: {
    color: "#F0F4F8",
    flex: 1,
    fontSize: 14,
    minHeight: 44
  },
  reflectionsSectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8
  },
  reflectionsSectionLabel: {
    color: "#C9A96E",
    fontSize: 10,
    fontWeight: "800"
  },
  reflectionsSectionCount: {
    color: "#71839A",
    fontSize: 11,
    fontWeight: "700"
  },
  reflectionThreadCard: {
    alignItems: "center",
    backgroundColor: "#152943",
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 104,
    padding: 14
  },
  reflectionThreadIcon: {
    alignItems: "center",
    backgroundColor: "rgba(139,147,212,0.14)",
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  reflectionThreadCopy: {
    flex: 1
  },
  reflectionThreadTitle: {
    color: "#F0F4F8",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20
  },
  reflectionThreadPreview: {
    color: "#AEBAC8",
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 4
  },
  reflectionThreadMeta: {
    color: "#C9A96E",
    fontSize: 10.5,
    marginTop: 7
  },
  reflectionThreadAction: {
    color: "#D9C18F",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 8
  },
  reflectionThreadStatus: {
    alignItems: "flex-end",
    gap: 7
  },
  reflectionReadOnlyLabel: {
    color: "#AEBAC8",
    fontSize: 8.5,
    fontWeight: "800"
  },
  reflectionsEmpty: {
    alignItems: "center",
    backgroundColor: "#152943",
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 24
  },
  reflectionsEmptyIcon: {
    alignItems: "center",
    backgroundColor: "rgba(201,169,110,0.12)",
    borderRadius: 999,
    height: 52,
    justifyContent: "center",
    marginBottom: 4,
    width: 52
  },
  reflectionsNoResults: {
    alignItems: "center",
    backgroundColor: "rgba(21,41,67,0.68)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    padding: 22
  },
  savedInsightsSection: {
    gap: 10,
    marginTop: 12
  },
  savedInsightsEmpty: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 16
  },
  reflectionsPrimary: {
    alignItems: "center",
    backgroundColor: "#C9A96E",
    borderRadius: 999,
    marginTop: 6,
    paddingHorizontal: 20,
    paddingVertical: 13
  },
  reflectionsPrimaryText: {
    color: "#071321",
    fontSize: 14,
    fontWeight: "800"
  },
  reflectionPrivacyNote: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: 7,
    paddingVertical: 10
  },
  reflectionPrivacyText: {
    color: "#8A9BB0",
    fontSize: 11
  }
});
