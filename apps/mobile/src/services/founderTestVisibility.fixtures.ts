import { canShowFounderTests } from "./founderTestVisibility";

const loaded = {
  accountLoadStatus: "loaded" as const,
  hasChart: true,
  hasProfile: true,
  isDevelopment: true,
  modalOpen: false,
};

check(!canShowFounderTests({ ...loaded, accountLoadStatus: "idle", screen: "splash" }), "computer restart splash hides entry");
check(!canShowFounderTests({ ...loaded, accountLoadStatus: "loading", screen: "restoringSpace" }), "delayed hydration hides entry");
check(!canShowFounderTests({ ...loaded, accountLoadStatus: "error", screen: "restoringSpace" }), "terminal restoration hides entry");
check(!canShowFounderTests({ ...loaded, screen: "auth" }), "auth hides entry");
check(!canShowFounderTests({ ...loaded, screen: "profile" }), "onboarding hides entry");
check(!canShowFounderTests({ ...loaded, screen: "birthDetails" }), "regeneration flow hides entry");
check(!canShowFounderTests({ ...loaded, modalOpen: true, screen: "chat" }), "modal hides entry");
check(!canShowFounderTests({ ...loaded, hasChart: false, screen: "home" }), "partial account shell hides entry");
check(canShowFounderTests({ ...loaded, screen: "chat" }), "authoritative account chat shows entry");
check(canShowFounderTests({ ...loaded, screen: "profileTab" }), "restored profile shell shows entry");
check(!canShowFounderTests({ ...loaded, isDevelopment: false, screen: "chat" }), "release hides entry");

console.log("Founder Test visibility fixtures passed");

function check(value: boolean, label: string) {
  if (!value) throw new Error(label);
}
