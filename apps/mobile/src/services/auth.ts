import type { User } from "@supabase/supabase-js";

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

  const { data } = await supabase.auth.getUser();

  return {
    isConfigured: true,
    user: data.user
  };
}

export async function handleAuthRedirectFromUrl(): Promise<AuthRedirectResult> {
  if (typeof globalThis.location === "undefined") {
    return { handled: false };
  }

  const supabase = getSupabaseClient();

  if (!supabase) {
    return { handled: false };
  }

  const currentUrl = new URL(globalThis.location.href);
  const authCode = currentUrl.searchParams.get("code");

  if (authCode) {
    const { error } = await supabase.auth.exchangeCodeForSession(authCode);

    if (error) {
      throw new Error(error.message);
    }

    cleanAuthUrl();
    return {
      handled: true,
      message: "Email confirmed. Lumis account is ready."
    };
  }

  const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ""));
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (error) {
      throw new Error(error.message);
    }

    cleanAuthUrl();
    return {
      handled: true,
      message: "Email confirmed. Lumis account is ready."
    };
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
      message: "Supabase is not connected yet. You can continue in local demo mode."
    };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: cleanedEmail,
    options: {
      emailRedirectTo: getEmailRedirectTo()
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    mode: "supabase",
    status: "sent",
    message: `Magic link sent to ${cleanedEmail}.`
  };
}

function getEmailRedirectTo(): string | undefined {
  if (typeof globalThis.location === "undefined") {
    return undefined;
  }

  return globalThis.location.origin;
}

function cleanAuthUrl() {
  if (typeof globalThis.location === "undefined" || typeof globalThis.history === "undefined") {
    return;
  }

  globalThis.history.replaceState(
    null,
    "",
    `${globalThis.location.origin}${globalThis.location.pathname}`
  );
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return;
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}
