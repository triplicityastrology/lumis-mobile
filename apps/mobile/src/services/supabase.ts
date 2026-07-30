import { createClient, processLock, type SupabaseClient } from "@supabase/supabase-js";
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
      flowType: "pkce",
      lock: processLock,
      persistSession: true,
      storage: createAuthStorage()
    },
    global: {
      fetch: authSafeFetch
    }
  });
  return cachedClient;
}

export async function probeSupabaseAuthConnection(): Promise<boolean> {
  const config = getSupabaseConfig();

  if (!config.isConfigured || !config.url || !config.anonKey) {
    return false;
  }

  const response = await authSafeFetch(`${config.url}/auth/v1/health`, {
    headers: {
      apikey: config.anonKey
    },
    method: "GET"
  });

  return response.status < 500;
}

const authSafeFetch: typeof globalThis.fetch = async (input, init) => {
  try {
    const fetchInput = input instanceof URL ? input.toString() : input;
    return await globalThis.fetch(fetchInput, init);
  } catch (error) {
    if (!isConfiguredSupabaseAuthRequest(input) || !isTransportFailure(error)) {
      throw error;
    }

    // Supabase Auth logs a thrown fetch error before returning control to us.
    // A safe HTTP response keeps native transport details out of LogBox while
    // preserving a truthful, classifiable authentication failure.
    return new Response(JSON.stringify({ message: "AUTH_NETWORK_INTERRUPTED" }), {
      headers: { "Content-Type": "application/json" },
      status: 503
    });
  }
};

function isConfiguredSupabaseAuthRequest(
  input: Parameters<typeof globalThis.fetch>[0]
): boolean {
  const config = getSupabaseConfig();

  if (!config.isConfigured || !config.url) {
    return false;
  }

  try {
    const configuredOrigin = new URL(config.url).origin;
    const inputValue =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const requestUrl = new URL(inputValue);

    return (
      requestUrl.origin === configuredOrigin &&
      (requestUrl.pathname === "/auth/v1" ||
        requestUrl.pathname.startsWith("/auth/v1/"))
    );
  } catch {
    return false;
  }
}

function isTransportFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /network request failed|failed to fetch|networkerror|load failed|fetch/i.test(message);
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
