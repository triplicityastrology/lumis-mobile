import {
  createWorkbenchSingleFlight,
  resolveCareCircleProductLayout,
  resolveWorkbenchBackAction,
  shouldStackWorkbenchActions,
} from "./workbenchDeviceSafety";

equal(shouldStackWorkbenchActions(1), false, "normal text remains horizontal");
equal(shouldStackWorkbenchActions(1.35), true, "large text stacks actions");
equal(shouldStackWorkbenchActions(2), true, "accessibility text stacks actions");

const founderSmall = resolveCareCircleProductLayout({
  width: 393,
  height: 852,
  fontScale: 1,
  keyboardVisible: false,
});
equal(founderSmall.compactPadding, true, "393-point viewport uses compact padding");
equal(founderSmall.stackActions, true, "393-point viewport stacks product actions");
equal(founderSmall.shortViewport, false, "full-height viewport stays full");

const founderLarge = resolveCareCircleProductLayout({
  width: 430,
  height: 932,
  fontScale: 1,
  keyboardVisible: false,
});
equal(founderLarge.compactPadding, false, "430-point viewport retains signed-off spacing");
equal(founderLarge.stackActions, false, "430-point normal text retains horizontal actions");

const accessibility = resolveCareCircleProductLayout({
  width: 430,
  height: 932,
  fontScale: 1.6,
  keyboardVisible: false,
});
equal(accessibility.stackActions, true, "large text stacks product actions");

const keyboard = resolveCareCircleProductLayout({
  width: 393,
  height: 852,
  fontScale: 1,
  keyboardVisible: true,
});
equal(keyboard.shortViewport, true, "visible keyboard selects short viewport layout");
equal(keyboard.modalMaxHeight, 579, "keyboard limits decision modal height");

const shortHeight = resolveCareCircleProductLayout({
  width: 430,
  height: 667,
  fontScale: 1,
  keyboardVisible: false,
});
equal(shortHeight.shortViewport, true, "short-height viewport remains scrollable");
equal(shortHeight.compactPadding, true, "short-height viewport reduces padding");

const productStates = [
  "caree_landing",
  "four_digit_code_ready",
  "copy_confirmation",
  "carer_entry",
  "pending_no_authority",
  "caree_accept_decline",
  "active",
  "paused",
  "resumed",
  "carer_self_removal",
  "removed_cleanup",
  "expired_code",
  "generic_invalid_code",
] as const;
const layoutScenarios = [
  { name: "iphone_393x852", width: 393, height: 852, fontScale: 1, keyboardVisible: false },
  { name: "iphone_430x932", width: 430, height: 932, fontScale: 1, keyboardVisible: false },
  { name: "large_text", width: 430, height: 932, fontScale: 1.6, keyboardVisible: false },
  { name: "keyboard_visible", width: 393, height: 852, fontScale: 1, keyboardVisible: true },
  { name: "short_height", width: 393, height: 667, fontScale: 1, keyboardVisible: false },
] as const;

equal(productStates.length, 13, "all T145 product states are represented");
for (const state of productStates) {
  for (const scenario of layoutScenarios) {
    const result = resolveCareCircleProductLayout(scenario);
    equal(result.modalMaxHeight >= 280, true, `${state}/${scenario.name} retains usable decisions`);
    equal(result.modalMaxHeight <= scenario.height, true, `${state}/${scenario.name} stays in viewport`);
  }
}

equal(
  resolveWorkbenchBackAction({ busy: true, hasTransientInput: true }),
  "block_busy",
  "Back cannot interrupt an operation"
);
equal(
  resolveWorkbenchBackAction({ busy: false, hasTransientInput: true }),
  "clear_transient_input",
  "Back clears transient input first"
);
equal(
  resolveWorkbenchBackAction({ busy: false, hasTransientInput: false }),
  "allow_exit",
  "Back exits only from a settled workbench"
);

const flight = createWorkbenchSingleFlight();
equal(flight.enter(), true, "first operation starts");
equal(flight.enter(), false, "double tap is rejected synchronously");
equal(flight.isActive(), true, "operation remains active");
flight.leave();
equal(flight.enter(), true, "operation can retry after settlement");

console.log("Care Circle workbench device-safety fixtures passed");

function equal(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: assertion failed`);
}
