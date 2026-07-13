import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

let cachedClient: SupabaseClient | null = null;

export type SupabaseRuntimeConfig = {
  isConfigured: boolean;
  url?: string;
  anonKey?: string;
};

export function getSupabaseConfig(): SupabaseRuntimeConfig {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

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

  cachedClient ??= createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === "web",
      persistSession: true,
      storage: createAuthStorage()
    }
  });
  return cachedClient;
}

function createAuthStorage() {
  if (Platform.OS === "web") {
    return {
      getItem: (key: string) => Promise.resolve(globalThis.localStorage?.getItem(key) ?? null),
      removeItem: (key: string) => {
        globalThis.localStorage?.removeItem(key);
        return Promise.resolve();
      },
      setItem: (key: string, value: string) => {
        globalThis.localStorage?.setItem(key, value);
        return Promise.resolve();
      }
    };
  }

  return {
    getItem: (key: string) => SecureStore.getItemAsync(key),
    removeItem: (key: string) => SecureStore.deleteItemAsync(key),
    setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value)
  };
}
