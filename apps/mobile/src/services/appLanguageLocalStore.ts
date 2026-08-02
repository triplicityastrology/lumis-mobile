import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { isAppLanguagePreference, type AppLanguagePreference } from "@lumis/shared";

/**
 * Local (device-only) persistence for the chosen app language, using the same
 * approved expo-secure-store mechanism as the local session store. This is what
 * makes the AUTH-013 first-launch gate genuinely one-time: a saved choice is read
 * on the next cold start, so the selector does not reappear.
 *
 * This is strictly LOCAL persistence. It never touches the (inactive) language
 * RPC and makes no claim of remote/account persistence.
 */
const LOCAL_APP_LANGUAGE_KEY = "lumis.localAppLanguage.v1";

export async function loadLocalAppLanguage(): Promise<AppLanguagePreference | null> {
  const raw =
    Platform.OS === "web"
      ? globalThis.localStorage?.getItem(LOCAL_APP_LANGUAGE_KEY) ?? null
      : await SecureStore.getItemAsync(LOCAL_APP_LANGUAGE_KEY);
  return raw && isAppLanguagePreference(raw) ? raw : null;
}

export async function saveLocalAppLanguage(language: AppLanguagePreference): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(LOCAL_APP_LANGUAGE_KEY, language);
    return;
  }
  await SecureStore.setItemAsync(LOCAL_APP_LANGUAGE_KEY, language);
}

export async function clearLocalAppLanguage(): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(LOCAL_APP_LANGUAGE_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(LOCAL_APP_LANGUAGE_KEY);
}
