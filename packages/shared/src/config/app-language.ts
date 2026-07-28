export const APP_LANGUAGE_PREFERENCES = ["en", "zh-Hant"] as const;

export type AppLanguagePreference = (typeof APP_LANGUAGE_PREFERENCES)[number];

export function isAppLanguagePreference(value: unknown): value is AppLanguagePreference {
  return APP_LANGUAGE_PREFERENCES.includes(value as AppLanguagePreference);
}

export function detectRequestLanguage(message: string): AppLanguagePreference {
  return /[\u3400-\u4dbf\u4e00-\u9fff]/u.test(message) ? "zh-Hant" : "en";
}

export function resolveFixedTemplateLanguage(
  preference: AppLanguagePreference | null | undefined,
  message: string
): AppLanguagePreference {
  return isAppLanguagePreference(preference) ? preference : detectRequestLanguage(message);
}
