export const CARE_CIRCLE_QR_PAYLOAD_PATTERN = /^\d{4}$/;

export function normalizeCareCircleQrPayload(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return CARE_CIRCLE_QR_PAYLOAD_PATTERN.test(value) ? value : null;
}
