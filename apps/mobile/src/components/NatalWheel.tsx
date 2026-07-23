import Svg, { Circle, Defs, G, Line, RadialGradient, Stop, Text as SvgText } from "react-native-svg";

import type { ChartV2 } from "@lumis/shared";

/**
 * Data-driven natal chart wheel ported from the design handoff (ac-chartwheel.jsx):
 * ASC pinned to the left (9 o'clock), zodiac increasing clockwise; element-colored
 * sign glyphs on the rim; house cusps + numbers; ASC/MC labels; major aspect lines
 * behind planet discs with tick lines; hub sparkle. Pure react-native-svg.
 */

const SIGN_INDEX: Record<string, number> = {
  aries: 0, taurus: 1, gemini: 2, cancer: 3, leo: 4, virgo: 5,
  libra: 6, scorpio: 7, sagittarius: 8, capricorn: 9, aquarius: 10, pisces: 11
};

// U+FE0E forces text (not emoji) rendering of astrological glyphs on iOS.
const VS = "︎";
const SIGN_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"].map((g) => g + VS);
const SIGN_ELEMENT = [
  "fire", "earth", "air", "water", "fire", "earth",
  "air", "water", "fire", "earth", "air", "water"
] as const;
const ELEM_COLOR: Record<string, string> = {
  fire: "#E89B92", earth: "#C7A46A", air: "#8B93D4", water: "#7FA8C9"
};

const PLANET_GLYPHS: Record<string, string> = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂", jupiter: "♃",
  saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇", chiron: "⚷",
  true_node: "☊", south_node: "☋"
};

type Aspect = { a: number; b: number; type: "trine" | "sextile" | "square" | "opposition" };
const ASPECTS: Array<{ type: Aspect["type"]; angle: number; orb: number }> = [
  { type: "opposition", angle: 180, orb: 6 },
  { type: "trine", angle: 120, orb: 6 },
  { type: "square", angle: 90, orb: 5 },
  { type: "sextile", angle: 60, orb: 4 }
];
const ASP_COLOR: Record<Aspect["type"], string> = {
  trine: "#E5C06B", sextile: "#8B93D4", square: "#E89B92", opposition: "#E89B92"
};
const ASP_DASH: Record<Aspect["type"], string | undefined> = {
  trine: undefined, sextile: "2 3", square: "3 3", opposition: "4 3"
};

function lonOf(planet: { sign: string; degree: number; absoluteLongitude?: number }) {
  return planet.absoluteLongitude ?? (SIGN_INDEX[planet.sign.toLowerCase()] ?? 0) * 30 + planet.degree;
}

function separation(a: number, b: number) {
  const diff = Math.abs(((a - b) % 360 + 360) % 360);
  return diff > 180 ? 360 - diff : diff;
}

