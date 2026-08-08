import Check from "lucide-react-native/icons/check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Clock3 from "lucide-react-native/icons/clock-3";
import LockKeyhole from "lucide-react-native/icons/lock-keyhole";
import MapPin from "lucide-react-native/icons/map-pin";
import Search from "lucide-react-native/icons/search";
import { useEffect, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { isValidBirthDate, runtimeTimeZone } from "@lumis/shared";

import { FlowScreen, flowStyles } from "../components/FlowScreen";
import {
  isValidBirthTime,
  validateBirthProfileForm,
  type BirthProfileForm
} from "../services/profile";
import { colors, radii } from "../theme/tokens";
import { FrostedCard } from "../components/FrostedCard";
import { BrandPrimaryButton } from "../components/BrandPrimaryButton";
import { WheelPicker } from "../features/birthDetails/WheelPicker";

type BirthStep = "date" | "time" | "place";

/* Shared onboarding <-> WheelPicker glue. Onboarding keeps its 'YYYY-MM-DD' and
 * 24-hour 'HH:MM' storage (isValidBirthTime / validateBirthProfileForm expect
 * these); the WheelPicker component is the shared picker used by PROF-003 too. */
function parseIsoDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(1995, 0, 1, 12, 0, 0, 0);
}
function formatIsoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function parseHhmm(value: string): Date {
  const d = new Date(2000, 0, 1, 9, 0, 0, 0);
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}
function formatHhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const PLACE_SUGGESTIONS = ["Hong Kong", "London, UK", "New York, US"];

