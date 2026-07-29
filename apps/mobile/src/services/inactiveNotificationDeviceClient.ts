export const INACTIVE_NOTIFICATION_DEVICE_CLIENT_VERSION =
  "inactive_notification_device_client_v1" as const;

export const INACTIVE_NOTIFICATION_TYPES = [
  "care_circle_check_in",
  "care_circle_reminder",
] as const;

export type InactiveNotificationType =
  (typeof INACTIVE_NOTIFICATION_TYPES)[number];

export type NotificationDeviceClientInput =
  | {
      action: "register" | "rotate";
      clientRequestId: string;
      installationId: string;
      platform: "ios" | "android";
      provider: "expo" | "apns" | "fcm";
      deviceToken: string;
      permissionStatus: "granted" | "provisional";
      notificationTypes: readonly string[];
    }
  | {
      action:
        | "unregister_on_logout"
        | "revoke_permission"
        | "invalidate_provider_token";
      clientRequestId: string;
      installationId: string;
    };

export type NotificationDevicePortRequest =
  | {
      action: "register";
      intent: "register" | "rotate";
      request_id: string;
      installation_id: string;
      platform: "ios" | "android";
      provider: "expo" | "apns" | "fcm";
      provider_token: string;
      permission_status: "granted" | "provisional";
      notification_types: readonly InactiveNotificationType[];
    }
  | {
      action: "unregister";
      reason: "logout" | "permission_revoked" | "provider_invalid";
      request_id: string;
      installation_id: string;
    };

export type NotificationDeviceClientPort = {
  execute(request: NotificationDevicePortRequest): Promise<unknown>;
};

export type NotificationDeviceClientFailureCode =
  | "NOTIFICATION_DEVICE_INPUT_INVALID"
  | "NOTIFICATION_TYPE_REJECTED"
  | "NOTIFICATION_AUTH_REQUIRED"
  | "NOTIFICATION_REQUEST_CONFLICT"
  | "NOTIFICATION_DEVICE_UNAVAILABLE";

export type NotificationDeviceClientSuccess = {
  ok: true;
  clientVersion: typeof INACTIVE_NOTIFICATION_DEVICE_CLIENT_VERSION;
  code:
    | "NOTIFICATION_DEVICE_REGISTERED"
    | "NOTIFICATION_DEVICE_ROTATED"
    | "NOTIFICATION_DEVICE_REMOVED";
  endpointId?: string;
  replayed: boolean;
  registry: ReadonlyArray<{
    notificationType: InactiveNotificationType;
    enabled: false;
  }>;
};

export type NotificationDeviceClientFailure = {
  ok: false;
  clientVersion: typeof INACTIVE_NOTIFICATION_DEVICE_CLIENT_VERSION;
  code: NotificationDeviceClientFailureCode;
  message: string;
  retryable: boolean;
};

export type NotificationDeviceClientResult =
  | NotificationDeviceClientSuccess
  | NotificationDeviceClientFailure;

