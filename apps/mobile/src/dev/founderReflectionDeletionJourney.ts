export const DISPOSABLE_REFLECTION = {
  id: "local-founder-reflection",
  title: "Disposable local reflection",
  dateLabel: "Founder test fixture",
} as const;

export const DELETION_REQUEST_ID = "90000000-0000-4000-8000-000000000099";

export type FounderReflectionDeletionState = {
  rowPresent: boolean;
  dialogOpen: boolean;
  phase: "ready" | "confirming" | "failed" | "deleted";
  requestId: typeof DELETION_REQUEST_ID;
  attempts: number;
  failurePending: boolean;
};

export type FounderReflectionDeletionAction =
  | { type: "open_confirmation" }
  | { type: "cancel" }
  | { type: "confirm" }
  | { type: "reset" };

export function createFounderReflectionDeletionState(): FounderReflectionDeletionState {
  return {
    rowPresent: true,
    dialogOpen: false,
    phase: "ready",
    requestId: DELETION_REQUEST_ID,
    attempts: 0,
    failurePending: true,
  };
}

export function reduceFounderReflectionDeletion(
  state: FounderReflectionDeletionState,
  action: FounderReflectionDeletionAction,
): FounderReflectionDeletionState {
  if (action.type === "reset") return createFounderReflectionDeletionState();
  if (action.type === "open_confirmation" && state.rowPresent) {
    return { ...state, dialogOpen: true, phase: "confirming" };
  }
  if (action.type === "cancel" && state.dialogOpen) {
    return { ...state, dialogOpen: false, phase: "ready" };
  }
  if (action.type !== "confirm" || !state.dialogOpen || !state.rowPresent) return state;

  if (state.failurePending) {
    return {
      ...state,
      attempts: state.attempts + 1,
      failurePending: false,
      phase: "failed",
    };
  }

  return {
    ...state,
    attempts: state.attempts + 1,
    rowPresent: false,
    dialogOpen: false,
    phase: "deleted",
  };
}
