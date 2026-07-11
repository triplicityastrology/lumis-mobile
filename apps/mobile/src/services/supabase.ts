import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export type SupabaseRuntimeConfig = {
  isConfigured: boolean;
  url?: string;
  anonKey?: string;
};

export function getSupabaseConfig(): SupabaseRuntimeConfig {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { isConfigured: false };
  }

  return { isConfigured: true, url, anonKey };
}

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();

  if (!config.isConfigured || !config.url || !config.anonKey) {
    return null;
  }

  cachedClient ??= createClient(config.url, config.anonKey);
  return cachedClient;
}