export function NatalWheel({
  chart,
  size = 300,
  showHouses
}: {
  chart: ChartV2;
  size?: number;
  showHouses?: boolean;
}) {
  const show = showHouses ?? chart.precision === "full";
  const C = size / 2;
  const R_out = size * 0.475;
  const R_sign = size * 0.4;
  const R_house = size * 0.315;
  const R_planet = size * 0.245;
  const R_hub = size * 0.1;

  const ascPlanet = chart.angles.ascendant;
  const asc = ascPlanet ? lonOf(ascPlanet) : 0;
  const mc = chart.angles.mediumCoeli ? lonOf(chart.angles.mediumCoeli) : null;

  // ASC pinned to the left; zodiac increases clockwise.
  const ang = (lon: number) => ((180 - (lon - asc)) * Math.PI) / 180;
  const pt = (lon: number, r: number): [number, number] => [
    C + r * Math.cos(ang(lon)),
    C - r * Math.sin(ang(lon))
  ];
  // SVG text has no reliable central baseline in react-native-svg; nudge y down.
  const baseline = (fontSize: number) => fontSize * 0.34;

  const plotted = chart.planets.filter(
    (planet) => planet.key !== "ascendant" && planet.key !== "medium_coeli"
  );

  // de-collision: nudge display longitude of labels within 8° of each other
  const sorted = [...plotted].sort((a, b) => lonOf(a) - lonOf(b));
  let prev = -99;
  const placed = sorted.map((planet) => {
    let disp = lonOf(planet);
    if (disp - prev < 8) disp = prev + 8;
    prev = disp;
    return { planet, lon: lonOf(planet), disp };
  });

  // major aspects between plotted planets
  const aspects: Aspect[] = [];
  for (let i = 0; i < plotted.length; i += 1) {
    for (let j = i + 1; j < plotted.length; j += 1) {
      const sep = separation(lonOf(plotted[i]), lonOf(plotted[j]));
      const hit = ASPECTS.find((asp) => Math.abs(sep - asp.angle) <= asp.orb);
      if (hit) aspects.push({ a: i, b: j, type: hit.type });
    }
  }

  const houseCusps = show
    ? chart.houses
        .slice()
        .sort((a, b) => a.no - b.no)
        .map((house) => (SIGN_INDEX[house.sign.toLowerCase()] ?? 0) * 30 + house.cuspDegree)
    : [];

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} accessibilityLabel="Natal chart wheel">
      <Defs>
        <RadialGradient id="cw-hub" cx="38%" cy="32%" r="70%">
          <Stop offset="0%" stopColor="rgba(243,203,169,0.22)" />
          <Stop offset="100%" stopColor="rgba(13,27,46,0)" />
        </RadialGradient>
      </Defs>

      {/* rings */}
      <Circle cx={C} cy={C} r={R_out} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={1} />
      <Circle cx={C} cy={C} r={R_sign} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
      {show ? <Circle cx={C} cy={C} r={R_house} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} /> : null}
      <Circle cx={C} cy={C} r={R_hub} fill="url(#cw-hub)" stroke="rgba(243,203,169,0.32)" strokeWidth={1} />

      {/* zodiac sectors + element-colored glyphs */}
      {SIGN_GLYPHS.map((glyph, i) => {
        const L0 = i * 30;
        const [sx, sy] = pt(L0, R_sign);
        const [ex, ey] = pt(L0, R_out);
        const [gx, gy] = pt(L0 + 15, (R_out + R_sign) / 2);
        const fontSize = size * 0.05;
        return (
          <G key={`sign-${i}`}>
            <Line x1={sx} y1={sy} x2={ex} y2={ey} stroke="rgba(255,255,255,0.1)" strokeWidth={0.6} />
            <SvgText
              x={gx}
              y={gy + baseline(fontSize)}
              textAnchor="middle"
              fontSize={fontSize}
              fill={ELEM_COLOR[SIGN_ELEMENT[i]]}
              opacity={0.92}
            >
              {glyph}
            </SvgText>
          </G>
        );
      })}

      {/* house cusps + numbers */}
      {houseCusps.map((cusp, i) => {
        const [x0, y0] = pt(cusp, R_hub);
        const [x1, y1] = pt(cusp, R_house);
        const isAngle = i === 0 || i === 9; // ASC / MC
        const [nx, ny] = pt(cusp + 4, R_hub + (R_house - R_hub) * 0.22);
        const fontSize = size * 0.032;
        return (
          <G key={`house-${i}`}>
            <Line
              x1={x0}
              y1={y0}
              x2={x1}
              y2={y1}
              stroke={isAngle ? "#E5C06B" : "rgba(255,255,255,0.09)"}
              strokeWidth={isAngle ? 1.3 : 0.6}
              opacity={isAngle ? 0.85 : 1}
            />
            <SvgText x={nx} y={ny + baseline(fontSize)} textAnchor="middle" fontSize={fontSize} fill="rgba(234,240,255,0.42)">
              {i + 1}
            </SvgText>
          </G>
        );
      })}

      {/* ASC / MC labels */}
      {show
        ? ([["ASC", asc], mc != null ? ["MC", mc] : null].filter(Boolean) as Array<[string, number]>).map(
            ([label, L]) => {
              const [lx, ly] = pt(L, R_out + size * 0.045);
              const fontSize = size * 0.036;
              return (
                <SvgText
                  key={label}
                  x={lx}
                  y={ly + baseline(fontSize)}
                  textAnchor="middle"
                  fontSize={fontSize}
                  fontWeight="700"
                  fill="#E5C06B"
                >
                  {label}
                </SvgText>
              );
            }
          )
        : null}

      {/* aspect lines (behind planets) */}
      {aspects.map((asp, i) => {
        const [ax, ay] = pt(lonOf(plotted[asp.a]), R_planet - size * 0.02);
        const [bx, by] = pt(lonOf(plotted[asp.b]), R_planet - size * 0.02);
        return (
          <Line
            key={`asp-${i}`}
            x1={ax}
            y1={ay}
            x2={bx}
            y2={by}
            stroke={ASP_COLOR[asp.type]}
            strokeWidth={0.9}
            strokeDasharray={ASP_DASH[asp.type]}
            opacity={0.6}
          />
        );
      })}

      {/* planets: tick line + disc + glyph */}
      {placed.map(({ planet, lon, disp }) => {
        const [tx0, ty0] = pt(lon, R_sign - size * 0.01);
        const [tx1, ty1] = pt(disp, R_planet + size * 0.03);
        const [gx, gy] = pt(disp, R_planet);
        const fontSize = size * 0.05;
        const luminary = planet.key === "sun" || planet.key === "moon";
        return (
          <G key={planet.key}>
            <Line x1={tx0} y1={ty0} x2={tx1} y2={ty1} stroke="#E5C06B" strokeWidth={0.6} opacity={0.4} />
            <Circle cx={gx} cy={gy} r={size * 0.038} fill="#0E1B2E" opacity={0.9} />
            <Circle cx={gx} cy={gy} r={size * 0.038} fill="none" stroke="#E5C06B" strokeWidth={0.9} opacity={0.8} />
            <SvgText
              x={gx}
              y={gy + baseline(fontSize)}
              textAnchor="middle"
              fontSize={fontSize}
              fill={luminary ? "#F3CBA9" : "#E5C06B"}
            >
              {(PLANET_GLYPHS[planet.key] ?? "•") + VS}
            </SvgText>
          </G>
        );
      })}

      {/* hub sparkle */}
      <SvgText x={C} y={C + baseline(size * 0.06)} textAnchor="middle" fontSize={size * 0.06} fill="rgba(255,247,235,0.9)">
        {"✦"}
      </SvgText>
    </Svg>
  );
}
