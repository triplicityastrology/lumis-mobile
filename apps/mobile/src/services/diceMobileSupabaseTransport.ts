import type { DiceMobileGatewayRequest } from "./diceMobileLiveGateway";

export function createDiceMobileSupabaseTransport() {
  const relayUrl = parseRelayUrl(process.env.EXPO_PUBLIC_DICE_MOBILE_RELAY_URL);
  const session = process.env.EXPO_PUBLIC_DICE_MOBILE_RELAY_SESSION;
  if (!relayUrl || !session || !/^[A-Za-z0-9_-]{43}$/u.test(session)) {
    throw new Error("DICE_GATEWAY_UNAVAILABLE");
  }
  return async (body: DiceMobileGatewayRequest): Promise<unknown> => {
    const response = await fetch(relayUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-lumis-mobile-dice-session": session,
      },
      body: JSON.stringify(body),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error("DICE_GATEWAY_UNAVAILABLE");
    return payload;
  };
}

function parseRelayUrl(value: string | undefined): string | null {
  try {
    const parsed = new URL(value ?? "");
    const privateHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" ||
      /^10\./u.test(parsed.hostname) || /^192\.168\./u.test(parsed.hostname) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./u.test(parsed.hostname);
    if (parsed.protocol !== "http:" || !privateHost || parsed.pathname !== "/dice" || parsed.search || parsed.hash) return null;
    return parsed.href;
  } catch {
    return null;
  }
}
