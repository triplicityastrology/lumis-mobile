import {
  NATAL_FACT_RULE_VERSION,
  canonicalizeNatalPointKey,
  isCanonicalNatalAngleKey,
  type BirthTimeAvailability,
  type CanonicalNatalPointKey,
  type NatalDerivedFact,
  type NatalFactCapabilityRequirement,
} from "./natal-facts";

export type NatalAspectType =
  | "conjunction"
  | "sextile"
  | "square"
  | "trine"
  | "opposition"
  | "quincunx";

export type NatalAspectPointInput = {
  key: string;
  longitude: number;
  sourceField?: string;
};

export type NatalAspectValue = {
  pointA: CanonicalNatalPointKey;
  pointB: CanonicalNatalPointKey;
  aspect: NatalAspectType;
  separationDegrees: number;
  exactAngleDegrees: number;
  orbDegrees: number;
};

export const NATAL_ASPECT_RULES: ReadonlyArray<{
  type: NatalAspectType;
  angle: number;
  orb: number;
}> = Object.freeze([
  { type: "conjunction", angle: 0, orb: 8 },
  { type: "sextile", angle: 60, orb: 4 },
  { type: "square", angle: 90, orb: 8 },
  { type: "trine", angle: 120, orb: 8 },
  { type: "opposition", angle: 180, orb: 8 },
  { type: "quincunx", angle: 150, orb: 2 },
]);

type CanonicalAspectPoint = {
  key: CanonicalNatalPointKey;
  longitude: number;
  sourceField: string;
};

export function deriveNatalAspects(input: {
  points: readonly NatalAspectPointInput[];
  birthTime: BirthTimeAvailability;
}): NatalDerivedFact<NatalAspectValue>[] {
  const points = canonicalizeAspectPoints(input.points, input.birthTime);
  const facts: NatalDerivedFact<NatalAspectValue>[] = [];

  for (let leftIndex = 0; leftIndex < points.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < points.length; rightIndex += 1) {
      const pointA = points[leftIndex];
      const pointB = points[rightIndex];
      const separationDegrees = circularAngularDistance(
        pointA.longitude,
        pointB.longitude
      );
      const rule = NATAL_ASPECT_RULES.find(
        (candidate) =>
          Math.abs(separationDegrees - candidate.angle) <= candidate.orb
      );

      if (!rule) {
        continue;
      }

      const orbDegrees = normalizeMeasurement(
        Math.abs(separationDegrees - rule.angle)
      );
      const capabilityRequirement: NatalFactCapabilityRequirement =
        isCanonicalNatalAngleKey(pointA.key) ||
        isCanonicalNatalAngleKey(pointB.key)
          ? "birth_time_supplied"
          : "none";
      const value: NatalAspectValue = {
        pointA: pointA.key,
        pointB: pointB.key,
        aspect: rule.type,
        separationDegrees: normalizeMeasurement(separationDegrees),
        exactAngleDegrees: rule.angle,
        orbDegrees,
      };

      facts.push({
        canonicalKey: `natal_aspect:${pointA.key}:${pointB.key}:${rule.type}`,
        value,
        sourceFields: [pointA.sourceField, pointB.sourceField],
        ruleVersion: NATAL_FACT_RULE_VERSION,
        capabilityRequirement,
        derived: true,
        applicable: true,
        reason: "within_approved_natal_aspect_orb",
        provenance: {
          source: "founder_approved_knowledge_bank_v0.2",
          rule: `natal_${rule.type}_${rule.angle}_orb_${rule.orb}`,
        },
      });
    }
  }

  return facts;
}

export function circularAngularDistance(left: number, right: number): number {
  const normalizedLeft = normalizeLongitude(left);
  const normalizedRight = normalizeLongitude(right);

  if (normalizedLeft == null || normalizedRight == null) {
    return Number.NaN;
  }

  const distance = Math.abs(normalizedLeft - normalizedRight);
  return Math.min(distance, 360 - distance);
}

function canonicalizeAspectPoints(
  points: readonly NatalAspectPointInput[],
  birthTime: BirthTimeAvailability
): CanonicalAspectPoint[] {
  const canonicalCandidates = points
    .map((point): CanonicalAspectPoint | null => {
      const key = canonicalizeNatalPointKey(point.key);
      const longitude = normalizeLongitude(point.longitude);

      if (
        !key ||
        longitude == null ||
        (birthTime === "not_supplied" && isCanonicalNatalAngleKey(key))
      ) {
        return null;
      }

      return {
        key,
        longitude,
        sourceField:
          point.sourceField ?? `points.${key}.absoluteLongitude`,
      };
    })
    .filter(isPresent)
    .sort(
      (left, right) =>
        left.key.localeCompare(right.key) ||
        left.longitude - right.longitude ||
        left.sourceField.localeCompare(right.sourceField)
    );

  const uniqueByKey = new Map<CanonicalNatalPointKey, CanonicalAspectPoint>();
  for (const point of canonicalCandidates) {
    if (!uniqueByKey.has(point.key)) {
      uniqueByKey.set(point.key, point);
    }
  }

  return [...uniqueByKey.values()];
}

function normalizeLongitude(longitude: number): number | null {
  if (!Number.isFinite(longitude)) {
    return null;
  }
  return ((longitude % 360) + 360) % 360;
}

function normalizeMeasurement(value: number): number {
  return Number(value.toFixed(10));
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}
