import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { CHART_WORKER_CONTRACT } from "@lumis/astrology";
import {
  PERSONA_STYLES,
  PRODUCT_TERMS,
  PRODUCTS,
  ROUTE_CREDITS,
  type ChartV2,
  type PersonaStyleKey
} from "@lumis/shared";

import {
  prepareChartProfileRequest,
  submitChartProfile,
  validateBirthProfileForm,
  type BirthProfileForm,
  type ChartProfileResult
} from "./src/services/profile";

const highlightRoutes = ROUTE_CREDITS.filter((route) =>
  ["casual", "dice", "astro_deep"].includes(route.route)
);

type ProfileData = BirthProfileForm;

export default function App() {
  const [screen, setScreen] = useState<"home" | "profile" | "preview" | "persona">("home");
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [personaStyle, setPersonaStyle] = useState<PersonaStyleKey>("acceptance");

  if (screen === "profile") {
    return (
      <ProfileFormScreen
        onBack={() => setScreen("home")}
        onContinue={(nextProfileData) => {
          setProfileData(nextProfileData);
          setScreen("preview");
        }}
      />
    );
  }

  if (screen === "preview" && profileData) {
    return (
      <ChartPreviewScreen
        profileData={profileData}
        onBack={() => setScreen("profile")}
        onStartOver={() => setScreen("home")}
        onContinuePersona={() => setScreen("persona")}
      />
    );
  }

  if (screen === "persona" && profileData) {
    return (
      <PersonaStyleScreen
        name={profileData.name}
        selectedStyle={personaStyle}
        onSelectStyle={setPersonaStyle}
        onBack={() => setScreen("preview")}
        onStartOver={() => setScreen("home")}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View style={styles.wordmark}>
            <LumisLogo size={38} />
            <View>
              <Text style={styles.wordmarkTitle}>{PRODUCT_TERMS.appName}</Text>
              <Text style={styles.wordmarkSub}>星伴 Lumis</Text>
            </View>
          </View>
          <View style={styles.creditPill}>
            <Text style={styles.creditPillText}>50 credits</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroOrb}>
            <LumisLogo size={134} />
          </View>
          <Text style={styles.kicker}>Not just a horoscope.</Text>
          <Text style={styles.title}>Meet Lumis, your inner universe.</Text>
          <Text style={styles.body}>
            A private astrology companion shaped by your birth chart, your questions, and the way
            you want to be met.
          </Text>
          <View style={styles.heroActions}>
            <Pressable style={styles.primaryButton} onPress={() => setScreen("profile")}>
              <Text style={styles.primaryButtonText}>Create my chart</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Explore demo</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartArt}>
            <ChartWheel />
          </View>
          <View style={styles.chartCopy}>
            <Text style={styles.sectionEyebrow}>Birth chart profile</Text>
            <Text style={styles.cardTitle}>Your Lumis Persona begins here.</Text>
            <Text style={styles.cardBody}>
              Add birth date, time, and place to generate a chart profile before the first chat.
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>星伴相處模式</Text>
          <Text style={styles.sectionSub}>Choose how Lumis responds.</Text>
        </View>
        <View style={styles.personaList}>
          {PERSONA_STYLES.map((style, index) => (
            <View key={style.key} style={[styles.personaCard, index === 0 && styles.personaCardActive]}>
              <View style={styles.personaIcon}>
                <Text style={styles.personaIconText}>{index + 1}</Text>
              </View>
              <View style={styles.personaText}>
                <Text style={styles.personaName}>{style.labelEn}</Text>
                <Text style={styles.personaZh}>{style.labelZh}</Text>
              </View>
              {index === 0 ? <Text style={styles.selectedMark}>Selected</Text> : null}
            </View>
          ))}
        </View>

        <View style={styles.quickGrid}>
          {highlightRoutes.map((route) => (
            <View key={route.route} style={styles.quickCard}>
              <Text style={styles.quickTitle}>{route.label}</Text>
              <Text style={styles.quickMeta}>
                {route.credits} {PRODUCT_TERMS.credits}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.planStrip}>
          <Text style={styles.planTitle}>Lumis plans</Text>
          <Text style={styles.planBody}>
            {PRODUCTS[1].name} HK${PRODUCTS[1].priceHkd} · {PRODUCTS[2].name} HK$
            {PRODUCTS[2].priceHkd}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileFormScreen({
  onBack,
  onContinue
}: {
  onBack: () => void;
  onContinue: (profileData: ProfileData) => void;
}) {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [birthPlace, setBirthPlace] = useState("");
  const [error, setError] = useState("");

  function handleContinue() {
    const nextProfileData = {
      name: name.trim(),
      birthDate: birthDate.trim(),
      birthTime: timeUnknown ? "" : birthTime.trim(),
      timeUnknown,
      birthPlace: birthPlace.trim()
    };

    const validation = validateBirthProfileForm(nextProfileData);

    if (!validation.isValid) {
      setError(validation.message ?? "Please check the birth details before continuing.");
      return;
    }

    setError("");
    onContinue(nextProfileData);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileTopBar}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <View style={styles.formStepPill}>
            <Text style={styles.formStepText}>Profile 1 of 3</Text>
          </View>
        </View>

        <View style={styles.formHero}>
          <View style={styles.formLogo}>
            <LumisLogo size={84} />
          </View>
          <Text style={styles.kicker}>Birth chart profile</Text>
          <Text style={styles.formTitle}>Create your Lumis Persona.</Text>
          <Text style={styles.formIntro}>
            Lumis needs accurate birth details to calculate your chart. This is the first step
            before chart generation and chat.
          </Text>
        </View>

        <View style={styles.formPanel}>
          <FormField
            label="Display name"
            value={name}
            onChangeText={setName}
            placeholder="Ruby"
          />
          <FormField
            label="Birth date"
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="YYYY-MM-DD"
          />
          <FormField
            label="Birth time"
            value={birthTime}
            onChangeText={setBirthTime}
            placeholder="HH:MM"
            editable={!timeUnknown}
          />
          <Pressable
            style={[styles.toggleRow, timeUnknown && styles.toggleRowActive]}
            onPress={() => setTimeUnknown((current) => !current)}
          >
            <View style={[styles.toggleBox, timeUnknown && styles.toggleBoxActive]}>
              <Text style={styles.toggleCheck}>{timeUnknown ? "✓" : ""}</Text>
            </View>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>I do not know my birth time</Text>
              <Text style={styles.toggleBody}>Lumis can still generate a lower-precision chart.</Text>
            </View>
          </Pressable>
          <FormField
            label="Birth place"
            value={birthPlace}
            onChangeText={setBirthPlace}
            placeholder="Hong Kong"
          />
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Next technical step</Text>
          <Text style={styles.noticeBody}>
            This form will connect to the signed Cloudflare chart worker, then save the generated
            chart profile into Supabase.
          </Text>
        </View>

        <Pressable style={styles.fullPrimaryButton} onPress={handleContinue}>
          <Text style={styles.fullPrimaryButtonText}>Continue to chart preview</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChartPreviewScreen({
  profileData,
  onBack,
  onStartOver,
  onContinuePersona
}: {
  profileData: ProfileData;
  onBack: () => void;
  onStartOver: () => void;
  onContinuePersona: () => void;
}) {
  const [chartResult, setChartResult] = useState<ChartProfileResult | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const preparedRequest = prepareChartProfileRequest(profileData);
  const chartDraft = preparedRequest.payload;
  const location = preparedRequest.location;
  const previewValidation = validateBirthProfileForm(profileData);
  const canGenerate = previewValidation.isValid && !isSubmitting;

  async function handleGenerateChartProfile() {
    if (!previewValidation.isValid) {
      setSubmitError(previewValidation.message ?? "Please edit the birth details before generating.");
      return;
    }

    setSubmitError("");
    setIsSubmitting(true);

    try {
      const result = await submitChartProfile(profileData);
      setChartResult(result);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to prepare chart request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileTopBar}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <View style={styles.formStepPill}>
            <Text style={styles.formStepText}>Profile 2 of 3</Text>
          </View>
        </View>

        <View style={styles.previewHero}>
          <View style={styles.previewWheel}>
            <ChartWheel />
          </View>
          <Text style={styles.kicker}>Chart preview</Text>
          <Text style={styles.formTitle}>Ready to generate {profileData.name}'s chart.</Text>
          <Text style={styles.formIntro}>
            This is the handoff point before Lumis calls the signed chart worker and stores the
            generated chart profile.
          </Text>
        </View>

        <View style={styles.summaryPanel}>
          <SummaryRow label="Display name" value={profileData.name} />
          <SummaryRow label="Birth date" value={profileData.birthDate} />
          <SummaryRow
            label="Birth time"
            value={profileData.timeUnknown ? "Unknown - no birth time precision" : profileData.birthTime}
          />
          <SummaryRow label="Birth place" value={profileData.birthPlace} />
          {location.status === "resolved" ? (
            <>
              <SummaryRow label="Timezone" value={location.timezone} />
              <SummaryRow
                label="Coordinates"
                value={`${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
              />
            </>
          ) : null}
        </View>

        <View style={styles.apiCard}>
          <Text style={styles.noticeTitle}>API payload draft</Text>
          <Text style={styles.apiLine}>POST {CHART_WORKER_CONTRACT.supabaseFunction}</Text>
          <Text style={styles.apiBody}>
            {chartDraft.display_name}, {chartDraft.birth_date},{" "}
            {chartDraft.time_unknown ? "time unknown" : chartDraft.birth_time}, {chartDraft.place_name}
            {location.status === "resolved" ? `, ${location.timezone}` : ""} → signed Cloudflare
            worker {CHART_WORKER_CONTRACT.endpoint} → Supabase chart_v2
          </Text>
        </View>

        {!previewValidation.isValid ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>
              {previewValidation.message ?? "Please edit the birth details before generating."}
            </Text>
          </View>
        ) : null}

        {chartResult ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>
              {chartResult.mode === "supabase" ? "Chart request submitted" : "Chart request prepared"}
            </Text>
            <Text style={styles.successBody}>
              {chartResult.mode === "supabase"
                ? "Supabase accepted the profile request. Next we will store and render the returned chart profile."
                : chartResult.message}
            </Text>
          </View>
        ) : null}

        {chartResult?.mode === "local" ? (
          <ChartRevealPanel
            chart={chartResult.chart}
            name={profileData.name}
            onContinuePersona={onContinuePersona}
          />
        ) : null}

        {submitError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{submitError}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.fullPrimaryButton, !canGenerate && styles.disabledButton]}
          onPress={handleGenerateChartProfile}
          disabled={!canGenerate}
        >
          <Text style={styles.fullPrimaryButtonText}>
            {isSubmitting ? "Preparing chart request..." : "Generate chart profile"}
          </Text>
        </Pressable>
        <Pressable style={styles.ghostButton} onPress={onStartOver}>
          <Text style={styles.ghostButtonText}>Start over</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChartRevealPanel({
  chart,
  name,
  onContinuePersona
}: {
  chart: ChartV2;
  name: string;
  onContinuePersona: () => void;
}) {
  const sun = chart.planets.find((planet) => planet.key === "sun");
  const moon = chart.planets.find((planet) => planet.key === "moon");
  const ascendant = chart.angles.ascendant;

  return (
    <View style={styles.revealPanel}>
      <View style={styles.revealHeader}>
        <View style={styles.revealWheel}>
          <ChartWheel />
        </View>
        <View style={styles.revealHeaderText}>
          <Text style={styles.sectionEyebrow}>Chart profile ready</Text>
          <Text style={styles.revealTitle}>{name}'s Lumis Persona seed</Text>
          <Text style={styles.revealBody}>
            {chart.precision === "full"
              ? "Fixture chart shown until the real Cloudflare worker returns chart_v2."
              : "No birth time selected. Houses and Ascendant stay lower precision until exact time is added."}
          </Text>
        </View>
      </View>

      <View style={styles.bigThreeGrid}>
        <BigThreeCard label="Sun" value={sun ? `${sun.sign} ${sun.degree}°` : "Pending"} />
        <BigThreeCard label="Moon" value={moon ? `${moon.sign} ${moon.degree}°` : "Pending"} />
        <BigThreeCard
          label="Rising"
          value={ascendant ? `${ascendant.sign} ${ascendant.degree}°` : "Unknown"}
        />
      </View>

      <View style={styles.precisionPill}>
        <Text style={styles.precisionText}>
          Precision: {chart.precision === "full" ? "Full chart" : "No birth time"}
        </Text>
      </View>

      <Pressable style={styles.fullPrimaryButton} onPress={onContinuePersona}>
        <Text style={styles.fullPrimaryButtonText}>Choose Lumis Persona</Text>
      </Pressable>
    </View>
  );
}

function PersonaStyleScreen({
  name,
  selectedStyle,
  onSelectStyle,
  onBack,
  onStartOver
}: {
  name: string;
  selectedStyle: PersonaStyleKey;
  onSelectStyle: (style: PersonaStyleKey) => void;
  onBack: () => void;
  onStartOver: () => void;
}) {
  const selectedPersona = PERSONA_STYLES.find((style) => style.key === selectedStyle) ?? PERSONA_STYLES[0];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileTopBar}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <View style={styles.formStepPill}>
            <Text style={styles.formStepText}>Profile 3 of 3</Text>
          </View>
        </View>

        <View style={styles.formHero}>
          <View style={styles.formLogo}>
            <LumisLogo size={84} />
          </View>
          <Text style={styles.kicker}>Lumis Persona</Text>
          <Text style={styles.formTitle}>How should Lumis meet {name}?</Text>
          <Text style={styles.formIntro}>
            This sets the first interaction style. It can be changed later from profile settings.
          </Text>
        </View>

        <View style={styles.personaChoiceList}>
          {PERSONA_STYLES.map((style, index) => {
            const isSelected = style.key === selectedStyle;

            return (
              <Pressable
                key={style.key}
                style={[styles.personaChoiceCard, isSelected && styles.personaChoiceCardActive]}
                onPress={() => onSelectStyle(style.key)}
              >
                <View style={styles.personaIcon}>
                  <Text style={styles.personaIconText}>{index + 1}</Text>
                </View>
                <View style={styles.personaText}>
                  <Text style={styles.personaName}>
                    {style.labelEn} / {style.labelZh}
                  </Text>
                  <Text style={styles.personaPromise}>{style.promiseEn}</Text>
                  <Text style={styles.personaPromiseZh}>{style.promiseZh}</Text>
                </View>
                {isSelected ? <Text style={styles.selectedMark}>Selected</Text> : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.completionCard}>
          <Text style={styles.noticeTitle}>Profile setup checkpoint</Text>
          <Text style={styles.noticeBody}>
            {selectedPersona.labelEn} is selected for the first Lumis chat. Next we will save this
            choice to Supabase and open the first chat screen.
          </Text>
        </View>

        <Pressable style={styles.fullPrimaryButton}>
          <Text style={styles.fullPrimaryButtonText}>Enter Lumis chat</Text>
        </Pressable>
        <Pressable style={styles.ghostButton} onPress={onStartOver}>
          <Text style={styles.ghostButtonText}>Start over</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function BigThreeCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.bigThreeCard}>
      <Text style={styles.bigThreeLabel}>{label}</Text>
      <Text style={styles.bigThreeValue}>{value}</Text>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  editable = true
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  editable?: boolean;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, !editable && styles.fieldInputDisabled]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#B2A48F"
        editable={editable}
      />
    </View>
  );
}

function LumisLogo({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx="60" cy="60" r="44" fill="none" stroke="#B4863F" strokeWidth="1.8" opacity="0.72" />
      <Circle cx="60" cy="60" r="25" fill="none" stroke="#5B63B7" strokeWidth="1.55" opacity="0.72" />
      <Circle cx="66.6" cy="21.4" r="7" fill="#D2A24F" />
      <SvgText
        x="60"
        y="68"
        textAnchor="middle"
        fontSize="28"
        fontWeight="600"
        fill="#B4863F"
      >
        ☉
      </SvgText>
    </Svg>
  );
}

function ChartWheel() {
  return (
    <Svg width={94} height={94} viewBox="0 0 94 94">
      <Circle cx="47" cy="47" r="43" fill="#0F2038" stroke="#D2A24F" strokeWidth="1" opacity="0.96" />
      <Circle cx="47" cy="47" r="30" fill="none" stroke="#EEE0C9" strokeWidth="0.7" opacity="0.62" />
      <Circle cx="47" cy="47" r="17" fill="none" stroke="#8B93D4" strokeWidth="0.8" opacity="0.72" />
      {Array.from({ length: 12 }).map((_, index) => {
        const angle = (Math.PI * 2 * index) / 12;
        const x1 = 47 + Math.cos(angle) * 18;
        const y1 = 47 + Math.sin(angle) * 18;
        const x2 = 47 + Math.cos(angle) * 42;
        const y2 = 47 + Math.sin(angle) * 42;
        return (
          <Line
            key={index}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#EEE0C9"
            strokeWidth="0.55"
            opacity="0.32"
          />
        );
      })}
      <Path d="M28 46 C36 28, 56 30, 66 42 S66 68, 45 69 S22 57, 28 46" fill="none" stroke="#D2A24F" strokeWidth="1.2" />
      <Circle cx="47" cy="47" r="4" fill="#D2A24F" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F3ECE0"
  },
  content: {
    padding: 20,
    paddingBottom: 34,
    gap: 18
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  wordmark: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  wordmarkTitle: {
    color: "#2F2B25",
    fontSize: 17,
    fontWeight: "700"
  },
  wordmarkSub: {
    color: "#8A7659",
    fontSize: 12,
    marginTop: 1
  },
  creditPill: {
    backgroundColor: "rgba(180,134,63,0.12)",
    borderColor: "rgba(180,134,63,0.28)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  creditPillText: {
    color: "#7B5A27",
    fontSize: 12,
    fontWeight: "700"
  },
  hero: {
    alignItems: "center",
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 28,
    borderWidth: 1,
    gap: 12,
    overflow: "hidden",
    paddingHorizontal: 24,
    paddingVertical: 32
  },
  heroOrb: {
    alignItems: "center",
    backgroundColor: "#F3ECE0",
    borderColor: "rgba(180,134,63,0.18)",
    borderRadius: 86,
    borderWidth: 1,
    height: 164,
    justifyContent: "center",
    width: 164
  },
  kicker: {
    color: "#B4863F",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: 8,
    textTransform: "uppercase"
  },
  title: {
    color: "#2F2B25",
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 37,
    maxWidth: 330,
    textAlign: "center"
  },
  body: {
    color: "#6F6252",
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 340,
    textAlign: "center"
  },
  heroActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8
  },
  primaryButton: {
    backgroundColor: "#2F2B25",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 13
  },
  primaryButtonText: {
    color: "#FBF7EE",
    fontSize: 14,
    fontWeight: "700"
  },
  secondaryButton: {
    backgroundColor: "rgba(180,134,63,0.13)",
    borderColor: "rgba(180,134,63,0.22)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 13
  },
  secondaryButtonText: {
    color: "#6D4F23",
    fontSize: 14,
    fontWeight: "700"
  },
  chartCard: {
    alignItems: "center",
    backgroundColor: "#10213A",
    borderColor: "rgba(238,224,201,0.18)",
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 15,
    padding: 16
  },
  chartArt: {
    alignItems: "center",
    backgroundColor: "#0B1930",
    borderRadius: 22,
    height: 106,
    justifyContent: "center",
    width: 106
  },
  chartCopy: {
    flex: 1
  },
  sectionEyebrow: {
    color: "#D2A24F",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 6,
    textTransform: "uppercase"
  },
  cardTitle: {
    color: "#F9F0E1",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 23
  },
  cardBody: {
    color: "#CFC6B6",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6
  },
  sectionHeader: {
    gap: 4,
    marginTop: 4
  },
  sectionTitle: {
    color: "#2F2B25",
    fontSize: 22,
    fontWeight: "700"
  },
  sectionSub: {
    color: "#7B6E5F",
    fontSize: 14
  },
  personaList: {
    gap: 10
  },
  personaChoiceList: {
    gap: 12
  },
  personaCard: {
    alignItems: "center",
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 13,
    padding: 15
  },
  personaCardActive: {
    backgroundColor: "rgba(180,134,63,0.08)",
    borderColor: "#B4863F"
  },
  personaIcon: {
    alignItems: "center",
    backgroundColor: "#F1E4C8",
    borderRadius: 16,
    height: 46,
    justifyContent: "center",
    width: 46
  },
  personaIconText: {
    color: "#8B6429",
    fontSize: 15,
    fontWeight: "800"
  },
  personaText: {
    flex: 1
  },
  personaName: {
    color: "#2F2B25",
    fontSize: 16,
    fontWeight: "700"
  },
  personaZh: {
    color: "#8A7659",
    fontSize: 13,
    marginTop: 2
  },
  personaChoiceCard: {
    alignItems: "flex-start",
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 13,
    padding: 16
  },
  personaChoiceCardActive: {
    backgroundColor: "rgba(180,134,63,0.10)",
    borderColor: "#B4863F"
  },
  personaPromise: {
    color: "#6F6252",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6
  },
  personaPromiseZh: {
    color: "#8A7659",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4
  },
  selectedMark: {
    color: "#B4863F",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  quickGrid: {
    flexDirection: "row",
    gap: 10
  },
  quickCard: {
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minHeight: 92,
    padding: 14
  },
  quickTitle: {
    color: "#2F2B25",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18
  },
  quickMeta: {
    color: "#B4863F",
    fontSize: 12,
    fontWeight: "700",
    marginTop: "auto"
  },
  planStrip: {
    backgroundColor: "rgba(91,99,183,0.10)",
    borderColor: "rgba(91,99,183,0.16)",
    borderRadius: 18,
    borderWidth: 1,
    padding: 16
  },
  planTitle: {
    color: "#36366C",
    fontSize: 15,
    fontWeight: "800"
  },
  planBody: {
    color: "#5D5A7C",
    fontSize: 13,
    marginTop: 4
  },
  profileTopBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  backButton: {
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.14)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 10
  },
  backButtonText: {
    color: "#6D4F23",
    fontSize: 13,
    fontWeight: "800"
  },
  formStepPill: {
    backgroundColor: "rgba(91,99,183,0.10)",
    borderColor: "rgba(91,99,183,0.16)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  formStepText: {
    color: "#454286",
    fontSize: 12,
    fontWeight: "800"
  },
  formHero: {
    alignItems: "center",
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 28,
    borderWidth: 1,
    padding: 24
  },
  formLogo: {
    alignItems: "center",
    backgroundColor: "#F3ECE0",
    borderColor: "rgba(180,134,63,0.18)",
    borderRadius: 58,
    borderWidth: 1,
    height: 112,
    justifyContent: "center",
    marginBottom: 14,
    width: 112
  },
  formTitle: {
    color: "#2F2B25",
    fontSize: 29,
    fontWeight: "700",
    lineHeight: 34,
    marginTop: 6,
    textAlign: "center"
  },
  formIntro: {
    color: "#6F6252",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 10,
    textAlign: "center"
  },
  formPanel: {
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 16
  },
  fieldGroup: {
    gap: 7
  },
  fieldLabel: {
    color: "#6D4F23",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  fieldInput: {
    backgroundColor: "#F7F0E3",
    borderColor: "rgba(120,90,40,0.14)",
    borderRadius: 16,
    borderWidth: 1,
    color: "#2F2B25",
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 15,
    paddingVertical: 12
  },
  fieldInputDisabled: {
    opacity: 0.5
  },
  toggleRow: {
    alignItems: "center",
    backgroundColor: "#F7F0E3",
    borderColor: "rgba(120,90,40,0.14)",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14
  },
  toggleRowActive: {
    backgroundColor: "rgba(180,134,63,0.12)",
    borderColor: "rgba(180,134,63,0.30)"
  },
  toggleBox: {
    alignItems: "center",
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.22)",
    borderRadius: 8,
    borderWidth: 1,
    height: 26,
    justifyContent: "center",
    width: 26
  },
  toggleBoxActive: {
    backgroundColor: "#B4863F",
    borderColor: "#B4863F"
  },
  toggleCheck: {
    color: "#FBF7EE",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18
  },
  toggleTextWrap: {
    flex: 1,
    gap: 2
  },
  toggleTitle: {
    color: "#2F2B25",
    fontSize: 14,
    fontWeight: "800"
  },
  toggleBody: {
    color: "#7B6E5F",
    fontSize: 12,
    lineHeight: 17
  },
  errorCard: {
    backgroundColor: "rgba(146,49,36,0.10)",
    borderColor: "rgba(146,49,36,0.24)",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14
  },
  errorText: {
    color: "#923124",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  },
  successCard: {
    backgroundColor: "rgba(52,117,86,0.12)",
    borderColor: "rgba(52,117,86,0.24)",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14
  },
  successTitle: {
    color: "#2F6F50",
    fontSize: 14,
    fontWeight: "800"
  },
  successBody: {
    color: "#3F735A",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5
  },
  noticeCard: {
    backgroundColor: "#10213A",
    borderColor: "rgba(238,224,201,0.18)",
    borderRadius: 20,
    borderWidth: 1,
    padding: 16
  },
  noticeTitle: {
    color: "#F9F0E1",
    fontSize: 15,
    fontWeight: "800"
  },
  noticeBody: {
    color: "#CFC6B6",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6
  },
  fullPrimaryButton: {
    alignItems: "center",
    backgroundColor: "#2F2B25",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 15
  },
  disabledButton: {
    opacity: 0.62
  },
  fullPrimaryButtonText: {
    color: "#FBF7EE",
    fontSize: 15,
    fontWeight: "800"
  },
  previewHero: {
    alignItems: "center",
    backgroundColor: "#10213A",
    borderColor: "rgba(238,224,201,0.18)",
    borderRadius: 28,
    borderWidth: 1,
    padding: 24
  },
  previewWheel: {
    alignItems: "center",
    backgroundColor: "#0B1930",
    borderColor: "rgba(238,224,201,0.12)",
    borderRadius: 66,
    borderWidth: 1,
    height: 132,
    justifyContent: "center",
    marginBottom: 14,
    width: 132
  },
  summaryPanel: {
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden"
  },
  summaryRow: {
    borderTopColor: "rgba(120,90,40,0.12)",
    borderTopWidth: 1,
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  summaryLabel: {
    color: "#8A7659",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  summaryValue: {
    color: "#2F2B25",
    fontSize: 16,
    fontWeight: "700"
  },
  apiCard: {
    backgroundColor: "#10213A",
    borderColor: "rgba(238,224,201,0.18)",
    borderRadius: 20,
    borderWidth: 1,
    padding: 16
  },
  completionCard: {
    backgroundColor: "#10213A",
    borderColor: "rgba(238,224,201,0.18)",
    borderRadius: 20,
    borderWidth: 1,
    padding: 16
  },
  apiLine: {
    color: "#D2A24F",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 8
  },
  apiBody: {
    color: "#CFC6B6",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 5
  },
  ghostButton: {
    alignItems: "center",
    backgroundColor: "rgba(180,134,63,0.11)",
    borderColor: "rgba(180,134,63,0.20)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 15
  },
  ghostButtonText: {
    color: "#6D4F23",
    fontSize: 15,
    fontWeight: "800"
  },
  revealPanel: {
    backgroundColor: "#FBF7EE",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    padding: 16
  },
  revealHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14
  },
  revealWheel: {
    alignItems: "center",
    backgroundColor: "#0B1930",
    borderRadius: 22,
    height: 106,
    justifyContent: "center",
    width: 106
  },
  revealHeaderText: {
    flex: 1
  },
  revealTitle: {
    color: "#2F2B25",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 23
  },
  revealBody: {
    color: "#6F6252",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6
  },
  bigThreeGrid: {
    flexDirection: "row",
    gap: 10
  },
  bigThreeCard: {
    backgroundColor: "#F7F0E3",
    borderColor: "rgba(120,90,40,0.12)",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    minHeight: 78,
    padding: 12
  },
  bigThreeLabel: {
    color: "#8A7659",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  bigThreeValue: {
    color: "#2F2B25",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
    marginTop: 8
  },
  precisionPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(91,99,183,0.10)",
    borderColor: "rgba(91,99,183,0.16)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  precisionText: {
    color: "#454286",
    fontSize: 12,
    fontWeight: "800"
  }
});
