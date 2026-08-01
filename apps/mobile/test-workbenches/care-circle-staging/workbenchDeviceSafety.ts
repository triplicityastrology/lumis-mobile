export function shouldStackWorkbenchActions(fontScale: number): boolean {
  return Number.isFinite(fontScale) && fontScale >= 1.35;
}

export function resolveWorkbenchBackAction(input: {
  busy: boolean;
  hasTransientInput: boolean;
}): "block_busy" | "clear_transient_input" | "allow_exit" {
  if (input.busy) return "block_busy";
  if (input.hasTransientInput) return "clear_transient_input";
  return "allow_exit";
}

export function createWorkbenchSingleFlight() {
  let active = false;
  return {
    enter(): boolean {
      if (active) return false;
      active = true;
      return true;
    },
    leave() {
      active = false;
    },
    isActive() {
      return active;
    },
  };
}
