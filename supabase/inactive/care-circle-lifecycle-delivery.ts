export type CareCircleLifecycleEventType = "carer_request_pending" | "caree_request_accepted";
export type CareCircleLifecycleDeliveryInput = { eventKey: string; eventType: CareCircleLifecycleEventType; recipientUserId: string };
export type CareCircleLifecycleDeliveryPorts = {
  writeInbox(input: CareCircleLifecycleDeliveryInput): Promise<"created" | "duplicate">;
  push(input: CareCircleLifecycleDeliveryInput): Promise<"sent" | "permission_denied" | "token_missing" | "provider_failed">;
};
export async function deliverCareCircleLifecycleEvent(input: CareCircleLifecycleDeliveryInput, ports: CareCircleLifecycleDeliveryPorts, options: { pushEnabled: false | true } = { pushEnabled: false }) {
  if (!/^[a-z0-9:_-]{8,120}$/.test(input.eventKey) || !/^[0-9a-f-]{36}$/i.test(input.recipientUserId)) return { ok: false as const, code: "CARE_CIRCLE_EVENT_INVALID" as const };
  const inbox = await ports.writeInbox(input);
  if (!options.pushEnabled) return { ok: true as const, inbox, push: "disabled" as const };
  const push = await ports.push(input).catch(() => "provider_failed" as const);
  return { ok: true as const, inbox, push };
}
