import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Founder rework pack (1/8/2026) — source contract for the six screens that were
 * "Claude Design is Fine / Codex Failed and ReWorking": HOME-002, AUTH-005,
 * REFL-001, PROF-001, PROF-003, PROF-005. Also guards that the three signed-off
 * screens (INS-001, PROF-002, PROF-004) were not redesigned, and that unknown-
 * time restrictions and inert previews are preserved.
 */
const read = (path) => readFileSync(path, "utf8");

const home = read("apps/mobile/src/screens/LumisHomeScreen.tsx");
const profile = read("apps/mobile/src/screens/LumisProfileScreen.tsx");
const auth = read("apps/mobile/src/components/AuthSystemKit.tsx");
const app = read("apps/mobile/App.tsx");
const birth = read("apps/mobile/src/features/birthDetails/BirthDetailsChangeScreen.tsx");
const wheel = read("apps/mobile/src/features/birthDetails/WheelPicker.tsx");
const regen = read("apps/mobile/src/features/birthDetails/RegeneratingView.tsx");
const natal = read("apps/mobile/src/components/NatalWheel.tsx");
const tokens = read("apps/mobile/src/theme/tokens.ts");

const ASTRO_GLYPHS = /[♈♉♊♋♌♍♎♏♐♑♒♓☉☽☿♀♂♃♄♅♆♇]/;

/* ---------------- exact SPEC navy tokens ---------------- */
assert.match(tokens, /accent: "#D7B978"/, "accent gold token present");
assert.match(tokens, /surface3: "#13233A"/, "surface-3 token present");
assert.match(tokens, /goodSolid: "#7BC784"/, "success green token present");
assert.match(tokens, /warnSolid: "#E38E7C"/, "warn token present");

