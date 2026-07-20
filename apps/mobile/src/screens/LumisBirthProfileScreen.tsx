import Check from "lucide-react-native/icons/check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Clock3 from "lucide-react-native/icons/clock-3";
import LockKeyhole from "lucide-react-native/icons/lock-keyhole";
import MapPin from "lucide-react-native/icons/map-pin";
import Search from "lucide-react-native/icons/search";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { isValidBirthDate, runtimeTimeZone } from "@lumis/shared";

import { FlowScreen, flowStyles } from "../components/FlowScreen";
import {
  isValidBirthTime,
  validateBirthProfileForm,
  type BirthProfileForm
} from "../services/profile";
import { colors, radii } from "../theme/tokens";

type BirthStep = "date" | "time" | "place";

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
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
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

  function continueFromDate() {
    if (!name.trim()) {
      setError("Please enter the name Lumis should use for you.");
      return;
    }
    if (!isValidBirthDate(birthDate.trim(), new Date(), runtimeTimeZone())) {
      setError("Please enter a real birth date as YYYY-MM-DD that is not in the future.");
      return;
    }
    setError("");
    setStep("time");
  }

  function continueFromTime() {
    if (!timeUnknown && !isValidBirthTime(birthTime.trim())) {
      setError("Please enter birth time as HH:MM using 24-hour time, or choose unknown time.");
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
      setError(validation.message ?? "Please check your birth details.");
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
      <View style={styles.formCard}>
        <Field accessibilityLabel="Display name" label="DISPLAY NAME" value={name} onChangeText={setName} placeholder="Ruby" />
        <Field accessibilityLabel="Birth date, year month day" label="BIRTH DATE" value={birthDate} onChangeText={setBirthDate} placeholder="YYYY-MM-DD" />
      </View>
      {error ? <View style={flowStyles.error}><Text style={flowStyles.errorText}>{error}</Text></View> : null}
      <Pressable style={flowStyles.primaryButton} onPress={continueFromDate}>
        <Text style={flowStyles.primaryButtonText}>Continue</Text>
        <ChevronRight color={colors.navy950} size={19} />
      </Pressable>
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
      <View style={styles.formCard}>
        <Field accessibilityLabel="Birth time, 24-hour hour and minute" label="BIRTH TIME" value={birthTime} onChangeText={setBirthTime} placeholder="HH:MM" editable={!timeUnknown} />
        <Pressable style={[styles.toggle, timeUnknown && styles.toggleActive]} onPress={() => setTimeUnknown((value) => !value)}>
          <View style={[styles.toggleBox, timeUnknown && styles.toggleBoxActive]}>
            {timeUnknown ? <Check color={colors.navy950} size={14} strokeWidth={3} /> : null}
          </View>
          <View style={styles.flex}>
            <Text style={styles.toggleTitle}>I do not know my birth time</Text>
            <Text style={styles.toggleBody}>Houses, Ascendant, and MC will be hidden.</Text>
          </View>
        </Pressable>
      </View>
      {error ? <View style={flowStyles.error}><Text style={flowStyles.errorText}>{error}</Text></View> : null}
      <View style={flowStyles.note}>
        <Clock3 color={colors.gold} size={17} />
        <Text style={flowStyles.noteText}>
          {timeUnknown
            ? "Lumis will not calculate or discuss your Ascendant, MC, houses, or planet house placements."
            : "Birth time is used to position the chart angles and houses accurately."}
        </Text>
      </View>
      <Pressable style={flowStyles.primaryButton} onPress={continueFromTime}>
        <Text style={flowStyles.primaryButtonText}>Continue</Text>
        <ChevronRight color={colors.navy950} size={19} />
      </Pressable>
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
      {error ? <View style={flowStyles.error}><Text style={flowStyles.errorText}>{error}</Text></View> : null}
      <View style={flowStyles.note}>
        <LockKeyhole color={colors.gold} size={17} />
        <Text style={flowStyles.noteText}>Used only to calculate and save your Lumis chart profile.</Text>
      </View>
      <Pressable
        disabled={!birthPlace.trim()}
        style={[flowStyles.primaryButton, !birthPlace.trim() && flowStyles.disabled]}
        onPress={continueToPreview}
      >
        <Text style={flowStyles.primaryButtonText}>Create my chart</Text>
        <ChevronRight color={colors.navy950} size={19} />
      </Pressable>
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
  formCard: { gap: 16, padding: 16, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  toggle: { flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderRadius: radii.md, backgroundColor: colors.navy900, borderWidth: 1, borderColor: colors.line },
  toggleActive: { backgroundColor: colors.goldFill, borderColor: colors.gold },
  toggleBox: { width: 23, height: 23, borderRadius: 7, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.muted },
  toggleBoxActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  flex: { flex: 1 },
  toggleTitle: { color: colors.ice, fontSize: 12.5, fontWeight: "700" },
  toggleBody: { color: colors.muted, fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  inputDisabled: { opacity: 0.4 },
  searchField: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, flexDirection: "row", gap: 9, minHeight: 54, paddingHorizontal: 15 },
  searchInput: { color: colors.ice, flex: 1, fontSize: 15, minHeight: 52 },
  suggestionLabel: { color: colors.muted, fontSize: 9.5, fontWeight: "700", letterSpacing: 1.4, marginTop: 4 },
  placeList: { borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, overflow: "hidden" },
  placeRow: { alignItems: "center", backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 11, minHeight: 58, paddingHorizontal: 13 },
  placeRowSelected: { backgroundColor: colors.goldFill },
  placeIcon: { alignItems: "center", backgroundColor: colors.periwinkleFill, borderRadius: 8, height: 34, justifyContent: "center", width: 34 },
  placeName: { color: colors.ice, flex: 1, fontSize: 13.5, fontWeight: "600" }
});
