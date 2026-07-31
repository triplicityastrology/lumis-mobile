/**
 * Deterministic fixtures for the chart-wheel orientation (INS-001, authority
 * correction E). Proves — independently of react-native-svg — that:
 *   1. the Ascendant is pinned to the LEFT (9 o'clock);
 *   2. longitude increases COUNTER-CLOCKWISE (ASC → bottom → right → top);
 *   3. ASC/MC land on the correct sides;
 * plus a source-level check that unknown-time charts suppress ASC/MC/houses.
 *
 * These asserted the wheel had a reversed (clockwise) direction before the fix
 * and now pass with the corrected `(180 + (lon - asc))` formula.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { resolveShowHouses, wheelPoint } from "./wheelMath";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log("  ok  " + label);
  } else {
    failures += 1;
    console.log("  FAIL " + label);
  }
}

const C = 150; // arbitrary centre
const R = 100;
const ASC = 30; // arbitrary ascendant longitude, to prove asc-relative math
const EPS = 0.5;

// Helpers on the projected point.
const [ascX, ascY] = wheelPoint(ASC, ASC, R, C);
const [botX, botY] = wheelPoint(ASC + 90, ASC, R, C);
const [rightX, rightY] = wheelPoint(ASC + 180, ASC, R, C);
const [topX, topY] = wheelPoint(ASC + 270, ASC, R, C);

// 1. ASC pinned LEFT (x < centre, y ≈ centre).
check("ASC is at the left (9 o'clock)", ascX < C - R + EPS && Math.abs(ascY - C) < EPS);

// 2. Counter-clockwise: +90° from ASC is at the BOTTOM (y > centre), not the top.
check("+90° from ASC is at the bottom (counter-clockwise)", botY > C + R - EPS && Math.abs(botX - C) < EPS);

// +180° is at the RIGHT.
check("+180° from ASC is at the right", rightX > C + R - EPS && Math.abs(rightY - C) < EPS);

// +270° (i.e. the MC direction, ~ASC-90°) is at the TOP.
check("+270° from ASC (MC direction) is at the top", topY < C - R + EPS && Math.abs(topX - C) < EPS);

// 3. Regression guard: the OLD clockwise formula would have put +90° at the top.
check("not the old clockwise orientation (+90° must NOT be at top)", !(botY < C));

// 4. NON-bypassable unknown-time suppression (deterministic, runtime).
//    A caller passing showHouses=true must never reveal houses/ASC/MC for a
//    no_birth_time chart (birth-time capability rule C).
check("full + default → houses shown", resolveShowHouses("full", undefined) === true);
check("full + showHouses=false → hidden (caller may hide)", resolveShowHouses("full", false) === false);
check("no_birth_time + showHouses=true → STILL hidden (no bypass)", resolveShowHouses("no_birth_time", true) === false);
check("no_birth_time + default → hidden", resolveShowHouses("no_birth_time", undefined) === false);
check("no_birth_time + showHouses=false → hidden", resolveShowHouses("no_birth_time", false) === false);

// 5. Source contract: NatalWheel gates ASC/MC labels and house cusps on `show`,
//    derived from the non-bypassable resolver (not the old nullish override).
// Compiled fixture runs from .tmp/ with cwd = repo root (matching test:dice).
const wheelSrc = readFileSync(join(process.cwd(), "apps/mobile/src/components/NatalWheel.tsx"), "utf8");
check("NatalWheel uses resolveShowHouses (non-bypassable)", /const show = resolveShowHouses\(chart\.precision, showHouses\)/.test(wheelSrc));
check("NatalWheel no longer uses the bypassable nullish override", !/showHouses \?\? chart\.precision/.test(wheelSrc));
check("ASC/MC labels gated on show", /\{show[\s\S]{0,80}\["ASC", asc\]/.test(wheelSrc));
check("house cusps gated on show", /const houseCusps = show/.test(wheelSrc));
check("uses the corrected wheelPoint projection", /wheelPoint\(lon, asc, r, C\)/.test(wheelSrc));

if (failures > 0) {
  console.log(`\nchart-wheel fixtures FAILED (${failures})`);
  throw new Error("chart-wheel orientation fixtures failed");
}
console.log("\nall chart-wheel orientation fixtures passed");
