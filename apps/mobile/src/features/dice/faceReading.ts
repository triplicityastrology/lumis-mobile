import { DODECA_FACES } from "./geometry";
import { quatRotate, vec, type Quat } from "./math";

/**
 * Physics-true face reading (AC-DICE-01 §5).
 *
 * Pure function: orientation in → face out. The result is the face whose outward
 * normal has the largest dot-product with world-up. A reading below the 0.90
 * confidence threshold means the die is cocked (leaning on a wall or another die)
 * and the caller must nudge and re-settle (up to 3 attempts) before accepting.
 */
export const COCKED_THRESHOLD = 0.9;

export type FaceReading = {
  faceIndex: number;
  /** dot(face normal, world up) for the winning face; 1.0 = perfectly flat. */
  confidence: number;
  cocked: boolean;
};

const WORLD_UP = vec(0, 1, 0);

export function readTopFace(orientation: Quat): FaceReading {
  let faceIndex = -1;
  let confidence = -2;
  for (let i = 0; i < DODECA_FACES.length; i++) {
    const worldNormal = quatRotate(orientation, DODECA_FACES[i].normal);
    const up = worldNormal.y * WORLD_UP.y + worldNormal.x * WORLD_UP.x + worldNormal.z * WORLD_UP.z;
    if (up > confidence) {
      confidence = up;
      faceIndex = i;
    }
  }
  return { faceIndex, confidence, cocked: confidence < COCKED_THRESHOLD };
}
