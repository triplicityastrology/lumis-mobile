# Claude Design Handoff Prompt

Please prepare developer handoff materials for porting the Lumis HTML prototype into an Expo React Native app.

Context:
The technical build will use Expo React Native + TypeScript. We are not embedding the HTML directly; we are rebuilding the screens as native components. The current source-of-truth prototype is:
`Lumis (no frame - standalone).html`

Please provide:

1. Unbundled source if available
- React/component source files before HTML bundling
- CSS/token files
- mock data files
- asset files or asset references

2. Screen inventory
For each screen, list:
- screen name
- purpose
- route/navigation position
- main components
- important states
- CTA behavior
- whether it is P1 or P2

3. Design tokens
Please extract:
- colors
- typography
- font sizes
- spacing scale
- border radii
- shadows
- button styles
- card styles
- input styles
- dark/warm theme rules if any

4. Component list
Please define reusable components:
- ChartWheel
- Lumis avatar
- Persona card
- chart header card
- chat bubble
- dice result card
- paywall plan card
- knowledge bank tile
- profile/settings row

5. Mock data
Please provide structured mock data for:
- natal chart placements
- chart wheel degrees/houses
- big three
- 6-dimension profile summary
- chat examples
- Lumis Persona options
- avatar/name options
- dice history
- pricing/plans
- knowledge bank sample cards

6. Copy/i18n
Please provide all visible text as structured EN / zh-Hant keys, following:
- Lumis / 星伴 Lumis
- Lumis Persona / 星伴相處模式
- Acceptance / 接納
- Spark / 啟發
- Awareness / 覺察
- credits / 運算點數
- Lumis Essential
- Lumis Prime

7. Implementation notes
Please flag anything that must match the prototype exactly, and anything that can be simplified for the first native build.

