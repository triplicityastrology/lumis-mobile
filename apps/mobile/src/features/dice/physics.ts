import { DIE_INRADIUS, DIE_RADIUS, DODECA_FACES, DODECA_VERTICES } from "./geometry";
import { readTopFace, type FaceReading } from "./faceReading";
import {
  add, cross, dot, length, normalize, quatBetween, quatFromAxisAngle, quatMultiply,
  quatNormalize, quatRotate, scale, sub, vec, type Quat, type Vec3
} from "./math";
import { secureRandom, spread, type RandomSource } from "./rng";

/**
 * Purpose-built rigid-body simulation for exactly three dodecahedron dice on a
 * bounded table plane (AC-DICE-01 §4/§5). Pure TypeScript with an injected time
 * step and RNG, so the identical code that runs on-device also runs headless in
 * Node for the 1,000-throw distribution test.
 *
 * Design notes carried over from the validated motion prototype:
 * - Restitution is velocity-dependent: soft contacts don't bounce, so dice never
 *   fidget on the mat after landing (AC-DICE-04 §1.6 settle-calm rule).
 * - Settle-assist damping applies to horizontal velocity and spin only — never
 *   the vertical fall — so dice can never hover.
 * - Release adds CSPRNG torque and impulse jitter per die (spec §5) — exactly the
 *   randomness a real hand imparts.
 */

export type DieBody = {
  position: Vec3;
  velocity: Vec3;
  orientation: Quat;
  angularVelocity: Vec3;
  restSeconds: number;
};

export type Walls = { x: number; zNear: number; zFar: number };

export type DiceWorld = {
  dice: [DieBody, DieBody, DieBody];
  walls: Walls;
  elapsed: number;
  settled: boolean;
};

export const GRAVITY = -16;
export const RESTITUTION = 0.4;
export const SOFT_CONTACT_SPEED = 0.9;
export const FIXED_STEP = 1 / 120;
const INV_INERTIA = 1 / (0.4 * (DIE_RADIUS * 0.8) ** 2);
const REST_SPEED = 0.09;
const REST_SPIN = 0.4;
const REST_HOLD_SECONDS = 0.3;
export const DEFAULT_WALLS: Walls = { x: 1.5, zNear: 1.3, zFar: -0.9 };

export function randomOrientation(random: RandomSource = secureRandom): Quat {
  const axis = normalize(vec(random() * 2 - 1, random() + 0.2, random() * 2 - 1));
  return quatFromAxisAngle(axis, random() * Math.PI * 2);
}

export function createWorld(walls: Walls = DEFAULT_WALLS, random: RandomSource = secureRandom): DiceWorld {
  const makeDie = (): DieBody => ({
    position: vec(0, DIE_INRADIUS, 0),
    velocity: vec(0, 0, 0),
    orientation: randomOrientation(random),
    angularVelocity: vec(0, 0, 0),
    restSeconds: 0
  });
  return { dice: [makeDie(), makeDie(), makeDie()], walls, elapsed: 0, settled: false };
}

/**
 * Hand the dice from palm-space to physics-space (THROW). `strength` is the
 * clamped gesture magnitude in [0.6, 1.6]; tap fallback passes 1.0.
 */
export function launch(world: DiceWorld, strength: number, random: RandomSource = secureRandom): void {
  const s = Math.min(1.6, Math.max(0.6, strength));
  world.dice.forEach((die, i) => {
    die.position = vec((i - 1) * 0.42 + spread(0.12, random), 1.1 + random() * 0.25, 1.15 + spread(0.08, random));
    die.velocity = vec(spread(0.8, random), 2.3 + s * 1.3, -(3.0 + s * 1.4));
    die.angularVelocity = vec(spread(13, random), spread(13, random), spread(13, random));
    die.orientation = randomOrientation(random);
    die.restSeconds = 0;
  });
  world.elapsed = 0;
  world.settled = false;
}

