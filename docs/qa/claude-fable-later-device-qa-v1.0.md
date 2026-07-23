# AC-QA-06 — Claude Fable Later Device QA List

Version: 1.0  
Last updated: 2026-07-23  
Status: Deferred until suitable physical-device builds and screens are ready  
Owner: QA, with Founder/PM visual approval where noted

These checks are intentionally deferred. Source inspection and automated tests cannot close them.

## Later Device Checks

1. **Natal-wheel visual comparison**
   - Test one trusted full-time chart and one unknown-time chart.
   - Confirm the full-time chart shows planets, 12 houses, ASC, and MC.
   - Confirm ASC is left-aligned without clipping and planet symbols remain readable.
   - Confirm the unknown-time chart shows no ASC, MC, houses, or planet-house information.
   - Compare the result with the approved Claude Fable design and trusted chart values.

2. **Dice layout on smaller iPhones**
   - Confirm `Ready` sits directly below the question.
   - Confirm the button does not cover the hand or dice.
   - Open the keyboard and check that the question and button remain usable.
   - Check clipping, scrolling, and spacing on a smaller iPhone.

3. **Care Circle switch and accessibility**
   - Confirm the reminder switch is vertically centred and not stretched or clipped.
   - Confirm the touch target is comfortable.
   - With VoiceOver, confirm the label and on/off state are announced correctly.
   - This is UI QA only; real reminders and relationships remain backend scope.

4. **Android physical Back behavior**
   - Use the Android system Back button/gesture across tabs, notifications, Profile subpages, auth/persona/preview/reflections, and the root screen.
   - Confirm navigation returns to the intended destination and root Back exits normally.

5. **iOS swipe-back decision and behavior**
   - Current manual screen-state navigation does not provide native interactive swipe-back.
   - Technical must adopt a native navigation stack or PM must explicitly accept visible Back controls for MVP.
   - Test the approved behavior on an iPhone after that decision.

6. **Celestial-background performance and appearance**
   - Navigate repeatedly between Talk, Insights, Dice, and You on an iPhone.
   - Check for pauses, visual kicks, flashing, blank gaps, or distracting animation restarts.
   - Confirm the grouped star pulses remain visually acceptable to Founder/PM.
   - Check device heat and reduced-motion behavior.

## Release Handling

- These items do not block current source development.
- They must remain open in the go-live checklist.
- Do not mark an item passed based only on TypeScript, source-contract tests, web export, or browser preview.
- Record the device model, OS version, build version, result, and evidence when each item is completed.
