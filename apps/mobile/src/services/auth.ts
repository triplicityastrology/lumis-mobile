import type { User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { Platform } from "react-native";

import { getSupabaseClient, getSupabaseConfig } from "./supabase";

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
      const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);

      if (error || !data.session?.user) {
        throw new Error(formatRedirectError(error?.message));
      }

      cleanBrowserAuthUrl();
      return successfulRedirect(data.session.user);
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
      const { data, error } = await setNativeSessionWithResumeRetry(
        () =>
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          }),
        Platform.OS !== "web"
      );

      if (error || !data.session?.user) {
        throw new Error(formatRedirectError(error?.message));
      }

      cleanBrowserAuthUrl();
      return successfulRedirect(data.session.user);
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

async function setNativeSessionWithResumeRetry<T>(
  exchange: () => Promise<T>,
  canRetry: boolean
): Promise<T> {
  try {
    return await exchange();
  } catch (error) {
    if (!canRetry || !isNetworkFailure(error)) {
      throw error;
    }

    // iOS can dispatch the deep link before networking has fully resumed.
    await new Promise((resolve) => setTimeout(resolve, 750));
    return exchange();
  }
}

function formatRedirectError(_message?: string): string {
  return "That sign-in link is invalid or expired. Request a new secure link.";
}

function formatRedirectExchangeError(error: unknown): string {
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
  return /network request failed|failed to fetch|networkerror|load failed|fetch/i.test(message);
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
    throw new Error(error.message);
  }

  return { isConfigured: true, user: null };
}
