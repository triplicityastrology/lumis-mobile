/**
 * Chart-wheel projection math (INS-001).
 *
 * Extracted as a pure module so the orientation can be proven with deterministic
 * fixtures (see `chart-wheel.fixtures.ts`) independently of react-native-svg.
 *
 * Convention (Western tropical natal wheel):
 * - The Ascendant is pinned to the LEFT (9 o'clock).
 * - Zodiacal longitude increases **counter-clockwise** around the ring
 *   (ASC → +90° at the bottom → +180° at the right → +270° at the top).
 *
 * This corrects a prior clockwise formula `(180 - (lon - asc))`, which advanced
 * the ring the wrong way. ASC placement (left) is identical under both formulas;
 * only the direction of increasing longitude changes. Natal calculations and the
 * astrology data authority are untouched — this is a rendering-orientation fix.
 */

/**
 * Whether houses / ASC / MC may be shown. NON-bypassable: they render only for a
 * full-precision (timed) chart. A caller can hide them with showHouses=false, but
 * passing showHouses=true can never reveal them for a no_birth_time chart.
 */
export function resolveShowHouses(
  precision: "full" | "no_birth_time",
  showHouses?: boolean
): boolean {
  return precision === "full" && showHouses !== false;
}

/** Screen-space angle (radians) for an ecliptic longitude, ASC pinned left. */
export function wheelAngleRad(longitude: number, ascLongitude: number): number {
  return ((180 + (longitude - ascLongitude)) * Math.PI) / 180;
}

/**
 * Project an ecliptic longitude to an [x, y] point on the wheel.
 * `center` is the SVG centre; y grows downward (SVG convention), so we subtract
 * the sine term.
 */
export function wheelPoint(
  longitude: number,
  ascLongitude: number,
  radius: number,
  center: number
): [number, number] {
  const a = wheelAngleRad(longitude, ascLongitude);
  return [center + radius * Math.cos(a), center - radius * Math.sin(a)];
}
