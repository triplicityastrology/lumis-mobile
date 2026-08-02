export type FounderTestShellScreen =
  | "home"
  | "chat"
  | "insights"
  | "dice"
  | "profileTab"
  | "splash"
  | "restoringSpace"
  | "auth"
  | "profile"
  | "preview"
  | "persona"
  | "reflections"
  | "notifications"
  | "care"
  | "birthDetails"
  | "chartUpdated"
  | "noChart";

const STABLE_ACCOUNT_SCREENS = new Set<FounderTestShellScreen>([
  "home",
  "chat",
  "insights",
  "dice",
  "profileTab",
]);

export function canShowFounderTests(input: {
  accountLoadStatus: "idle" | "loading" | "loaded" | "empty" | "error";
  hasChart: boolean;
  hasProfile: boolean;
  isDevelopment: boolean;
  modalOpen: boolean;
  screen: FounderTestShellScreen;
}): boolean {
  return Boolean(
    input.isDevelopment &&
      input.accountLoadStatus === "loaded" &&
      input.hasChart &&
      input.hasProfile &&
      !input.modalOpen &&
      STABLE_ACCOUNT_SCREENS.has(input.screen)
  );
}
