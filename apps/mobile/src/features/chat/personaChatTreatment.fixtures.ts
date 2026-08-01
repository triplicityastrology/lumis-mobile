import { resolvePersonaChatTreatment } from "./personaChatTreatment";

const acceptance = resolvePersonaChatTreatment("acceptance");
equal(acceptance.label, "Acceptance", "Acceptance label");
equal(acceptance.icon, "acceptance", "Acceptance icon");
equal(acceptance.accentColor, "#B8A7E8", "Acceptance purple accent");

const spark = resolvePersonaChatTreatment("spark");
equal(spark.label, "Spark", "Spark label");
equal(spark.icon, "spark", "Spark icon");
equal(spark.accentColor, "#F3C96F", "Spark gold accent");

const awareness = resolvePersonaChatTreatment("awareness");
equal(awareness.icon, "awareness", "Awareness icon");
equal(awareness.accentColor, "#9DD6B7", "Awareness green accent");

for (const treatment of [acceptance, spark, awareness]) {
  truthy(treatment.markerForegroundColor, `${treatment.label} foreground`);
  truthy(treatment.bubbleBackgroundColor, `${treatment.label} bubble background`);
  truthy(treatment.bubbleBorderColor, `${treatment.label} bubble border`);
}

console.log("persona-aware Chat treatment fixtures passed");

function equal(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: assertion failed`);
}

function truthy(value: unknown, label: string) {
  if (!value) throw new Error(`${label}: assertion failed`);
}
