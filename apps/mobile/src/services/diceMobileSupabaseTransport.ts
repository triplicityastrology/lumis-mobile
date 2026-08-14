import type { DiceMobileGatewayRequest } from "./diceMobileLiveGateway";
import { getSupabaseClient } from "./supabase";

export function createDiceMobileSupabaseTransport() {
  const client = getSupabaseClient();
  if (!client) throw new Error("DICE_GATEWAY_UNAVAILABLE");
  return async (body: DiceMobileGatewayRequest): Promise<unknown> => {
    const result = await client.functions.invoke("dice-synthetic", { body });
    if (result.error) throw new Error("DICE_GATEWAY_UNAVAILABLE");
    return result.data;
  };
}
