import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Founder branding fix (1/8/2026) — source contract for the seven screens in the
 * branding batch: HOME-002, REFL-001, PROF-001, PROF-003, PROF-005, PROF-006,
 * AUTH-008. Guards the two universal rules (RULE 1 frosted glass, RULE 2 gold
 * gradient), the PROF-003 three-step restructure, and that signed-off behaviour
 * (INS-001 suppression, PROF-002/004, unknown-time gate) is preserved.
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
const frosted = read("apps/mobile/src/components/FrostedCard.tsx");
const brandBtn = read("apps/mobile/src/components/BrandPrimaryButton.tsx");

const ASTRO_GLYPHS = /[♈♉♊♋♌♍♎♏♐♑♒♓☉☽☿♀♂♃♄♅♆♇]/;

/* ---------------- shared branding primitives ---------------- */
// RULE 1: genuine native frosted glass (BlurView + translucent navy overlay).
assert.match(frosted, /from "expo-blur"/, "FrostedCard uses the native blur dependency");
assert.match(frosted, /<BlurView\b/, "FrostedCard layers a real BlurView");
assert.match(frosted, /primary: "rgba\(22,39,61,0\.55\)"/, "primary overlay 55% navy");
assert.match(frosted, /secondary: "rgba\(26,53,80,0\.60\)"/, "secondary overlay 60% navy");
assert.match(frosted, /tertiary: "rgba\(19,35,58,0\.50\)"/, "tertiary overlay 50% navy");
// RULE 2: three-stop gold gradient with dark ink text.
assert.match(brandBtn, /from "expo-linear-gradient"/, "BrandPrimaryButton uses LinearGradient");
assert.match(brandBtn, /\["#C9A96E", "#D7B978", "#E5C58A"\]/, "gold gradient stops");
assert.match(brandBtn, /BRAND_GOLD_INK = "#1A1206"/, "dark ink on gold");

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
// RULE 1/2: frosted cards + gradient Talk CTA.
assert.match(home, /<FrostedCard style=\{styles\.chartCard\}/, "HOME chart card is frosted");
assert.match(home, /<FrostedCard style=\{styles\.reflectionCard\}/, "HOME Past Reflections card is frosted");
assert.match(home, /colors=\{\["#C9A96E", "#D7B978", "#E5C58A"\]\}/, "HOME Talk CTA is the gold gradient");

