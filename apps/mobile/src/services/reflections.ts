import { getSupabaseClient } from "./supabase";
import { deleteReflectionWithPort, type DeleteReflectionResult } from "./reflectionDeletionBoundary";

export async function deleteOwnedReflection(input: {
  threadId: string;
  clientRequestId: string;
}): Promise<DeleteReflectionResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, code: "AUTH_REQUIRED" };
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { ok: false, code: "AUTH_REQUIRED" };
  return deleteReflectionWithPort(
    async ({ threadId, clientRequestId }) => supabase.rpc("delete_owned_reflection", {
      p_thread_id: threadId,
      p_client_request_id: clientRequestId
    }),
    input
  );
}
