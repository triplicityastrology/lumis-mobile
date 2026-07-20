import { add, cross, dot, normalize, scale, sub, vec, type Vec3 } from "./math";

/**
 * Regular dodecahedron geometry for the three astro dice.
 *
 * Vertices are the standard 20 points (±1,±1,±1) ∪ cyclic perms of (0, ±1/φ, ±φ),
 * scaled so the circumradius equals DIE_RADIUS.
 *
 * IMPORTANT (AC-DICE-04 v1.2 QA): face centers lie along the cyclic permutations of
 * (0, ±φ, ±1) — NOT (0, ±1, ±φ). Getting this wrong selects non-coplanar vertex
 * sets and the die renders as folded triangles instead of flat pentagons.
 */
export const PHI = (1 + Math.sqrt(5)) / 2;
export const DIE_RADIUS = 0.34;
const VERT_SCALE = DIE_RADIUS / Math.sqrt(3);

function buildVertices(): Vec3[] {
  const out: Vec3[] = [];
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      for (const c of [-1, 1]) out.push(vec(a, b, c));
    }
  }
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      out.push(vec(0, a / PHI, b * PHI));
      out.push(vec(a / PHI, b * PHI, 0));
      out.push(vec(a * PHI, 0, b / PHI));
    }
  }
  return out.map((v) => scale(v, VERT_SCALE));
}

export const DODECA_VERTICES: readonly Vec3[] = buildVertices();

function buildFaceDirections(): Vec3[] {
  const out: Vec3[] = [];
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      out.push(normalize(vec(0, a * PHI, b)));
      out.push(normalize(vec(b, 0, a * PHI)));
      out.push(normalize(vec(a * PHI, b, 0)));
    }
  }
  return out;
}

export type DodecaFace = {
  /** Outward unit normal in the die's local frame. */
  normal: Vec3;
  /** Indices into DODECA_VERTICES, wound in order around the pentagon. */
  vertexIndices: readonly number[];
  /** Face centroid in the die's local frame. */
  center: Vec3;
};

function buildFaces(): DodecaFace[] {
  return buildFaceDirections().map((normal) => {
    const ranked = DODECA_VERTICES
      .map((v, i) => ({ score: dot(normalize(v), normal), i }))
      .sort((p, q) => q.score - p.score)
      .slice(0, 5)
      .map((p) => p.i);
    const center = scale(
      ranked.reduce((acc, i) => add(acc, DODECA_VERTICES[i]), vec(0, 0, 0)),
      1 / 5
    );
    const u0 = normalize(sub(DODECA_VERTICES[ranked[0]], center));
    const v0 = cross(normal, u0);
    const wound = [...ranked].sort((i, j) => {
      const pi = sub(DODECA_VERTICES[i], center);
      const pj = sub(DODECA_VERTICES[j], center);
      return Math.atan2(dot(pi, v0), dot(pi, u0)) - Math.atan2(dot(pj, v0), dot(pj, u0));
    });
    return { normal, vertexIndices: wound, center };
  });
}

export const DODECA_FACES: readonly DodecaFace[] = buildFaces();

/** Distance from the die's center to each face plane (rest height when a face is flat on the table). */
export const DIE_INRADIUS = dot(DODECA_FACES[0].center, DODECA_FACES[0].normal);