function stepDie(die: DieBody, walls: Walls, h: number): void {
  die.velocity.y += GRAVITY * h;
  die.position = add(die.position, scale(die.velocity, h));
  const spin = length(die.angularVelocity);
  if (spin > 1e-6) {
    die.orientation = quatNormalize(
      quatMultiply(quatFromAxisAngle(scale(die.angularVelocity, 1 / spin), spin * h), die.orientation)
    );
  }

  // Table contact at the deepest vertex, impulse-based with friction.
  let minY = Infinity;
  let contact: Vec3 | null = null;
  for (const v of DODECA_VERTICES) {
    const world = add(quatRotate(die.orientation, v), die.position);
    if (world.y < minY) {
      minY = world.y;
      contact = world;
    }
  }
  if (minY < 0 && contact) {
    die.position.y -= minY;
    const point = vec(contact.x, 0, contact.z);
    const r = sub(point, die.position);
    const contactVel = add(die.velocity, cross(die.angularVelocity, r));
    if (contactVel.y < 0) {
      // Resting contact: a slow, nearly-flat die gets pure vertical support with
      // no impulse torque. Without this, the per-substep gravity impulse at an
      // off-center vertex regenerates spin forever and the die never rests.
      const nearlyFlat = readTopFace(die.orientation).confidence >= 0.86;
      if (nearlyFlat && contactVel.y > -0.35 && length(die.angularVelocity) < 1.4) {
        die.velocity.y = 0;
        die.velocity.x *= 0.9;
        die.velocity.z *= 0.9;
        die.angularVelocity = scale(die.angularVelocity, 0.85);
      } else {
        const n = vec(0, 1, 0);
        const rn = cross(r, n);
        const denom = 1 + INV_INERTIA * dot(cross(rn, r), n);
        const e = contactVel.y < -SOFT_CONTACT_SPEED ? RESTITUTION : 0.05;
        const j = (-(1 + e) * contactVel.y) / denom;
        die.velocity = add(die.velocity, scale(n, j));
        die.angularVelocity = add(die.angularVelocity, scale(cross(r, n), j * INV_INERTIA));
        const tangential = vec(contactVel.x, 0, contactVel.z);
        const tSpeed = length(tangential);
        if (tSpeed > 1e-4) {
          const jt = Math.min(tSpeed * 0.35, j * 0.6);
          const tDir = scale(tangential, -1 / tSpeed);
          die.velocity = add(die.velocity, scale(tDir, jt));
          die.angularVelocity = add(die.angularVelocity, scale(cross(r, tDir), jt * INV_INERTIA));
        }
      }
    }
    die.velocity.x *= 0.996;
    die.velocity.z *= 0.996;
    die.angularVelocity = scale(die.angularVelocity, 0.988);
    // Near rest: bleed residual energy fast so the die never fidgets on the mat.
    if (length(die.velocity) < 0.3 && length(die.angularVelocity) < 1.6) {
      die.velocity = scale(die.velocity, 0.82);
      die.angularVelocity = scale(die.angularVelocity, 0.82);
      if (length(die.velocity) < 0.04 && length(die.angularVelocity) < 0.2) {
        die.velocity = vec(0, 0, 0);
        die.angularVelocity = vec(0, 0, 0);
      }
    }
  }

  // Invisible walls sized to the visible table band; push back only when moving outward.
  if (die.position.x > walls.x && die.velocity.x > 0) { die.position.x = walls.x; die.velocity.x *= -0.4; }
  if (die.position.x < -walls.x && die.velocity.x < 0) { die.position.x = -walls.x; die.velocity.x *= -0.4; }
  if (die.position.z > walls.zNear && die.velocity.z > 0 && die.position.y < 0.8) {
    die.position.z = walls.zNear; die.velocity.z *= -0.4;
  }
  if (die.position.z < walls.zFar && die.velocity.z < 0) { die.position.z = walls.zFar; die.velocity.z *= -0.4; }
  die.angularVelocity = scale(die.angularVelocity, 0.999);
}

