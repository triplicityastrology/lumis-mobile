export function shouldStackWorkbenchActions(fontScale: number): boolean {
  return Number.isFinite(fontScale) && fontScale >= 1.35;
}

export type CareCircleProductLayout = {
  compactPadding: boolean;
  modalMaxHeight: number;
  shortViewport: boolean;
  stackActions: boolean;
};

export function resolveCareCircleProductLayout(input: {
  width: number;
  height: number;
  fontScale: number;
  keyboardVisible: boolean;
}): CareCircleProductLayout {
  const width = Number.isFinite(input.width) ? input.width : 0;
  const height = Number.isFinite(input.height) ? input.height : 0;
  const fontScale = Number.isFinite(input.fontScale) ? input.fontScale : 1;
  const shortViewport = input.keyboardVisible || height < 720;

  return {
    compactPadding: width <= 393 || shortViewport,
    modalMaxHeight: Math.max(280, Math.floor(height * (shortViewport ? 0.68 : 0.84))),
    shortViewport,
    stackActions: width < 400 || fontScale >= 1.35,
  };
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