/* ---------------- HOME-002 Restored Home ---------------- */
assert.match(home, /✦ YOUR INNER UNIVERSE/, "HOME eyebrow keeps the gold star");
assert.match(home, /<Text style=\{styles\.brand\}>Lumis<\/Text>/, "HOME shows the Lumis wordmark brand-mark");
assert.doesNotMatch(home, /import Sparkles/, "HOME drops the decorative sparkle avatar");
assert.match(
  home,
  /const rising = props\.chart\.precision === "full" \? findPoint\(props\.chart, "ascendant"\) : undefined/,
  "HOME Rising is shown only for a full-precision (timed) chart",
);
assert.match(home, /styles\.notifBadge/, "HOME renders the inert notification badge");
assert.match(home, /statusText: \{ flex: 1, color: colors\.goodSolid/, "HOME footer save status uses the SPEC green");

/* ---------------- AUTH-005 Restored account found ---------------- */
assert.match(auth, /result === "foundChart"/, "AUTH-005 renders on the deliberate reload result");
assert.match(auth, /SECURE ACCOUNT/, "AUTH-005 secure-account pill");
assert.match(auth, /✦ PRIVATE BY DESIGN/, "AUTH-005 eyebrow");
assert.match(auth, /Your Lumis account/, "AUTH-005 title");
assert.match(auth, /Chart and reflections found/, "AUTH-005 confirmation card");
assert.match(auth, /<NatalWheel chart=\{chart\} size=\{130\} showHouses=\{false\}/, "AUTH-005 decorative 130 wheel, houses hidden");
assert.match(auth, /authLockNote: \{[\s\S]*backgroundColor: colors\.surface3/, "AUTH-005 lock note uses surface-3");
assert.match(auth, /<PrimaryButton label="Continue to Lumis" onPress=\{onGoChat\} \/>/, "AUTH-005 primary continues to Lumis");
assert.match(auth, /<SoftButton label="Log out" onPress=\{onLogout\}/, "AUTH-005 soft secondary log out");
// Routing boundary (App.restoreSpace): the card is only reached on a deliberate
// reload; cold-start and failure-Retry go straight to Chat.
assert.match(app, /async function restoreSpace\(origin: "reload" \| "retry" = "reload"\)/, "restoreSpace carries the origin");
assert.match(app, /if \(origin === "retry"\) \{[\s\S]{0,160}setScreen\("chat"\)/, "failure Retry continues straight to Chat");
assert.match(app, /Deliberate reload[\s\S]{0,140}setRestoreResult\("foundChart"\)/, "only a deliberate reload shows the card");

/* ---------------- REFL-001 Past Reflections ---------------- */
assert.match(app, /function PastReflectionsScreen\(/, "REFL-001 is a routed full-page screen");
assert.match(app, /reflectionsTitle: \{[\s\S]*fontFamily: "Georgia"/, "REFL-001 serif title");
assert.match(app, /reflectionsList: \{[\s\S]*backgroundColor: "#16273D"[\s\S]*overflow: "hidden"/, "REFL-001 opaque clipped list wrapper");
assert.match(app, /reflectionThreadCard: \{[\s\S]*backgroundColor: "transparent"/, "REFL-001 rows stay transparent");
assert.match(app, /reflectionsSearch: \{[\s\S]*backgroundColor: "transparent"/, "REFL-001 search stays transparent");
assert.match(app, /savedInsightsEmpty: \{[\s\S]*backgroundColor: "#13233A"/, "REFL-001 Saved Insights empty uses surface-3");

/* ---------------- PROF-001 Profile overview ---------------- */
assert.match(profile, /rows: \{ backgroundColor: colors\.surface,[\s\S]*borderRadius: 18[\s\S]*overflow: "hidden"/, "PROF-001 solid clipped group");
assert.match(profile, /rowIcon: \{[\s\S]*backgroundColor: colors\.surfaceRaised/, "PROF-001 gold-on-navy icon chips");
assert.match(profile, /rowFirst: \{ borderTopWidth: 0 \}/, "PROF-001 first row has no top divider");
assert.match(profile, /heroBadgeText: \{ color: colors\.accent/, "PROF-001 gold hero pill");
assert.doesNotMatch(profile, /Prime member/, "PROF-001 must not fabricate a paid membership claim");
assert.match(profile, /label="Delete account" unavailable/, "PROF-001 keeps Delete account unavailable");
assert.match(profile, /Preview only\. Check-ins and carer links are not active yet\./, "PROF-001 Care Circle stays preview-only");

/* ---------------- PROF-003 Edit Birth Details wheel ---------------- */
assert.match(wheel, /const ITEM_HEIGHT = 44/, "PROF-003 44px rows");
assert.match(wheel, /const WHEEL_HEIGHT = 176/, "PROF-003 176px wheel");
assert.match(wheel, /top: \(WHEEL_HEIGHT - ITEM_HEIGHT\) \/ 2/, "PROF-003 selection band is vertically centred");
assert.match(wheel, /onMomentumScrollEnd=\{\(event\) => \{[\s\S]{0,140}onIndexChange\(next\)/, "PROF-003 commits the snapped value after momentum");
assert.match(wheel, /onScrollEndDrag=\{\(event\) => \{[\s\S]{0,140}onIndexChange\(next\)/, "PROF-003 commits the snapped value after a drag");
assert.match(wheel, /composeBirthTime12h\(nextHour12, nextMinute/, "PROF-003 time honours hour/minute/AM-PM");
assert.match(birth, /<WheelPicker\b/, "PROF-003 edit sheet uses the design wheel");
assert.doesNotMatch(birth, /@react-native-community\/datetimepicker/, "PROF-003 no longer uses the off-design native picker");
assert.match(birth, /onPress=\{commitPicker\}/, "PROF-003 Done commits the selection");
assert.match(birth, /onPress=\{closePicker\}[\s\S]{0,80}Cancel/, "PROF-003 Cancel dismisses without saving");
assert.match(birth, /style=\{s\.pickerScrim\} onPress=\{closePicker\}/, "PROF-003 scrim dismissal keeps the saved value");
assert.match(birth, /!draft\.timeUnknown \? \(\s*<PickerRow label="Birth time"/, "PROF-003 unknown-time mode hides the time wheel");

/* ---------------- PROF-005 Regenerating chart ---------------- */
assert.match(regen, /strokeDasharray="4 7"/, "PROF-005 dashed gold ring");
assert.match(regen, /const RING_SPOKES = Array\.from\(\{ length: 8 \}/, "PROF-005 eight radial spokes");
assert.match(regen, /<Circle cx="75" cy="75" r="5" fill=\{colors\.accent\} \/>/, "PROF-005 centre dot");
assert.match(regen, /duration: 12000/, "PROF-005 slow 12s rotation");
assert.doesNotMatch(regen, ASTRO_GLYPHS, "PROF-005 uses no astrology glyphs (nothing to become a colour emoji)");
assert.doesNotMatch(regen, /setTimeout/, "PROF-005 never advances steps on a timer");
assert.match(birth, /<RegeneratingView/, "PROF-005 regeneration uses the dedicated decorative loader");
assert.doesNotMatch(birth, /GeneratingView/, "PROF-005 does not spin the shared onboarding chart wheel");

/* ---------------- signed-off screens must not be redesigned ---------------- */
// INS-001: the chart wheel keeps its non-bypassable unknown-time suppression.
assert.match(natal, /const show = resolveShowHouses\(chart\.precision, showHouses\)/, "INS-001 wheel suppression is unchanged");
// PROF-002: Big Three display keeps Rising gated to authoritative timed charts.
assert.match(birth, /if \(chart\.precision === "full" && asc\)/, "PROF-002 Big Three keeps Rising gated to full precision");
// PROF-004: regenerate confirmation + lifetime-limit wording preserved.
assert.match(birth, /Regenerate your chart\?/, "PROF-004 confirmation title preserved");
assert.match(birth, /lifetime changes remaining/, "PROF-004 lifetime-limit wording preserved");

console.log("s1t04 six-screen rework contract checks passed");
