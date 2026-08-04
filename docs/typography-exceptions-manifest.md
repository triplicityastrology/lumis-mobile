# Typography closure — remaining-exceptions manifest (Batch 1)

Records every place deliberately **excluded** from the Codex semantic-typography
migration, and why. The Batch-1 screens and the shared primitives use the bundled
families (`Newsreader-Medium/-SemiBold`, `HankenGrotesk-Regular/-Medium/-SemiBold/
-Bold`, `NotoSerifTC-Medium/-Bold`) via `apps/mobile/src/theme/typography.ts` /
`AppText`, or explicit bundled-family `fontFamily` in local styles.

## Deliberate exceptions

### 1. `apps/mobile/src/features/careCircle/CareCircleScreen.tsx` — NOT migrated
- **State:** 5 `fontFamily: "Georgia"` references remain.
- **Reason:** Technical-owned Care Circle product UI, under active Technical work
  (S2-T166…T171). Per the batch rules, Claude/Fable must not modify Care Circle
  files while Technical is working on them.
- **Required reconciliation (Technical, after integration):** replace each
  `fontFamily: "Georgia"` with `fontFamily: "Newsreader-Medium"` (display serif),
  and route body/label text through the Hanken static weights (see the token
  families in `theme/typography.ts`). Until then, the typography migration is
  **not** globally complete by design.

### 2. Legacy body `Text` on non-Batch-1 screens — intentionally not blanket-defaulted
- **State:** body/label `Text` on screens outside Batch 1 still relies on the
  system sans + `fontWeight` rather than an explicit Hanken static-weight family.
- **Reason:** React Native's `fontWeight` cannot switch between the *static*
  per-weight Hanken families that `expo-font` registers (each weight is its own
  family name). A blanket global default (e.g. `Text.defaultProps` = Hanken
  Regular) would render every `fontWeight: "700"` as regular — an app-wide
  bold→regular **regression**. These are therefore migrated screen-by-screen (to
  the correct weight token) in later batches; they render correctly today.
- **Display serif is already migrated globally:** every `fontFamily: "Georgia"`
  outside CareCircle was migrated to `"Newsreader-Medium"` in the typography
  commit (52 usages / 14 files).

### 3. `apps/mobile/App.tsx` — one `fontFamily: "System"` reference
- **State:** a single non-Batch-1 element explicitly requests the system sans.
- **Reason:** out of Batch-1 scope; left unchanged. Candidate for the same
  screen-by-screen Hanken migration as (2).

## In-scope coverage (Batch 1) — migrated
- Shared: `theme/typography.ts` (semantic scale, exact sizes/weights/line-heights/
  letter-spacing, `MAX_FONT_SCALE = 1.3` Dynamic-Type cap), `components/AppText.tsx`,
  `components/BrandPrimaryButton.tsx` (label = `t.button-label`).
- Screens: SUP-001, AUTH-005, ONB-005, AUTH-013, CHART-001, CHART-004, PERS-003,
  PROF-007 use the tokens / bundled families and the sunrise-gradient primary CTA.
