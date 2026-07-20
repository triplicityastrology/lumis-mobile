import { getSupabaseClient } from "./supabase";

/**
 * dice_throws persistence (migration 0019). Degrades to local mode when
 * Supabase isn't configured (demo sessions): throws simply aren't persisted.
 */

export type DiceThrowRecord = {
  id: string;
  question: string | null;
  planetKey: string;
  signKey: string;
  houseKey: string;
  source: "dice_tab" | "chat";
  createdAt: string;
};

export type SaveDiceThrowInput = {
  question: string | null;
  planetKey: string;
  signKey: string;
  houseKey: string;
  source?: "dice_tab" | "chat";
};

export type SaveDiceThrowResult =
  | { mode: "local" }
  | { mode: "supabase"; id: string }
  | { mode: "error"; message: string };

export async function saveDiceThrow(input: SaveDiceThrowInput): Promise<SaveDiceThrowResult> {
  const client = getSupabaseClient();
  if (!client) return { mode: "local" };
  const { data: auth } = await client.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return { mode: "local" };

  const { data, error } = await client
    .from("dice_throws")
    .insert({
      user_id: userId,
      question: input.question,
      planet_key: input.planetKey,
      sign_key: input.signKey,
      house_key: input.houseKey,
      source: input.source ?? "dice_tab"
    })
    .select("id")
    .single();

  if (error) return { mode: "error", message: error.message };
  return { mode: "supabase", id: data.id as string };
}

export async function listDiceThrows(limit = 30): Promise<DiceThrowRecord[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from("dice_throws")
    .select("id, question, planet_key, sign_key, house_key, source, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id as string,
    question: (row.question as string | null) ?? null,
    planetKey: row.planet_key as string,
    signKey: row.sign_key as string,
    houseKey: row.house_key as string,
    source: (row.source as "dice_tab" | "chat") ?? "dice_tab",
    createdAt: row.created_at as string
  }));
}

export async function deleteDiceThrow(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.from("dice_throws").delete().eq("id", id);
  return !error;
}
