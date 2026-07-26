import type { SupabaseClient, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { Platform } from "react-native";

import {
  getSupabaseClient,
  getSupabaseConfig,
  probeSupabaseAuthConnection
} from "./supabase";

export type AuthStatus =
  | {
      isConfigured: false;
      user: null;
    }
  | {
      isConfigured: true;
      user: User | null;
    };

export type MagicLinkResult =
  | {
      mode: "local";
      status: "skipped";
      message: string;
    }
  | {
      mode: "supabase";
      status: "sent";
      message: string;
    };

export type AuthRedirectResult = {
  handled: boolean;
  message?: string;
  status?: AuthStatus;
};

export async function getAuthStatus(): Promise<AuthStatus> {
  const config = getSupabaseConfig();

  if (!config.isConfigured) {
    return { isConfigured: false, user: null };
  }

  const supabase = getSupabaseClient();

  if (!supabase) {
    return { isConfigured: false, user: null };
  }

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error(formatSessionNetworkError(error));
  }

  return {
    isConfigured: true,
    user: data.user
  };
}

export async function handleAuthRedirectFromUrl(url?: string | null): Promise<AuthRedirectResult> {
  const redirectUrl = url ?? getBrowserUrl();

  if (!redirectUrl) {
    return { handled: false };
  }

  const supabase = getSupabaseClient();

  if (!supabase) {
    return { handled: false };
  }

  let currentUrl: URL;

  try {
    currentUrl = new URL(redirectUrl);
  } catch {
    throw new Error("That sign-in link is invalid. Request a new secure link.");
  }

  if (!isLumisAuthCallback(currentUrl)) {
    return { handled: false };
  }

  const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ""));
  const authError =
    currentUrl.searchParams.get("error_description") ??
    hashParams.get("error_description") ??
    currentUrl.searchParams.get("error") ??
    hashParams.get("error");

  if (authError) {
    throw new Error(formatRedirectError(authError));
  }

  const authCode = currentUrl.searchParams.get("code");

  if (authCode) {
    try {
      await prepareNativeAuthExchange();
      const user = await exchangeCodeOnce(supabase, authCode);

      cleanBrowserAuthUrl();
      return successfulRedirect(user);
    } catch (error) {
      throw new Error(formatRedirectExchangeError(error));
    }
  }

  const accessToken =
    currentUrl.searchParams.get("access_token") ?? hashParams.get("access_token");
  const refreshToken =
    currentUrl.searchParams.get("refresh_token") ?? hashParams.get("refresh_token");

  if (accessToken && refreshToken) {
    try {
      await prepareNativeAuthExchange();
      const user = await setTokenSessionOnce(supabase, accessToken, refreshToken);

      cleanBrowserAuthUrl();
      return successfulRedirect(user);
    } catch (error) {
      throw new Error(formatRedirectExchangeError(error));
    }
  }

  return { handled: false };
}

export async function sendMagicLink(email: string): Promise<MagicLinkResult> {
  const cleanedEmail = email.trim().toLowerCase();
  const supabase = getSupabaseClient();

  if (!supabase) {
    return {
      mode: "local",
      status: "skipped",
      message: "Secure sign-in is not available in this build. You can continue without saving."
    };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: cleanedEmail,
    options: {
      emailRedirectTo: getEmailRedirectTo()
    }
  });

  if (error) {
    throw new Error(formatAuthErrorMessage(error.message));
  }

  return {
    mode: "supabase",
    status: "sent",
    message: `Magic link sent to ${cleanedEmail}.`
  };
}

export function getEmailRedirectTo(): string {
  const redirectUrl = Linking.createURL("auth/callback");

  if (Platform.OS !== "web" && isLocalhostUrl(redirectUrl)) {
    throw new Error("Secure mobile sign-in is not configured for this build.");
  }

  return redirectUrl;
}

function formatAuthErrorMessage(message: string): string {
  if (isNetworkFailure(message)) {
    return "Lumis could not send a secure sign-in link because the connection was interrupted. Check your connection and try again.";
  }

  if (/rate limit/i.test(message)) {
    return "Too many sign-in emails were requested. Please wait about 1 hour before trying again.";
  }

  return message;
}

function getBrowserUrl(): string | null {
  if (typeof globalThis.location === "undefined") {
    return null;
  }

  return globalThis.location.href;
}

function isLumisAuthCallback(url: URL): boolean {
  const callbackPath = `${url.hostname}${url.pathname}`.replace(/\/+/g, "/");
  return callbackPath.endsWith("auth/callback");
}

function isLocalhostUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  } catch {
    return true;
  }
}

