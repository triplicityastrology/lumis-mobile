import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { ChartV2, PersonaStyleKey } from "@lumis/shared";

import type { SendChatMessageResult } from "./chat";
import type { BirthProfileForm } from "./profile";

const LOCAL_DEMO_SESSION_KEY = "lumis.localDemoSession.v1";

export type LocalDemoSession = {
  profileData: BirthProfileForm;
  chartProfile: ChartV2;
  personaStyle: PersonaStyleKey;
  buddyName?: string;
  buddyAvatarKey?: string;
  mainFocus?: string | null;
  chatTurns?: LocalDemoChatTurn[];
  remainingCredits?: number;
  updatedAt: string;
};

export type LocalDemoChatTurn = {
  id: string;
  clientMessageId?: string;
  userMessage: string;
  result: SendChatMessageResult | null;
  error: string;
};

export async function loadLocalDemoSession(): Promise<LocalDemoSession | null> {
  const rawSession = await readLocalDemoSession();

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as LocalDemoSession;
  } catch {
    await clearLocalDemoSession();
    return null;
  }
}

export async function saveLocalDemoSession(session: Omit<LocalDemoSession, "updatedAt">): Promise<void> {
  await writeLocalDemoSession(
    JSON.stringify({
      ...session,
      updatedAt: new Date().toISOString()
    })
  );
}

export async function clearLocalDemoSession(): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(LOCAL_DEMO_SESSION_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(LOCAL_DEMO_SESSION_KEY);
}

async function readLocalDemoSession(): Promise<string | null> {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(LOCAL_DEMO_SESSION_KEY) ?? null;
  }

  return SecureStore.getItemAsync(LOCAL_DEMO_SESSION_KEY);
}

async function writeLocalDemoSession(value: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(LOCAL_DEMO_SESSION_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(LOCAL_DEMO_SESSION_KEY, value);
}
