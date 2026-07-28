# Navigation Back Context

This document records the current technical rule for the manual Sprint 1
router. It does not replace future production-native navigation.

- Back returns to the immediately preceding in-app screen or context.
- Bottom-tab selection does not add to this Back history.
- A direct or deep entry falls back to Home when no in-app origin exists.
- Past Reflections records whether it opened from Home or Talk.
- Account and Persona screens record whether they opened from Profile or their
  existing direct-flow fallback.
- Notifications records its originating primary tab.
- Care Circle and Birth Details are Profile subflows.
- Dice History and Dice result states close or reset within Dice before leaving
  the primary Dice tab.
- Auth callback, cancellation, and logout behavior remain governed by the Auth
  System States contract rather than generic route history.

The current string-based router still cannot provide native iOS swipe-back.
Adopting a production navigation stack remains separate architecture work.