function successfulRedirect(user: User): AuthRedirectResult {
  return {
    handled: true,
    message: "Email confirmed. Lumis account is ready.",
    status: {
      isConfigured: true,
      user
    }
  };
}

type RedirectFailureKind = "invalid_link" | "network_interrupted" | "session_restore_failed";

class AuthRedirectFailure extends Error {
  constructor(readonly kind: RedirectFailureKind) {
    super(kind);
    this.name = "AuthRedirectFailure";
  }
}

async function prepareNativeAuthExchange(): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }

  if (await probeSupabaseAuthConnection()) {
    return;
  }

  // A deep link can foreground iOS before its network route is ready. Probe the
  // harmless Auth health endpoint once more; the one-time credential is untouched.
  await new Promise((resolve) => setTimeout(resolve, 750));

  if (!(await probeSupabaseAuthConnection())) {
    throw new AuthRedirectFailure("network_interrupted");
  }
}

async function exchangeCodeOnce(
  supabase: SupabaseClient,
  authCode: string
): Promise<User> {
  const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);

  if (error) {
    if (!isNetworkFailure(error)) {
      throw new AuthRedirectFailure("invalid_link");
    }

    const persistedUser = await readPersistedSessionUser(supabase);
    if (persistedUser) {
      return persistedUser;
    }

    // A fetch failure is ambiguous: the server may have consumed the code.
    // Never exchange that one-time code again.
    throw new AuthRedirectFailure("network_interrupted");
  }

  if (data.session?.user) {
    return data.session.user;
  }

  const persistedUser = await readPersistedSessionUser(supabase);
  if (persistedUser) {
    return persistedUser;
  }

  throw new AuthRedirectFailure("session_restore_failed");
}

async function setTokenSessionOnce(
  supabase: SupabaseClient,
  accessToken: string,
  refreshToken: string
): Promise<User> {
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  if (error) {
    if (!isNetworkFailure(error)) {
      throw new AuthRedirectFailure("invalid_link");
    }

    const persistedUser = await readPersistedSessionUser(supabase);
    if (persistedUser) {
      return persistedUser;
    }

    throw new AuthRedirectFailure("network_interrupted");
  }

  if (data.session?.user) {
    return data.session.user;
  }

  const persistedUser = await readPersistedSessionUser(supabase);
  if (persistedUser) {
    return persistedUser;
  }

  throw new AuthRedirectFailure("session_restore_failed");
}

async function readPersistedSessionUser(supabase: SupabaseClient): Promise<User | null> {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw new AuthRedirectFailure("session_restore_failed");
    }

    return data.session?.user ?? null;
  } catch (error) {
    if (error instanceof AuthRedirectFailure) {
      throw error;
    }

    throw new AuthRedirectFailure("session_restore_failed");
  }
}

function formatRedirectError(_message?: string): string {
  return "That sign-in link is invalid or expired. Request a new secure link.";
}

function formatRedirectExchangeError(error: unknown): string {
  if (error instanceof AuthRedirectFailure) {
    if (error.kind === "network_interrupted") {
      return "Lumis could not finish secure sign-in because the connection was interrupted. Check your connection and request a new sign-in link.";
    }

    if (error.kind === "session_restore_failed") {
      return "Lumis could not verify the secure session after sign-in. Close and reopen Lumis, then request a new link if needed.";
    }

    return formatRedirectError();
  }

  if (isNetworkFailure(error)) {
    return "Lumis could not finish secure sign-in because the connection was interrupted. Check your connection and request a new sign-in link.";
  }

  return formatRedirectError();
}

function formatSessionNetworkError(error: unknown): string {
  if (isNetworkFailure(error)) {
    return "Lumis could not securely check your account. Check your connection and try again.";
  }

  return "Lumis could not securely check your account. Please try again.";
}

function isNetworkFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /AUTH_NETWORK_INTERRUPTED|network request failed|failed to fetch|networkerror|load failed|fetch/i.test(message);
}

function cleanBrowserAuthUrl() {
  if (Platform.OS !== "web") {
    return;
  }

  if (typeof globalThis.location === "undefined" || typeof globalThis.history === "undefined") {
    return;
  }

  globalThis.history.replaceState(
    null,
    "",
    `${globalThis.location.origin}${globalThis.location.pathname}`
  );
}

export async function signOut(): Promise<AuthStatus> {
  const config = getSupabaseConfig();
  const supabase = getSupabaseClient();

  if (!config.isConfigured || !supabase) {
    return { isConfigured: false, user: null };
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(formatSessionNetworkError(error));
  }

  return { isConfigured: true, user: null };
}