function collideDice(world: DiceWorld, random: RandomSource): void {
  const rs = DIE_RADIUS * 0.95;
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      const a = world.dice[i];
      const b = world.dice[j];
      const delta = sub(b.position, a.position);
      const dist = length(delta);
      if (dist < rs * 2 && dist > 1e-4) {
        const n = scale(delta, 1 / dist);
        const pen = rs * 2 - dist;
        a.position = add(a.position, scale(n, -pen / 2));
        b.position = add(b.position, scale(n, pen / 2));
        const rel = dot(sub(b.velocity, a.velocity), n);
        if (rel < 0) {
          const impulse = (-(1 + 0.3) * rel) / 2;
          a.velocity = add(a.velocity, scale(n, -impulse));
          b.velocity = add(b.velocity, scale(n, impulse));
          a.angularVelocity = add(a.angularVelocity, vec(spread(2, random), spread(2, random), spread(2, random)));
          b.angularVelocity = add(b.angularVelocity, vec(spread(2, random), spread(2, random), spread(2, random)));
        }
      }
    }
  }
}

/**
 * Advance the world. Returns true once every die has been at rest for
 * REST_HOLD_SECONDS (spec §5: velocities below epsilon for 300ms).
 */
export function stepWorld(world: DiceWorld, dt: number, random: RandomSource = secureRandom): boolean {
  let remaining = dt;
  while (remaining > 1e-9) {
    const h = Math.min(FIXED_STEP, remaining);
    remaining -= h;
    world.elapsed += h;
    for (const die of world.dice) {
      // Settle assist after 3s — horizontal + spin only, never the fall.
      if (world.elapsed > 3 && die.position.y < 0.9) {
        die.velocity.x *= 0.96;
        die.velocity.z *= 0.96;
        die.angularVelocity = scale(die.angularVelocity, 0.94);
      }
      stepDie(die, world.walls, h);
    }
    collideDice(world, random);
    const allResting = world.dice.every(
      (d) =>
        length(d.velocity) < REST_SPEED &&
        length(d.angularVelocity) < REST_SPIN &&
        d.position.y < DIE_INRADIUS * 1.5
    );
    for (const d of world.dice) d.restSeconds = allResting ? d.restSeconds + h : 0;
    if (world.dice[0].restSeconds >= REST_HOLD_SECONDS) {
      world.settled = true;
      return true;
    }
  }
  return world.settled;
}

export type SettleResult = {
  readings: [FaceReading, FaceReading, FaceReading];
  /** Nudge attempts used per die (spec §5 edge case 1; must resolve within 3). */
  nudges: [number, number, number];
};

/**
 * Read the outcome after settle. Cocked dice (confidence < 0.90) get a small
 * nudge impulse and re-settle, up to 3 attempts each; as a last resort the
 * caller may micro-snap (sub-degree, invisible) — the reading returned here is
 * already the post-nudge truth.
 */
export function resolveSettledFaces(world: DiceWorld, random: RandomSource = secureRandom): SettleResult {
  const nudges: [number, number, number] = [0, 0, 0];
  for (let attempt = 0; attempt < 3; attempt++) {
    const cockedIndex = world.dice.findIndex((d) => readTopFace(d.orientation).cocked);
    if (cockedIndex === -1) break;
    const die = world.dice[cockedIndex];
    nudges[cockedIndex] += 1;
    die.velocity = vec(spread(0.35, random), 0.9 + random() * 0.4, spread(0.35, random));
    die.angularVelocity = vec(spread(3, random), spread(3, random), spread(3, random));
    die.restSeconds = 0;
    world.settled = false;
    let guard = 0;
    while (!stepWorld(world, FIXED_STEP * 4, random) && guard++ < 3000) {
      /* re-settle */
    }
  }
  // Last resort: micro-snap any still-cocked die exactly flat (invisible, sub-degree in practice).
  for (const die of world.dice) {
    const reading = readTopFace(die.orientation);
    if (reading.cocked) {
      const normal = quatRotate(die.orientation, DODECA_FACES[reading.faceIndex].normal);
      die.orientation = quatNormalize(quatMultiply(quatBetween(normal, vec(0, 1, 0)), die.orientation));
      groundDie(die);
    }
  }
  const readings = world.dice.map((d) => readTopFace(d.orientation)) as SettleResult["readings"];
  return { readings, nudges };
}

/** Drop a die straight down so its lowest vertex touches y = 0. */
export function groundDie(die: DieBody): void {
  let minY = Infinity;
  for (const v of DODECA_VERTICES) {
    const y = quatRotate(die.orientation, v).y + die.position.y;
    if (y < minY) minY = y;
  }
  die.position.y -= minY;
}
