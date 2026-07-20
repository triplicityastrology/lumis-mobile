/**
 * Dice module acceptance fixtures (AC-DICE-01 §9, AC-DICE-04 §10).
 *
 * Run via `pnpm test:dice` — compiled with tsc and executed in Node, following
 * the repo's fixtures convention. Covers:
 *   1. Geometry: 12 flat pentagons, coplanar within tolerance, correct inradius.
 *   2. Face reading: pure reader returns face i when face i is rotated flat-up,
 *      for all 12 faces × several randomized in-plane spins.
 *   3. Cocked detection: tilted die reads cocked below the 0.90 threshold.
 *   4. Distribution: 1,000 simulated throws per acceptance run — every face of
 *      every die must land within the 5–12% frequency band; cocked dice resolve
 *      within 3 nudges.
 */
import { DIE_INRADIUS, DODECA_FACES, DODECA_VERTICES } from "./geometry";
import { readTopFace } from "./faceReading";
import {
  createWorld, groundDie, launch, resolveSettledFaces, stepWorld, FIXED_STEP
} from "./physics";
import {
  dot, normalize, quatBetween, quatFromAxisAngle, quatMultiply, quatRotate, sub, vec
} from "./math";
import { seededRandom } from "./rng";

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  ok  ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("dice fixtures: geometry");
{
  check("12 faces", DODECA_FACES.length === 12);
  check("20 vertices", DODECA_VERTICES.length === 20);
  let maxPlaneError = 0;
  let pentagons = true;
  for (const face of DODECA_FACES) {
    if (face.vertexIndices.length !== 5) pentagons = false;
    for (const vi of face.vertexIndices) {
      const offset = Math.abs(dot(sub(DODECA_VERTICES[vi], face.center), face.normal));
      maxPlaneError = Math.max(maxPlaneError, offset);
    }
  }
  check("every face is a pentagon", pentagons);
  check("faces are flat (coplanar < 1e-9)", maxPlaneError < 1e-9, `max plane error ${maxPlaneError}`);
  check("inradius positive and below circumradius", DIE_INRADIUS > 0 && DIE_INRADIUS < 0.34);
  const uniqueFaces = new Set(DODECA_FACES.map((f) => [...f.vertexIndices].sort((a, b) => a - b).join(",")));
  check("faces are 12 distinct vertex sets", uniqueFaces.size === 12);
}

console.log("dice fixtures: face reading");
{
  const random = seededRandom(7);
  let allMatch = true;
  let minConfidence = 1;
  for (let i = 0; i < 12; i++) {
    for (let spin = 0; spin < 4; spin++) {
      // Orient face i flat-up, then spin randomly around world-up (must not change the reading).
      const alignUp = quatBetween(DODECA_FACES[i].normal, vec(0, 1, 0));
      const spun = quatMultiply(quatFromAxisAngle(vec(0, 1, 0), random() * Math.PI * 2), alignUp);
      const reading = readTopFace(spun);
      if (reading.faceIndex !== i) allMatch = false;
      minConfidence = Math.min(minConfidence, reading.confidence);
      if (reading.cocked) allMatch = false;
    }
  }
  check("all 12 faces read correctly when flat-up (×4 spins)", allMatch);
  check("flat-up confidence ≈ 1", minConfidence > 0.999, `min ${minConfidence}`);

  // cos⁻¹(0.90) ≈ 25.8°, so a 30° tilt must read cocked and a 20° tilt must not.
  const tiltBy = (deg: number) =>
    quatMultiply(
      quatFromAxisAngle(vec(1, 0, 0), (deg * Math.PI) / 180),
      quatBetween(DODECA_FACES[0].normal, vec(0, 1, 0))
    );
  check("30° tilt reads cocked", readTopFace(tiltBy(30)).cocked);
  check("20° tilt reads not-cocked", !readTopFace(tiltBy(20)).cocked);
}

console.log("dice fixtures: settle behavior (seeded)");
{
  const random = seededRandom(1234);
  const world = createWorld(undefined, random);
  launch(world, 1.0, random);
  let steps = 0;
  while (!stepWorld(world, FIXED_STEP * 4, random) && steps++ < 6000) { /* run */ }
  check("throw settles", world.settled, `after ${steps} macro-steps`);
  check(
    "settles within spec window (≲ 4.5s sim time)",
    world.elapsed > 0.5 && world.elapsed < 4.5,
    `elapsed ${world.elapsed.toFixed(2)}s`
  );
  const { readings, nudges } = resolveSettledFaces(world, random);
  check("three readings", readings.length === 3);
  check("no reading is cocked after resolution", readings.every((r) => !r.cocked));
  check("nudges within 3 per die", nudges.every((n) => n <= 3), nudges.join(","));
  for (const die of world.dice) groundDie(die);
  const lowestVertexY = (die: (typeof world.dice)[number]) =>
    Math.min(...DODECA_VERTICES.map((v) => quatRotate(die.orientation, v).y + die.position.y));
  check(
    "lowest vertex touches the table after grounding",
    world.dice.every((d) => Math.abs(lowestVertexY(d)) < 1e-6),
    world.dice.map((d) => lowestVertexY(d).toExponential(2)).join(",")
  );
  check(
    "rest heights are physical (INR ≤ y ≤ 1.35·INR)",
    world.dice.every((d) => d.position.y > DIE_INRADIUS * 0.99 && d.position.y < DIE_INRADIUS * 1.35),
    world.dice.map((d) => d.position.y.toFixed(3)).join(",")
  );
}

console.log("dice fixtures: 1,000-throw distribution (seeded CSPRNG-shaped)");
{
  const THROWS = 1000;
  const random = seededRandom(20260720);
  const counts: number[][] = [Array(12).fill(0), Array(12).fill(0), Array(12).fill(0)];
  let unsettled = 0;
  let nudgeOverflow = 0;
  let totalElapsed = 0;

  for (let t = 0; t < THROWS; t++) {
    const world = createWorld(undefined, random);
    launch(world, 0.6 + random(), random);
    let guard = 0;
    while (!stepWorld(world, FIXED_STEP * 8, random) && guard++ < 4000) { /* run */ }
    if (!world.settled) {
      unsettled += 1;
      continue;
    }
    totalElapsed += world.elapsed;
    const { readings, nudges } = resolveSettledFaces(world, random);
    if (nudges.some((n) => n > 3)) nudgeOverflow += 1;
    readings.forEach((r, dieIndex) => {
      counts[dieIndex][r.faceIndex] += 1;
    });
  }

  check("all throws settle", unsettled === 0, `${unsettled} unsettled`);
  check("cocked dice resolve within 3 nudges", nudgeOverflow === 0, `${nudgeOverflow} overflows`);
  console.log(`  info mean settle time ${(totalElapsed / (THROWS - unsettled)).toFixed(2)}s`);

  const dieNames = ["planet", "sign", "house"];
  counts.forEach((faceCounts, dieIndex) => {
    const settledThrows = faceCounts.reduce((a, b) => a + b, 0);
    let min = Infinity;
    let max = -Infinity;
    for (const count of faceCounts) {
      const pct = (count / settledThrows) * 100;
      min = Math.min(min, pct);
      max = Math.max(max, pct);
    }
    check(
      `${dieNames[dieIndex]} die: every face within 5–12% (spec §9)`,
      min >= 5 && max <= 12,
      `min ${min.toFixed(2)}% max ${max.toFixed(2)}%`
    );
  });
}

if (failures > 0) {
  throw new Error(`${failures} dice fixture check(s) failed`);
}
console.log("\nall dice fixtures passed");
