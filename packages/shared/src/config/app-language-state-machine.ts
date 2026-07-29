import {
  detectRequestLanguage,
  isAppLanguagePreference,
  type AppLanguagePreference,
} from "./app-language";

export const APP_LANGUAGE_STATE_MACHINE_VERSION =
  "app_language_state_machine_v1" as const;

export type LanguageSelectionOrigin = "first_launch" | "profile_settings";

export type LanguagePersistenceStatus =
  | "not_requested"
  | "loading_saved"
  | "local_provisional"
  | "saving"
  | "server_saved"
  | "save_failed"
  | "offline"
  | "migration_unavailable";

export type LanguageJourneyPhase =
  | "first_launch_required"
  | "ready"
  | "loading_saved_preference"
  | "saving_preference"
  | "save_failed"
  | "offline";

export type LanguageAccountBoundary = Readonly<{
  authentication: "signed_out" | "signed_in";
  chart: "none" | "valid";
  onboarding: "not_started" | "in_progress" | "completed";
}>;

export type LanguageAccessibilityAnnouncement =
  | "language_selection_required"
  | "language_selected"
  | "saved_language_loading"
  | "language_saving"
  | "language_saved"
  | "language_save_failed"
  | "language_offline"
  | "language_migration_unavailable"
  | null;

export type AppLanguageJourneyState = Readonly<{
  version: typeof APP_LANGUAGE_STATE_MACHINE_VERSION;
  phase: LanguageJourneyPhase;
  origin: LanguageSelectionOrigin;
  savedPreference: AppLanguagePreference | null;
  localPreference: AppLanguagePreference | null;
  pendingPreference: AppLanguagePreference | null;
  persistence: LanguagePersistenceStatus;
  announcement: LanguageAccessibilityAnnouncement;
  accountBoundary: LanguageAccountBoundary;
}>;

export type AppLanguageJourneyEvent =
  | {
      type: "SELECT_FIRST_LAUNCH_LANGUAGE";
      language: AppLanguagePreference;
    }
  | { type: "LOAD_SAVED_PREFERENCE_STARTED" }
  | {
      type: "LOAD_SAVED_PREFERENCE_SUCCEEDED";
      language: AppLanguagePreference | null;
    }
  | {
      type: "LOAD_SAVED_PREFERENCE_FAILED";
      reason: "offline" | "migration_unavailable" | "temporary";
    }
  | {
      type: "SELECT_PROFILE_LANGUAGE";
      language: AppLanguagePreference;
    }
  | { type: "SAVE_PREFERENCE_STARTED" }
  | {
      type: "SAVE_PREFERENCE_SUCCEEDED";
      language: AppLanguagePreference;
    }
  | {
      type: "SAVE_PREFERENCE_FAILED";
      reason: "offline" | "migration_unavailable" | "temporary";
    }
  | { type: "NETWORK_BECAME_OFFLINE" }
  | { type: "NETWORK_BECAME_AVAILABLE" };

export const LANGUAGE_OPTION_ACCESSIBILITY: Readonly<
  Record<
    AppLanguagePreference,
    Readonly<{
      label: string;
      hint: string;
      role: "radio";
    }>
  >
> = {
  en: {
    label: "English",
    hint: "Use English in Lumis.",
    role: "radio",
  },
  "zh-Hant": {
    label: "繁體中文",
    hint: "在 Lumis 使用繁體中文。",
    role: "radio",
  },
};

export const LANGUAGE_ANNOUNCEMENT_COPY: Readonly<
  Record<
    Exclude<LanguageAccessibilityAnnouncement, null>,
    Readonly<Record<AppLanguagePreference, string>>
  >
> = {
  language_selection_required: {
    en: "Choose your app language.",
    "zh-Hant": "請選擇應用程式語言。",
  },
  language_selected: {
    en: "Language selected.",
    "zh-Hant": "已選擇語言。",
  },
  saved_language_loading: {
    en: "Loading your saved language.",
    "zh-Hant": "正在載入已儲存的語言。",
  },
  language_saving: {
    en: "Saving your language.",
    "zh-Hant": "正在儲存語言。",
  },
  language_saved: {
    en: "Language saved.",
    "zh-Hant": "語言已儲存。",
  },
  language_save_failed: {
    en: "Your language was not saved. Try again.",
    "zh-Hant": "語言尚未儲存，請再試一次。",
  },
  language_offline: {
    en: "You are offline. Your language was not saved.",
    "zh-Hant": "目前離線，語言尚未儲存。",
  },
  language_migration_unavailable: {
    en: "Language saving is not available in this build.",
    "zh-Hant": "此版本暫不支援儲存語言。",
  },
};

export function createAppLanguageJourneyState(input: {
  accountBoundary: LanguageAccountBoundary;
  firstLaunchComplete: boolean;
  localPreference?: AppLanguagePreference | null;
  savedPreference?: AppLanguagePreference | null;
  origin?: LanguageSelectionOrigin;
}): AppLanguageJourneyState {
  const localPreference = validPreferenceOrNull(input.localPreference);
  const savedPreference = validPreferenceOrNull(input.savedPreference);
  const firstLaunchRequired =
    !input.firstLaunchComplete && !localPreference && !savedPreference;

  return {
    version: APP_LANGUAGE_STATE_MACHINE_VERSION,
    phase: firstLaunchRequired ? "first_launch_required" : "ready",
    origin: input.origin ?? "first_launch",
    savedPreference,
    localPreference,
    pendingPreference: null,
    persistence: savedPreference
      ? "server_saved"
      : localPreference
        ? "local_provisional"
        : "not_requested",
    announcement: firstLaunchRequired
      ? "language_selection_required"
      : null,
    accountBoundary: input.accountBoundary,
  };
}