export function LumisBirthProfileScreen({
  onBack,
  onContinue
}: {
  onBack: () => void;
  onContinue: (profile: BirthProfileForm) => void;
}) {
  const [step, setStep] = useState<BirthStep>("date");
  const [name, setName] = useState("");
  // Wheel pickers always carry a value; seed sensible defaults the user adjusts.
  const [birthDate, setBirthDate] = useState("1995-01-01");
  const [birthTime, setBirthTime] = useState("09:00");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [birthPlace, setBirthPlace] = useState("");
  const [error, setError] = useState("");

  function goBack() {
    setError("");
    if (step === "place") {
      setStep("time");
    } else if (step === "time") {
      setStep("date");
    } else {
      onBack();
    }
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [step, onBack]);

  function continueFromDate() {
    if (!name.trim()) {
      setError("Please enter the name Lumis should use for you.");
      return;
    }
    if (!isValidBirthDate(birthDate.trim(), new Date(), runtimeTimeZone())) {
      // ONB-005: distinguish a date in the future from an impossible date.
      const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate.trim());
      const parsed = parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])) : null;
      const isRealDate =
        parsed != null &&
        parsed.getMonth() === Number(parts![2]) - 1 &&
        parsed.getDate() === Number(parts![3]);
      setError(
        isRealDate && parsed!.getTime() > Date.now()
          ? "Birth date can’t be in the future."
          : "That date doesn’t look right — please check the day."
      );
      return;
    }
    setError("");
    setStep("time");
  }

  function continueFromTime() {
    if (!timeUnknown && !isValidBirthTime(birthTime.trim())) {
      setError("That isn’t a valid time — hours 1–12, minutes 00–59.");
      return;
    }
    setError("");
    setStep("place");
  }

  function continueToPreview() {
    const profile = {
      name: name.trim(),
      birthDate: birthDate.trim(),
      birthTime: timeUnknown ? "" : birthTime.trim(),
      timeUnknown,
      birthPlace: birthPlace.trim()
    };
    const validation = validateBirthProfileForm(profile);
    if (!validation.isValid) {
      // ONB-005 place state: the birthplace is the field resolved on this step.
      setError(
        !profile.birthPlace
          ? "We couldn’t find that place. Try a nearby town or city."
          : validation.message ?? "We couldn’t find that place. Try a nearby town or city."
      );
      return;
    }
    setError("");
    onContinue(profile);
  }

  if (step === "date") return (
    <FlowScreen
      badge="1 OF 3"
      body="Your birth date is the first coordinate Lumis needs to calculate your sky."
      eyebrow="YOUR ARRIVAL"
      onBack={goBack}
      title="When did you arrive?"
    >
      <FrostedCard style={styles.formCard} radius={radii.lg}>
        <Field accessibilityLabel="Display name" label="DISPLAY NAME" value={name} onChangeText={setName} placeholder="Ruby" />
        <Text style={styles.pickerLabel}>BIRTH DATE</Text>
        <WheelPicker
          mode="date"
          value={parseIsoDate(birthDate)}
          onChange={(d) => { setError(""); setBirthDate(formatIsoDate(d)); }}
        />
      </FrostedCard>
      <View style={flowStyles.note}>
        <LockKeyhole color={colors.gold} size={17} />
        <Text style={flowStyles.noteText}>Please double-check — birth details can only be changed a limited number of times.</Text>
      </View>
      {error ? (
        <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={flowStyles.error}>
          <Text style={flowStyles.errorText}><Text style={{ fontWeight: "700" }}>Please check this. </Text>{error}</Text>
        </View>
      ) : null}
      <BrandPrimaryButton label="Continue" onPress={continueFromDate} icon={<ChevronRight color="#3A2218" size={19} />} />
    </FlowScreen>
  );

  if (step === "time") return (
    <FlowScreen
      badge="2 OF 3"
      body="A precise time reveals your Ascendant, MC, and houses. You can continue without it."
      eyebrow="YOUR BIRTH TIME"
      onBack={goBack}
      title="What time were you born?"
    >
      <FrostedCard style={styles.formCard} radius={radii.lg}>
        {!timeUnknown ? (
          <>
            <Text style={styles.pickerLabel}>BIRTH TIME</Text>
            <WheelPicker
              mode="time"
              value={parseHhmm(birthTime)}
              onChange={(d) => { setError(""); setBirthTime(formatHhmm(d)); }}
            />
          </>
        ) : null}
        <Pressable
          accessibilityLabel="I do not know my birth time"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: timeUnknown }}
          style={[styles.toggle, timeUnknown && styles.toggleActive]}
          onPress={() => { setError(""); setTimeUnknown((value) => !value); }}
        >
          <View style={[styles.toggleBox, timeUnknown && styles.toggleBoxActive]}>
            {timeUnknown ? <Check color={colors.navy950} size={14} strokeWidth={3} /> : null}
          </View>
          <View style={styles.flex}>
            <Text style={styles.toggleTitle}>I do not know my birth time</Text>
            <Text style={styles.toggleBody}>Houses, Ascendant, and MC will be hidden.</Text>
          </View>
        </Pressable>
      </FrostedCard>
      {error ? (
        <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={flowStyles.error}>
          <Text style={flowStyles.errorText}><Text style={{ fontWeight: "700" }}>Please check this. </Text>{error}</Text>
        </View>
      ) : null}
      <View style={flowStyles.note}>
        <Clock3 color={colors.gold} size={17} />
        <Text style={flowStyles.noteText}>
          {timeUnknown
            ? "Without a birth time, your Lumis chart won’t include your Rising sign (Ascendant), Midheaven (MC), or houses. Your Sun and Moon placements are still accurate."
            : "Birth time is used to position the chart angles and houses accurately."}
        </Text>
      </View>
      <BrandPrimaryButton label="Continue" onPress={continueFromTime} icon={<ChevronRight color="#3A2218" size={19} />} />
    </FlowScreen>
  );

  const normalizedSearch = birthPlace.trim().toLowerCase();
  const filteredPlaces = PLACE_SUGGESTIONS.filter((place) =>
    !normalizedSearch || place.toLowerCase().includes(normalizedSearch)
  );

  return (
    <FlowScreen
      badge="3 OF 3"
      body="Birthplace lets Lumis resolve the correct coordinates and historical timezone."
      eyebrow="YOUR BIRTHPLACE"
      onBack={goBack}
      title="Where did you arrive?"
    >
      <View style={styles.searchField}>
        <Search color={colors.muted} size={18} />
        <TextInput
          accessibilityLabel="Search birthplace"
          autoCapitalize="words"
          onChangeText={setBirthPlace}
          placeholder="Search city"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          value={birthPlace}
        />
      </View>
      <Text style={styles.suggestionLabel}>SUPPORTED PLACES</Text>
      <View style={styles.placeList}>
        {filteredPlaces.map((place) => {
          const selected = birthPlace === place;
          return (
            <Pressable
              accessibilityLabel={`Choose ${place}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={place}
              onPress={() => setBirthPlace(place)}
              style={[styles.placeRow, selected && styles.placeRowSelected]}
            >
              <View style={styles.placeIcon}><MapPin color={selected ? colors.gold : colors.periwinkle} size={18} /></View>
              <Text style={styles.placeName}>{place}</Text>
              {selected ? <Check color={colors.gold} size={18} strokeWidth={3} /> : null}
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={flowStyles.error}>
          <Text style={flowStyles.errorText}><Text style={{ fontWeight: "700" }}>Please check this. </Text>{error}</Text>
        </View>
      ) : null}
      <View style={flowStyles.note}>
        <LockKeyhole color={colors.gold} size={17} />
        <Text style={flowStyles.noteText}>Used only to calculate and save your Lumis chart profile.</Text>
      </View>
      <BrandPrimaryButton
        label="Create my chart"
        onPress={continueToPreview}
        disabled={!birthPlace.trim()}
        icon={<ChevronRight color="#3A2218" size={19} />}
      />
    </FlowScreen>
  );
}

function Field({
  accessibilityLabel,
  editable = true,
  label,
  onChangeText,
  placeholder,
  value
}: {
  accessibilityLabel: string;
  editable?: boolean;
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={flowStyles.field}>
      <Text style={flowStyles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        style={[flowStyles.input, !editable && styles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        editable={editable}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Glass panel (fill + border owned by FrostedCard); this carries only layout.
  formCard: { gap: 14, padding: 16 },
  pickerLabel: { color: colors.muted, fontSize: 10.5, fontWeight: "700", letterSpacing: 1.4, marginBottom: -4, marginTop: 2 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderRadius: radii.md, backgroundColor: "rgba(78,100,142,0.40)", borderWidth: 1, borderColor: colors.line },
  toggleActive: { backgroundColor: colors.goldFill, borderColor: colors.gold },
  toggleBox: { width: 23, height: 23, borderRadius: 7, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.muted },
  toggleBoxActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  flex: { flex: 1 },
  toggleTitle: { color: colors.ice, fontSize: 12.5, fontWeight: "700" },
  toggleBody: { color: colors.muted, fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  inputDisabled: { opacity: 0.4 },
  searchField: { alignItems: "center", backgroundColor: "rgba(58,80,118,0.42)", borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, flexDirection: "row", gap: 9, minHeight: 54, paddingHorizontal: 15 },
  searchInput: { color: colors.ice, flex: 1, fontSize: 15, minHeight: 52 },
  suggestionLabel: { color: colors.muted, fontSize: 9.5, fontWeight: "700", letterSpacing: 1.4, marginTop: 4 },
  placeList: { borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, overflow: "hidden" },
  placeRow: { alignItems: "center", backgroundColor: "rgba(58,80,118,0.42)", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 11, minHeight: 58, paddingHorizontal: 13 },
  placeRowSelected: { backgroundColor: colors.goldFill },
  placeIcon: { alignItems: "center", backgroundColor: colors.periwinkleFill, borderRadius: 8, height: 34, justifyContent: "center", width: 34 },
  placeName: { color: colors.ice, flex: 1, fontSize: 13.5, fontWeight: "600" }
});
