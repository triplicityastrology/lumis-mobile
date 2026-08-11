# S2-T297 Founder Dice product-route handoff

## Truthful boundary

The pre-login route renders the signed-off `DiceRitualScreen`. The entire component blob, including JSX, styles, navigation, animation, question entry, roll, result sheet, buttons, history behavior, and customer copy, remains byte-identical to T295.

The current signed-off screen exposes neither a pre-submit validation hook nor an AI-interpretation response slot. The external strip can prove deterministic classification for the exact test bank, but it cannot inject or enforce that result inside product behavior. The route therefore records `SAFE_STOP_DICE_PRE_SUBMIT_INTERFACE_SLOT_NOT_AUTHORIZED` and, after the existing **Reflect in Chat** action, `SAFE_STOP_DICE_INTERPRETATION_INTERFACE_SLOT_NOT_AUTHORIZED`. This is intentionally not claimed as polished end-to-end AI interpretation.

## Founder validation checklist

1. Start the Expo Go route with `pnpm start:s2-t297-dice-polished-expo`.
2. Confirm the screen is the normal celestial **Astrology Dice** product with no build, fixture, classification, or local-test copy inside it.
3. Choose **ZH08 bundled rejection** in the external strip. Confirm the external preflight says `DICE_QUESTION_BUNDLED`. Do not treat the unchanged product screen as enforcing that result; its required hook is not authorized.
4. Choose **ZH09 accepted control**. Confirm the external preflight says `judgment · timing · zh-Hant`. Type it into the unchanged product field, then shake/flick or use the existing tap fallback. The normal result sheet must appear.
5. Use **EN accepted control** and repeat the physical/press roll.
6. Press **Reflect in Chat** only to test the existing handoff boundary. Confirm the external strip reports the interface stop; no AI result is presented as live and no end-to-end interpretation claim is made.
7. Confirm ZH04 is the only excluded Founder draft. All other exact question bytes, including ZH08 and ZH09, remain in the final 20/20 registry.

Browser and Simulator exercise layout and deterministic validation only. Physical motion testing requires Expo Go on an iPhone.

## Commands

- Browser: `pnpm start:s2-t297-dice-polished-web` (`http://localhost:8171`)
- Simulator: `pnpm start:s2-t297-dice-polished-simulator`
- Physical iPhone / Expo Go: `pnpm start:s2-t297-dice-polished-expo`
- Focused proof: `pnpm test:s2-t297-dice-polished-e2e`