export function reduceAppLanguageJourney(
  state: AppLanguageJourneyState,
  event: AppLanguageJourneyEvent
): AppLanguageJourneyState {
  switch (event.type) {
    case "SELECT_FIRST_LAUNCH_LANGUAGE": {
      if (!isAppLanguagePreference(event.language)) {
        return state;
      }
      return preserveAccountBoundary(state, {
        ...state,
        phase: "ready",
        origin: "first_launch",
        localPreference: event.language,
        pendingPreference: state.savedPreference ? null : event.language,
        persistence: state.savedPreference
          ? "server_saved"
          : "local_provisional",
        announcement: "language_selected",
      });
    }
    case "LOAD_SAVED_PREFERENCE_STARTED":
      return preserveAccountBoundary(state, {
        ...state,
        phase: "loading_saved_preference",
        persistence: "loading_saved",
        announcement: "saved_language_loading",
      });
    case "LOAD_SAVED_PREFERENCE_SUCCEEDED": {
      const savedPreference = validPreferenceOrNull(event.language);
      return preserveAccountBoundary(state, {
        ...state,
        phase: "ready",
        savedPreference,
        pendingPreference: savedPreference ? null : state.pendingPreference,
        persistence: savedPreference
          ? "server_saved"
          : state.localPreference
            ? "local_provisional"
            : "not_requested",
        announcement: savedPreference ? "language_saved" : null,
      });
    }
    case "LOAD_SAVED_PREFERENCE_FAILED":
      return failedState(state, event.reason);
    case "SELECT_PROFILE_LANGUAGE": {
      if (!isAppLanguagePreference(event.language)) {
        return state;
      }
      return preserveAccountBoundary(state, {
        ...state,
        phase: "ready",
        origin: "profile_settings",
        pendingPreference: event.language,
        persistence: state.savedPreference
          ? "server_saved"
          : state.localPreference
            ? "local_provisional"
            : "not_requested",
        announcement: "language_selected",
      });
    }
    case "SAVE_PREFERENCE_STARTED":
      if (!state.pendingPreference) {
        return state;
      }
      return preserveAccountBoundary(state, {
        ...state,
        phase: "saving_preference",
        persistence: "saving",
        announcement: "language_saving",
      });
    case "SAVE_PREFERENCE_SUCCEEDED": {
      if (
        !state.pendingPreference ||
        !isAppLanguagePreference(event.language) ||
        event.language !== state.pendingPreference
      ) {
        return state;
      }
      return preserveAccountBoundary(state, {
        ...state,
        phase: "ready",
        savedPreference: event.language,
        localPreference: event.language,
        pendingPreference: null,
        persistence: "server_saved",
        announcement: "language_saved",
      });
    }
    case "SAVE_PREFERENCE_FAILED":
      return failedState(state, event.reason);
    case "NETWORK_BECAME_OFFLINE":
      return preserveAccountBoundary(state, {
        ...state,
        phase: "offline",
        persistence: "offline",
        announcement: "language_offline",
      });
    case "NETWORK_BECAME_AVAILABLE":
      return preserveAccountBoundary(state, {
        ...state,
        phase: "ready",
        persistence: state.savedPreference
          ? "server_saved"
          : state.localPreference
            ? "local_provisional"
            : "not_requested",
        announcement: null,
      });
  }
}

export function resolveJourneyUiLanguage(
  state: AppLanguageJourneyState
): AppLanguagePreference | null {
  return state.savedPreference ?? state.localPreference;
}

export function resolveJourneyFixedTemplateLanguage(
  state: AppLanguageJourneyState,
  requestText: string
): AppLanguagePreference {
  return state.savedPreference ?? detectRequestLanguage(requestText);
}

export function languageAnnouncementForState(
  state: AppLanguageJourneyState
): string | null {
  if (!state.announcement) {
    return null;
  }
  const language =
    resolveJourneyUiLanguage(state) ??
    state.pendingPreference ??
    "en";
  return LANGUAGE_ANNOUNCEMENT_COPY[state.announcement][language];
}

function failedState(
  state: AppLanguageJourneyState,
  reason: "offline" | "migration_unavailable" | "temporary"
): AppLanguageJourneyState {
  return preserveAccountBoundary(state, {
    ...state,
    phase: reason === "offline" ? "offline" : "save_failed",
    persistence:
      reason === "offline"
        ? "offline"
        : reason === "migration_unavailable"
          ? "migration_unavailable"
          : "save_failed",
    announcement:
      reason === "offline"
        ? "language_offline"
        : reason === "migration_unavailable"
          ? "language_migration_unavailable"
          : "language_save_failed",
  });
}

function preserveAccountBoundary(
  previous: AppLanguageJourneyState,
  next: AppLanguageJourneyState
): AppLanguageJourneyState {
  return {
    ...next,
    accountBoundary: previous.accountBoundary,
  };
}

function validPreferenceOrNull(
  value: AppLanguagePreference | null | undefined
): AppLanguagePreference | null {
  return isAppLanguagePreference(value) ? value : null;
}
