import { normalizeCareCircleQrPayload } from "./careCircleQrPayload";

export type CareCircleCameraState =
  | "module_unavailable"
  | "permission_required"
  | "permission_denied"
  | "camera_ready"
  | "cancelled";

export type CareCircleCameraPort = {
  availability(): "available" | "unavailable";
  permission(): "granted" | "denied" | "undetermined";
  requestPermission(): Promise<"granted" | "denied">;
};

export function resolveCareCircleCameraState(port: CareCircleCameraPort): CareCircleCameraState {
  if (port.availability() !== "available") return "module_unavailable";
  const permission = port.permission();
  if (permission === "granted") return "camera_ready";
  return permission === "denied" ? "permission_denied" : "permission_required";
}

export function acceptCareCircleCameraPayload(payload: unknown):
  | { ok: true; pairingCode: string }
  | { ok: false; code: "CARE_CIRCLE_QR_INVALID" } {
  const pairingCode = normalizeCareCircleQrPayload(payload);
  return pairingCode ? { ok: true, pairingCode } : { ok: false, code: "CARE_CIRCLE_QR_INVALID" };
}
