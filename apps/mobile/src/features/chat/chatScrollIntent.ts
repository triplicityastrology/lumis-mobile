export const CHAT_LATEST_THRESHOLD_PX = 80;

export type ChatScrollMetrics = {
  contentHeight: number;
  viewportHeight: number;
  offsetY: number;
};

export type ChatContentChange =
  | "message_sent"
  | "reply_pending"
  | "reply_completed"
  | "composer_layout";

export function isNearChatLatest(metrics: ChatScrollMetrics): boolean {
  const distanceFromLatest = Math.max(
    0,
    metrics.contentHeight - metrics.viewportHeight - metrics.offsetY
  );
  return distanceFromLatest <= CHAT_LATEST_THRESHOLD_PX;
}

export function shouldMaintainChatLatest(
  isFollowingLatest: boolean,
  _change: ChatContentChange
): boolean {
  return isFollowingLatest;
}
