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
    email: cleanedEmail
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
