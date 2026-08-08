/**
 * Birthplace resolution — CLOSED adapter boundary (ONB-005, founder return).
 *
 * The onboarding/edit flows must not invent a live geolocation provider. This
 * seam is intentionally "unconfigured": it performs no network call and confirms
 * nothing until the Lumis website's location-service API contract is supplied.
 *
 * When that contract arrives, implement `configureBirthPlaceProvider(...)` with
 * the real resolver and have `resolveBirthPlace` delegate to it (async), then the
 * UI can reject "not_found" places truthfully. Until then every non-empty query
 * is reported as `unconfigured` so the app is honest about what it can verify.
 */

export type ResolvedBirthPlace = {
  label: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export type BirthPlaceResolution =
  | { status: "empty" }
  | { status: "unconfigured"; query: string }
  | { status: "not_found"; query: string }
  | { status: "confirmed"; place: ResolvedBirthPlace };

type BirthPlaceProvider = (query: string) => BirthPlaceResolution;

// No provider is wired in this build. This is the single place a real
// website-backed resolver is injected once its API contract is defined.
let provider: BirthPlaceProvider | null = null;

export function configureBirthPlaceProvider(next: BirthPlaceProvider | null): void {
  provider = next;
}

export function isBirthPlaceProviderConfigured(): boolean {
  return provider !== null;
}

export function resolveBirthPlace(query: string): BirthPlaceResolution {
  const trimmed = query.trim();
  if (trimmed === "") return { status: "empty" };
  if (!provider) return { status: "unconfigured", query: trimmed };
  return provider(trimmed);
}
