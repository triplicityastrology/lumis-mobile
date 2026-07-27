# Chart Preview Branding Finding

Date: 2026-07-27

Owner: Claude/Fable / Claude Design

The beige chart-preview and chart-reveal presentation is a separate visual-design finding. S1-T04-R11 changes account restoration only and deliberately does not redesign these screens.

Current implementation ownership:

- `apps/mobile/App.tsx`
  - `ChartPreviewScreen`
  - `ChartRevealScreen`
  - related `preview*`, `summaryPanel`, and `chartReveal*` styles
- `apps/mobile/src/components/NatalWheel.tsx`
  - chart wheel rendering used by the reveal

Design follow-up should compare these surfaces with the current approved Lumis visual source before changing layout, color, typography, imagery, or motion.