export type InactiveNotificationDeviceClient = {
  readonly version: typeof INACTIVE_NOTIFICATION_DEVICE_CLIENT_VERSION;
  execute(
    input: NotificationDeviceClientInput
  ): Promise<NotificationDeviceClientResult>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FAILURE_MESSAGES: Record<NotificationDeviceClientFailureCode, string> = {
  NOTIFICATION_DEVICE_INPUT_INVALID:
    "Check the notification device request and try again.",
  NOTIFICATION_TYPE_REJECTED:
    "This notification type is not available.",
  NOTIFICATION_AUTH_REQUIRED:
    "Sign in before changing notification device settings.",
  NOTIFICATION_REQUEST_CONFLICT:
    "This notification device request conflicts with an earlier request.",
  NOTIFICATION_DEVICE_UNAVAILABLE:
    "Notification device settings could not be updated. Try again later.",
};

export function createInactiveNotificationDeviceClient(
  port: NotificationDeviceClientPort
): InactiveNotificationDeviceClient {
  return {
    version: INACTIVE_NOTIFICATION_DEVICE_CLIENT_VERSION,
    async execute(
      input: NotificationDeviceClientInput
    ): Promise<NotificationDeviceClientResult> {
      const request = buildRequest(input);
      if (request === "type_rejected") {
        return failure("NOTIFICATION_TYPE_REJECTED", false);
      }
      if (!request) {
        return failure("NOTIFICATION_DEVICE_INPUT_INVALID", false);
      }

      try {
        return projectResponse(input.action, await port.execute(request));
      } catch {
        return failure("NOTIFICATION_DEVICE_UNAVAILABLE", true);
      }
    },
  };
}

function buildRequest(
  input: NotificationDeviceClientInput
): NotificationDevicePortRequest | "type_rejected" | null {
  if (
    !UUID_PATTERN.test(input.clientRequestId) ||
    !UUID_PATTERN.test(input.installationId)
  ) {
    return null;
  }

  if (input.action === "register" || input.action === "rotate") {
    if (
      input.deviceToken.trim().length < 8 ||
      input.deviceToken.length > 4096 ||
      input.notificationTypes.length === 0 ||
      new Set(input.notificationTypes).size !== input.notificationTypes.length
    ) {
      return null;
    }
    if (
      !input.notificationTypes.every((type) =>
        INACTIVE_NOTIFICATION_TYPES.includes(type as InactiveNotificationType)
      )
    ) {
      return "type_rejected";
    }
    return {
      action: "register",
      intent: input.action,
      request_id: input.clientRequestId,
      installation_id: input.installationId,
      platform: input.platform,
      provider: input.provider,
      provider_token: input.deviceToken,
      permission_status: input.permissionStatus,
      notification_types:
        input.notificationTypes as readonly InactiveNotificationType[],
    };
  }

  return {
    action: "unregister",
    reason: {
      unregister_on_logout: "logout",
      revoke_permission: "permission_revoked",
      invalidate_provider_token: "provider_invalid",
    }[input.action] as
      | "logout"
      | "permission_revoked"
      | "provider_invalid",
    request_id: input.clientRequestId,
    installation_id: input.installationId,
  };
}

function projectResponse(
  action: NotificationDeviceClientInput["action"],
  response: unknown
): NotificationDeviceClientResult {
  if (!isRecord(response)) {
    return failure("NOTIFICATION_DEVICE_UNAVAILABLE", true);
  }

  const backendError = isRecord(response.error) ? response.error : null;
  if (backendError) {
    return mapFailure(
      typeof backendError.code === "string" ? backendError.code : null
    );
  }
  if (response.ok !== true) {
    return failure("NOTIFICATION_DEVICE_UNAVAILABLE", true);
  }

  if (
    "registry" in response &&
    (!Array.isArray(response.registry) ||
      response.registry.some(
        (entry) =>
          !isRecord(entry) ||
          !INACTIVE_NOTIFICATION_TYPES.includes(
            entry.notification_type as InactiveNotificationType
          ) ||
          entry.enabled !== false
      ))
  ) {
    return failure("NOTIFICATION_DEVICE_UNAVAILABLE", false);
  }

  const endpointId =
    typeof response.endpoint_id === "string" &&
    UUID_PATTERN.test(response.endpoint_id)
      ? response.endpoint_id
      : undefined;
  if (
    (action === "register" || action === "rotate") &&
    endpointId === undefined
  ) {
    return failure("NOTIFICATION_DEVICE_UNAVAILABLE", true);
  }

  return {
    ok: true,
    clientVersion: INACTIVE_NOTIFICATION_DEVICE_CLIENT_VERSION,
    code:
      action === "register"
        ? "NOTIFICATION_DEVICE_REGISTERED"
        : action === "rotate"
          ? "NOTIFICATION_DEVICE_ROTATED"
          : "NOTIFICATION_DEVICE_REMOVED",
    ...(endpointId ? { endpointId } : {}),
    replayed: response.idempotent === true,
    registry: INACTIVE_NOTIFICATION_TYPES.map((notificationType) => ({
      notificationType,
      enabled: false as const,
    })),
  };
}

function mapFailure(
  backendCode: string | null
): NotificationDeviceClientFailure {
  switch (backendCode) {
    case "AUTH_REQUIRED":
      return failure("NOTIFICATION_AUTH_REQUIRED", false);
    case "NOTIFICATION_REQUEST_ID_CONFLICT":
    case "23505":
      return failure("NOTIFICATION_REQUEST_CONFLICT", false);
    case "NOTIFICATION_REQUEST_INVALID":
    case "22023":
      return failure("NOTIFICATION_DEVICE_INPUT_INVALID", false);
    default:
      return failure("NOTIFICATION_DEVICE_UNAVAILABLE", true);
  }
}

function failure(
  code: NotificationDeviceClientFailureCode,
  retryable: boolean
): NotificationDeviceClientFailure {
  return {
    ok: false,
    clientVersion: INACTIVE_NOTIFICATION_DEVICE_CLIENT_VERSION,
    code,
    message: FAILURE_MESSAGES[code],
    retryable,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
