import {
  isAppLanguagePreference,
  type AppLanguagePreference,
} from "../../../../packages/shared/src/config/app-language";

export const APP_LANGUAGE_PREFERENCE_SERVICE_VERSION =
  "app_language_preference_service_v1" as const;

export type AppLanguagePreferenceServiceCode =
  | "LANGUAGE_PREFERENCE_SAVED"
  | "LANGUAGE_PREFERENCE_INVALID"
  | "LANGUAGE_PREFERENCE_OFFLINE"
  | "LANGUAGE_PREFERENCE_AUTH_REQUIRED"
  | "LANGUAGE_PREFERENCE_MIGRATION_UNAVAILABLE"
  | "LANGUAGE_PREFERENCE_SAVE_FAILED";

export type AppLanguagePreferenceRpcResult =
  | { ok: true; language: AppLanguagePreference }
  | {
      ok: false;
      code:
        | "offline"
        | "unauthenticated"
        | "migration_unavailable"
        | "unknown";
    };

export type AppLanguagePreferenceUpdatePort = Readonly<{
  isOnline: () => boolean;
  isAuthenticated: () => boolean;
  updateAppLanguagePreference: (
    language: AppLanguagePreference
  ) => Promise<AppLanguagePreferenceRpcResult>;
}>;

export type AppLanguagePreferenceServiceResult =
  | {
      ok: true;
      code: "LANGUAGE_PREFERENCE_SAVED";
      language: AppLanguagePreference;
      announcement: string;
      retryable: false;
    }
  | {
      ok: false;
      code: Exclude<
        AppLanguagePreferenceServiceCode,
        "LANGUAGE_PREFERENCE_SAVED"
      >;
      announcement: string;
      retryable: boolean;
    };

export type AppLanguagePreferenceService = Readonly<{
  version: typeof APP_LANGUAGE_PREFERENCE_SERVICE_VERSION;
  savePreference: (input: unknown) => Promise<AppLanguagePreferenceServiceResult>;
}>;

const ANNOUNCEMENTS: Readonly<
  Record<
    AppLanguagePreferenceServiceCode,
    Readonly<Record<AppLanguagePreference, string>>
  >
> = {
  LANGUAGE_PREFERENCE_SAVED: {
    en: "Language saved.",
    "zh-Hant": "語言已儲存。",
  },
  LANGUAGE_PREFERENCE_INVALID: {
    en: "Choose a supported language.",
    "zh-Hant": "請選擇支援的語言。",
  },
  LANGUAGE_PREFERENCE_OFFLINE: {
    en: "You are offline. Your language was not saved.",
    "zh-Hant": "目前離線，語言尚未儲存。",
  },
  LANGUAGE_PREFERENCE_AUTH_REQUIRED: {
    en: "Sign in before saving your language.",
    "zh-Hant": "請先登入，再儲存語言。",
  },
  LANGUAGE_PREFERENCE_MIGRATION_UNAVAILABLE: {
    en: "Language saving is not available in this build.",
    "zh-Hant": "此版本暫不支援儲存語言。",
  },
  LANGUAGE_PREFERENCE_SAVE_FAILED: {
    en: "Your language was not saved. Try again.",
    "zh-Hant": "語言尚未儲存，請再試一次。",
  },
};

export function createInactiveAppLanguagePreferenceService(
  port: AppLanguagePreferenceUpdatePort
): AppLanguagePreferenceService {
  return {
    version: APP_LANGUAGE_PREFERENCE_SERVICE_VERSION,
    async savePreference(
      input: unknown
    ): Promise<AppLanguagePreferenceServiceResult> {
      if (!isAppLanguagePreference(input)) {
        return failure(
          "LANGUAGE_PREFERENCE_INVALID",
          "en",
          false
        );
      }
      if (!port.isOnline()) {
        return failure("LANGUAGE_PREFERENCE_OFFLINE", input, true);
      }
      if (!port.isAuthenticated()) {
        return failure(
          "LANGUAGE_PREFERENCE_AUTH_REQUIRED",
          input,
          false
        );
      }

      let result: AppLanguagePreferenceRpcResult;
      try {
        result = await port.updateAppLanguagePreference(input);
      } catch {
        return failure(
          "LANGUAGE_PREFERENCE_SAVE_FAILED",
          input,
          true
        );
      }

      if (result.ok) {
        if (result.language !== input) {
          return failure(
            "LANGUAGE_PREFERENCE_SAVE_FAILED",
            input,
            true
          );
        }
        return {
          ok: true,
          code: "LANGUAGE_PREFERENCE_SAVED",
          language: result.language,
          announcement:
            ANNOUNCEMENTS.LANGUAGE_PREFERENCE_SAVED[result.language],
          retryable: false,
        };
      }

      switch (result.code) {
        case "offline":
          return failure("LANGUAGE_PREFERENCE_OFFLINE", input, true);
        case "unauthenticated":
          return failure(
            "LANGUAGE_PREFERENCE_AUTH_REQUIRED",
            input,
            false
          );
        case "migration_unavailable":
          return failure(
            "LANGUAGE_PREFERENCE_MIGRATION_UNAVAILABLE",
            input,
            true
          );
        case "unknown":
          return failure(
            "LANGUAGE_PREFERENCE_SAVE_FAILED",
            input,
            true
          );
      }
    },
  };
}

function failure(
  code: Exclude<
    AppLanguagePreferenceServiceCode,
    "LANGUAGE_PREFERENCE_SAVED"
  >,
  language: AppLanguagePreference,
  retryable: boolean
): AppLanguagePreferenceServiceResult {
  return {
    ok: false,
    code,
    announcement: ANNOUNCEMENTS[code][language],
    retryable,
  };
}
