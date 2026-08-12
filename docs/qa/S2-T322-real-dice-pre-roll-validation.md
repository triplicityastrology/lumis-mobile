# S2-T322 Real Dice Pre-roll Validation

## Founder route

Run `pnpm start:s2-t322-real-dice-preroll-expo`, open the Expo Go project, and select the Dice fixture cases from the external Founder strip.

1. Enter `hi`. Ready stays on the Dice question state and shows the clear-question guidance. No animation starts.
2. Enter ZH08 exactly: `我個application 會唔會批？幾時會批？`. It shows the one-question guidance before the roll.
3. Enter ZH09 exactly: `我個application幾時會批？`. It proceeds through the established roll.
4. Try a professional, safety, or excluded-scope question. Each remains on the question state with action-specific guidance.
5. After a rejected question, edit it. The stale message clears immediately and cannot apply to the edited text.
6. Repeat at the largest Dynamic Type setting with the keyboard visible. Guidance wraps below the existing Ready action without covering the dice.

The Founder strip is outside product pixels. The route is deterministic and local: provider calls, persistence, history/session writes, units, and navigation are all zero for rejected questions. No remote success is claimed.

## Boundaries

- The ordinary product accepts deterministically supported questions.
- Founder fixture routes additionally require exact membership and exact text in the sealed 20 EN/20 zh-Hant registry.
- Only ZH04 is excluded. ZH08 remains the bundled rejection and ZH09 the accepted single-question control.
- Dice animation, three-result presentation, interpretation card, Roll again, and explicit Reflect in Chat remain unchanged.
