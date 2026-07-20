/**
 * CSPRNG helpers for throw randomness (AC-DICE-01 §5: torque jitter and impulse
 * variation must come from the platform CSPRNG, never Math.random, and never the AI).
 *
 * The mobile entry point supplies expo-crypto, while Node and browsers can use
 * their native global crypto implementation.
 */
export type RandomSource = () => number;

type RandomValuesProvider = (buffer: Uint32Array) => Uint32Array;

let platformGetRandomValues: RandomValuesProvider | null = null;

export function configureSecureRandom(provider: RandomValuesProvider): void {
  platformGetRandomValues = provider;
}

function cryptoRandom(): number {
  const globalProvider = (globalThis as { crypto?: Crypto }).crypto?.getRandomValues;
  const provider = platformGetRandomValues ?? globalProvider?.bind(globalThis.crypto);
  if (!provider) {
    throw new Error("Secure randomness unavailable on this platform.");
  }
  const buf = new Uint32Array(1);
  provider(buf);
  return buf[0] / 0x1_0000_0000;
}

/** Uniform in [0, 1). Cryptographically sourced. */
export const secureRandom: RandomSource = cryptoRandom;

/** Uniform in [-magnitude, +magnitude]. */
export function spread(magnitude: number, random: RandomSource = secureRandom): number {
  return (random() * 2 - 1) * magnitude;
}

/**
 * Deterministic PRNG (mulberry32) for reproducible physics tests only.
 * Never used in production throws.
 */
export function seededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
