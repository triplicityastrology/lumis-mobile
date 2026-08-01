export type PersonaChatIcon = "acceptance" | "spark" | "awareness";
export type PersonaChatStyle = "acceptance" | "spark" | "awareness";

export type PersonaChatTreatment = {
  accentColor: string;
  bubbleBackgroundColor: string;
  bubbleBorderColor: string;
  icon: PersonaChatIcon;
  label: string;
  markerForegroundColor: string;
};

const PERSONA_CHAT_TREATMENTS: Record<PersonaChatStyle, PersonaChatTreatment> = {
  acceptance: {
    accentColor: "#B8A7E8",
    bubbleBackgroundColor: "rgba(184,167,232,0.13)",
    bubbleBorderColor: "rgba(184,167,232,0.34)",
    icon: "acceptance",
    label: "Acceptance",
    markerForegroundColor: "#11152A",
  },
  spark: {
    accentColor: "#F3C96F",
    bubbleBackgroundColor: "rgba(243,201,111,0.12)",
    bubbleBorderColor: "rgba(243,201,111,0.34)",
    icon: "spark",
    label: "Spark",
    markerForegroundColor: "#151109",
  },
  awareness: {
    accentColor: "#9DD6B7",
    bubbleBackgroundColor: "rgba(157,214,183,0.12)",
    bubbleBorderColor: "rgba(157,214,183,0.34)",
    icon: "awareness",
    label: "Awareness",
    markerForegroundColor: "#0B1813",
  },
};

export function resolvePersonaChatTreatment(
  persona: PersonaChatStyle
): PersonaChatTreatment {
  return PERSONA_CHAT_TREATMENTS[persona];
}