/* ---------------- REFL-001 Past Reflections ---------------- */
assert.match(app, /function PastReflectionsScreen\(/, "REFL-001 is a routed full-page screen");
assert.match(app, /reflectionsTitle: \{[\s\S]*fontFamily: "Georgia"/, "REFL-001 serif title");
assert.match(app, /<FrostedCard style=\{styles\.reflectionsList\} radius=\{16\}>/, "REFL list is one frosted wrapper");
assert.match(app, /reflectionThreadCard: \{[\s\S]*backgroundColor: "transparent"/, "REFL rows stay transparent");
assert.match(app, /reflectionsSearch: \{[\s\S]*backgroundColor: "transparent"/, "REFL search stays transparent");
assert.match(app, /<FrostedCard style=\{styles\.savedInsightsEmpty\} tier="tertiary"/, "REFL Saved Insights note-tier frosted");
assert.match(app, /<BrandPrimaryButton\s+label="Start a new topic"/, "REFL new-topic is the gold gradient");
// Recently accepted deletion controls preserved.
assert.match(app, /accessibilityLabel=\{`Delete reflection \$\{thread\.title\}`\}/, "REFL row delete control preserved");
assert.match(app, /Delete Past Reflection\?/, "REFL delete confirmation preserved");

/* ---------------- PROF-001 Profile overview ---------------- */
assert.match(profile, /rows: \{ backgroundColor: "transparent" \}/, "PROF-001 group fill delegated to FrostedCard");
assert.match(profile, /<FrostedCard style=\{styles\.rows\} radius=\{18\}>/, "PROF-001 groups are frosted");
assert.match(profile, /rowIcon: \{[\s\S]*backgroundColor: "rgba\(26,53,80,0\.60\)"/, "PROF-001 icon chips translucent secondary");
assert.match(profile, /rowFirst: \{ borderTopWidth: 0 \}/, "PROF-001 first row has no top divider");
assert.match(profile, /heroBadgeText: \{ color: colors\.accent/, "PROF-001 gold hero pill");
assert.doesNotMatch(profile, /Prime member/, "PROF-001 must not fabricate a paid membership claim");
assert.match(profile, /label="Delete account" unavailable/, "PROF-001 keeps Delete account unavailable");
assert.match(profile, /Preview only\. Check-ins and carer links are not active yet\./, "PROF-001 Care Circle stays preview-only");
// Log out stays destructive/warn (not gold).
assert.match(profile, /logoutButton: \{[\s\S]*borderColor: colors\.warnSolid/, "PROF-001 logout stays warn-tinted");

/* ---------------- PROF-003 three-step Edit Birth Details ---------------- */
assert.match(wheel, /const ITEM_HEIGHT = 44/, "PROF-003 44px rows");
assert.match(wheel, /const WHEEL_HEIGHT = 176/, "PROF-003 176px wheel");
assert.match(wheel, /top: \(WHEEL_HEIGHT - ITEM_HEIGHT\) \/ 2/, "PROF-003 selection band vertically centred");
assert.match(wheel, /composeBirthTime12h\(nextHour12, nextMinute/, "PROF-003 time honours hour/minute/AM-PM (no 8am lock)");
assert.match(birth, /const \[editStep, setEditStep\] = useState<1 \| 2 \| 3>\(1\)/, "PROF-003 is a 3-step wizard");
assert.match(birth, /<ProgressDots active=\{editStep\} \/>/, "PROF-003 progress indicator");
assert.match(birth, /When were you born\?/, "PROF-003 step 1 title");
assert.match(birth, /What time were you born\?/, "PROF-003 step 2 title");
assert.match(birth, /Where were you born\?/, "PROF-003 step 3 title");
assert.match(birth, /step === "edit" && editStep > 1[\s\S]{0,180}setEditStep/, "PROF-003 Back steps to the previous step");
assert.match(birth, /<FrostedCard style=\{s\.wheelPanel\}/, "PROF-003 wheels on frosted glass");
assert.match(birth, /<BrandPrimaryButton\s+label="Continue"/, "PROF-003 gradient Continue");
assert.match(birth, /label="Save & regenerate chart"/, "PROF-003 gradient Save & regenerate");
assert.doesNotMatch(birth, /@react-native-community\/datetimepicker/, "PROF-003 no off-design native picker");
assert.match(birth, /Without a birth time, Lumis will not use ASC, MC, houses, or planet-house placements\./, "PROF-003 unknown-time gate preserved");

/* ---------------- PROF-005 Regenerating chart ---------------- */
assert.match(regen, /strokeDasharray="4 7"/, "PROF-005 dashed gold ring");
assert.match(regen, /const RING_SPOKES = Array\.from\(\{ length: 8 \}/, "PROF-005 eight radial spokes");
assert.match(regen, /<Circle cx="75" cy="75" r="5" fill=\{colors\.accent\} \/>/, "PROF-005 centre spark dot");
assert.match(regen, /duration: 12000/, "PROF-005 slow 12s rotation");
assert.doesNotMatch(regen, ASTRO_GLYPHS, "PROF-005 uses no astrology glyphs");
assert.doesNotMatch(regen, /setTimeout/, "PROF-005 never advances steps on a timer");
assert.match(birth, /<RegeneratingView/, "PROF-005 uses the dedicated decorative loader");
assert.doesNotMatch(birth, /GeneratingView/, "PROF-005 does not spin the shared onboarding wheel");

/* ---------------- PROF-006 Updated chart reveal ---------------- */
assert.match(app, /chartRevealTitle: \{[\s\S]*fontFamily: "Georgia"[\s\S]*fontWeight: "500"/, "PROF-006 H1 is display serif 500, not bold sans");
assert.match(app, /chartRevealEyebrow: \{[\s\S]*color: "#D7B978"/, "PROF-006 gold eyebrow");
assert.match(app, /<FrostedCard style=\{styles\.chartRevealWheelPanel\}/, "PROF-006 chart panel frosted");
assert.match(app, /<FrostedCard style=\{styles\.bigThreeCard\} tier="secondary"/, "PROF-006 Sun/Moon cards frosted");
assert.match(app, /<BrandPrimaryButton\s+label=\{ctaLabel\}/, "PROF-006 Back to my Sky is the gold gradient");
assert.match(app, /const ascendant = chart\.precision === "full" \? chart\.angles\.ascendant : undefined/, "PROF-006 no-time suppression preserved");

/* ---------------- AUTH-008 Log out confirmation ---------------- */
assert.match(auth, /<FrostedCard style=\{styles\.dialog\} radius=\{26\}/, "AUTH-008 modal card is frosted");
assert.match(auth, /dialogScrim: \{[\s\S]*backgroundColor: "rgba\(11,25,48,0\.60\)"/, "AUTH-008 translucent navy scrim");
assert.match(auth, /Logging out…/, "AUTH-008 submitting state preserved");
assert.match(auth, /primaryBtnFill: \{[\s\S]*flexDirection: "row"/, "AUTH-008 gradient fill layer present");
for (const phase of ['"confirm" \\| "submitting" \\| "success" \\| "error"', "phase === \"success\"", "phase === \"error\""]) {
  assert.match(auth, new RegExp(phase), `AUTH-008 preserves ${phase} state`);
}

/* ---------------- signed-off screens must not be redesigned ---------------- */
assert.match(natal, /const show = resolveShowHouses\(chart\.precision, showHouses\)/, "INS-001 wheel suppression unchanged");
assert.match(birth, /if \(chart\.precision === "full" && asc\)/, "PROF-002 Big Three keeps Rising gated to full precision");
assert.match(birth, /Regenerate your chart\?/, "PROF-004 confirmation title preserved");
assert.match(birth, /lifetime changes remaining/, "PROF-004 lifetime-limit wording preserved");

console.log("s1t04 seven-screen branding-fix contract checks passed");
