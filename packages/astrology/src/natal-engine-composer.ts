import { deriveNatalAspects, type NatalAspectValue } from "./natal-aspects";
import {
  deriveMoonSignFromLocalDayEndpoints,
  deriveTraditionalChartRuler,
  deriveTraditionalHouseRuler,
  zodiacSignForNatalLongitude,
  type BirthTimeCapabilities,
  type CanonicalNatalBodyKey,
  type CanonicalZodiacSign,
  type NatalDerivedFact,
} from "./natal-facts";
import {
  validateNatalEngineInput,
  type CanonicalNatalEngineInput,
  type NatalInputFailure,
} from "./natal-input-boundary";

export const NATAL_ENGINE_OUTPUT_VERSION = "natal_engine_output_v1" as const;

export type NatalEngineCanonicalFact =
  | NatalDerivedFact<CanonicalZodiacSign>
  | NatalDerivedFact<CanonicalNatalBodyKey>;

export type NatalEngineOutput = {
  schemaVersion: typeof NATAL_ENGINE_OUTPUT_VERSION;
  scope: "natal";
  inputProvenance: CanonicalNatalEngineInput["provenance"];
  capabilities: BirthTimeCapabilities;
  facts: NatalEngineCanonicalFact[];
  aspects: NatalDerivedFact<NatalAspectValue>[];
};

export type NatalEngineCompositionResult =
  | { ok: true; value: NatalEngineOutput }
  | { ok: false; error: NatalInputFailure };

export function composeNatalEngineOutput(
  input: unknown
): NatalEngineCompositionResult {
  const validated = validateNatalEngineInput(input);
  if (!validated.ok) {
    return validated;
  }

  const canonicalInput = validated.value;
  const facts = deriveCanonicalFacts(canonicalInput).sort(compareCanonicalFacts);
  const aspects = deriveNatalAspects({
    points: canonicalInput.points.map((point) => ({
      key: point.key,
      longitude: point.longitude,
      sourceField: point.provenance.sourceFields[1],
    })),
    birthTime: canonicalInput.birthTime,
  }).sort(compareCanonicalFacts);

  return {
    ok: true,
    value: {
      schemaVersion: NATAL_ENGINE_OUTPUT_VERSION,
      scope: "natal",
      inputProvenance: {
        ...canonicalInput.provenance,
        sourceFields: [...canonicalInput.provenance.sourceFields],
      },
      capabilities: { ...canonicalInput.capabilities },
      facts,
      aspects,
    },
  };
}

function deriveCanonicalFacts(
  input: CanonicalNatalEngineInput
): NatalEngineCanonicalFact[] {
  const facts: NatalEngineCanonicalFact[] = [];

  if (input.moonLocalDayEndpoints) {
    facts.push(
      deriveMoonSignFromLocalDayEndpoints({
        startLongitude: input.moonLocalDayEndpoints.startLongitude,
        endLongitude: input.moonLocalDayEndpoints.endLongitude,
        sourceFields: [...input.moonLocalDayEndpoints.provenance.sourceFields],
      })
    );
  }

  const ascendant = input.points.find((point) => point.key === "ascendant");
  const ascendantSign = zodiacSignForNatalLongitude(ascendant?.longitude);
  if (ascendant && ascendantSign) {
    facts.push(
      deriveTraditionalChartRuler({
        ascendantSign,
        birthTime: input.birthTime,
        sourceField: ascendant.provenance.sourceFields[1],
      })
    );
  }

  for (const house of input.houses) {
    const cuspSign = zodiacSignForNatalLongitude(house.cuspLongitude);
    if (!cuspSign) {
      continue;
    }
    facts.push(
      deriveTraditionalHouseRuler({
        house: house.no,
        cuspSign,
        birthTime: input.birthTime,
        sourceField: house.provenance.sourceFields[1],
      })
    );
  }

  return facts;
}

function compareCanonicalFacts(
  left: NatalDerivedFact<unknown>,
  right: NatalDerivedFact<unknown>
): number {
  return left.canonicalKey.localeCompare(right.canonicalKey);
}
