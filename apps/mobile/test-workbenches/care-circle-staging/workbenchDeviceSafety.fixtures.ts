import {
  createWorkbenchSingleFlight,
  resolveWorkbenchBackAction,
  shouldStackWorkbenchActions,
} from "./workbenchDeviceSafety";

equal(shouldStackWorkbenchActions(1), false, "normal text remains horizontal");
equal(shouldStackWorkbenchActions(1.35), true, "large text stacks actions");
equal(shouldStackWorkbenchActions(2), true, "accessibility text stacks actions");

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
