export type MobileErrorSurface =
  | "auth_send"
  | "auth_restore"
  | "auth_logout"
  | "chart_create"
  | "persona_save"
  | "chat_send"
  | "dice_save";

const FALLBACK_MESSAGES: Record<MobileErrorSurface, string> = {
  auth_send: "Lumis could not send your secure sign-in link. Please try again.",
  auth_restore: "Lumis could not securely restore your account. Please try again.",
  auth_logout: "Lumis could not log you out. You are still signed in. Please try again.",
  chart_create: "Lumis could not safely create your chart. Your account data was not changed.",
  persona_save: "Lumis could not save your Persona changes. Your previous settings remain active.",
  chat_send: "Lumis could not send this reflection. Your message was not saved. Please retry.",
  dice_save: "This throw could not be saved. Your Dice result is still available on this screen."
};

export function safeUserErrorMessage(
  error: unknown,
  surface: MobileErrorSurface
): string {
  const classification = classifyError(error);

  if (classification === "rate_limited" && surface === "auth_send") {
    return "Too many sign-in emails were requested. Please wait before trying again.";
  }

  if (classification === "invalid_link" && surface === "auth_restore") {
    return "That sign-in link is invalid or expired. Request a new secure link.";
  }

  if (classification === "network") {
    if (surface === "auth_send") {
      return "Lumis could not send your secure sign-in link because the connection was interrupted. Check your connection and try again.";
    }

    if (surface === "auth_restore") {
      return "Lumis could not securely restore your account because the connection was interrupted. Check your connection and try again.";
    }

    if (surface === "auth_logout") {
      return "Lumis could not log you out because the connection was interrupted. You are still signed in. Please try again.";
    }
  }

  return FALLBACK_MESSAGES[surface];
}

function classifyError(
  error: unknown
): "invalid_link" | "network" | "rate_limited" | "unknown" {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  if (/rate limit|too many sign-in|email rate/i.test(message)) {
    return "rate_limited";
  }

  if (/invalid|expired|already used|otp_expired/i.test(message)) {
    return "invalid_link";
  }

  if (
    /AUTH_NETWORK_INTERRUPTED|network request failed|failed to fetch|networkerror|load failed|fetch|connection.*interrupt/i.test(
      message
    )
  ) {
    return "network";
  }

  return "unknown";
}
