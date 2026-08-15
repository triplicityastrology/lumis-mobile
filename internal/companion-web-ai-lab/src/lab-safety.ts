// Lab safety sub-classification (deterministic).
//
// AC-AI-00 v1.5 §7 distinguishes:
//   - Clear/imminent self-harm risk  -> CRISIS_IMMINENT fixed copy (crisis route, 1 unit).
//   - Ambiguous distress             -> DISTRESS_SAFETY_CHECK fixed copy (warmth + direct check).
// AC-AI-00 §8 also registers ILLEGAL_BOUNDARY (help-to-harm / illegal activity).
//
// The shared T350 classifier (classifyChatRoute) already returns "safety" for explicit
// self-harm markers. This module layers the crisis/distress/illegal DISTINCTION the Lab needs
// so that safety, crisis, out-of-scope and illegal remain separate states (AC-AI-00 §2 invariant).
// These are deterministic keyword rules only — no model, no chain-of-thought.

export type LabSafetyLevel =
  | "crisis_imminent"
  | "distress_safety_check"
  | "illegal_boundary"
  | null;

// Explicit self-harm / imminent risk (maps to CRISIS_IMMINENT).
const SELF_HARM = /(kill myself|killing myself|suicid|end my life|ending my life|take my own life|hurt myself|harm myself|hurting myself|cut myself|自殺|輕生|結束(自己的)?生命|了結(自己|生命)|傷害自己|自殘)/i;

// Ambiguous distress without explicit self-harm intent (maps to DISTRESS_SAFETY_CHECK).
const AMBIGUOUS_DISTRESS = /(hopeless|can'?t go on|cannot go on|no reason to live|no point (in )?living|not worth living|worthless|can'?t cope|cannot cope|breaking down|falling apart|want to disappear|don'?t want to be here|沒有希望|活不下去|撐不下去|沒有意義|想消失|不想活|好想不見)/i;

// Help-to-harm others / illegal activity (maps to ILLEGAL_BOUNDARY).
const ILLEGAL_HARM = /(make a bomb|build a bomb|how to (make|build) (a )?(weapon|explosive|bomb)|hurt (someone|him|her|them|people)|kill (someone|him|her|them|people)|attack (someone|him|her|them)|traffick|launder money|break into|hack (into|someone)|poison (someone|him|her|them)|製造(炸彈|武器|爆炸物)|傷害他人|殺(人|死他|死她)|報復傷害|洗黑錢|非法)/i;

// Returns the highest-priority safety level for the message.
// Priority: immediate personal safety (crisis) > help-to-harm (illegal) > ambiguous distress.
export function labSafetyClassify(message: string): LabSafetyLevel {
  const text = String(message ?? "");
  if (SELF_HARM.test(text)) return "crisis_imminent";
  if (ILLEGAL_HARM.test(text)) return "illegal_boundary";
  if (AMBIGUOUS_DISTRESS.test(text)) return "distress_safety_check";
  return null;
}
