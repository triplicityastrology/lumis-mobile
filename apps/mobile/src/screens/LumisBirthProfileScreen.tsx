import { Check, ChevronRight, LockKeyhole } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { FlowScreen, flowStyles } from "../components/FlowScreen";
import { validateBirthProfileForm, type BirthProfileForm } from "../services/profile";
import { colors, radii } from "../theme/tokens";

export function LumisBirthProfileScreen({
  onBack,
  onContinue
}: {
  onBack: () => void;
  onContinue: (profile: BirthProfileForm) => void;
}) {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [birthPlace, setBirthPlace] = useState("");
  const [error, setError] = useState("");

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

  return (
    <FlowScreen
      badge="1 OF 3"
      body="Accurate details help Lumis calculate the sky you arrived with."
      eyebrow="YOUR BIRTH CHART"
      onBack={onBack}
      title="Tell Lumis when you arrived."
    >
      <View style={styles.formCard}>
        <Field label="DISPLAY NAME" value={name} onChangeText={setName} placeholder="Ruby" />
        <Field label="BIRTH DATE" value={birthDate} onChangeText={setBirthDate} placeholder="YYYY-MM-DD" />
        <Field label="BIRTH TIME" value={birthTime} onChangeText={setBirthTime} placeholder="HH:MM" editable={!timeUnknown} />
        <Pressable style={[styles.toggle, timeUnknown && styles.toggleActive]} onPress={() => setTimeUnknown((value) => !value)}>
          <View style={[styles.toggleBox, timeUnknown && styles.toggleBoxActive]}>
            {timeUnknown ? <Check color={colors.navy950} size={14} strokeWidth={3} /> : null}
          </View>
          <View style={styles.flex}>
            <Text style={styles.toggleTitle}>I do not know my birth time</Text>
            <Text style={styles.toggleBody}>Houses, Ascendant, and MC will be hidden.</Text>
          </View>
        </Pressable>
        <Field label="BIRTH PLACE" value={birthPlace} onChangeText={setBirthPlace} placeholder="Hong Kong" />
      </View>

      {error ? <View style={flowStyles.error}><Text style={flowStyles.errorText}>{error}</Text></View> : null}
      <View style={flowStyles.note}>
        <LockKeyhole color={colors.gold} size={17} />
        <Text style={flowStyles.noteText}>Used only to calculate and save your Lumis chart profile.</Text>
      </View>
      <Pressable style={flowStyles.primaryButton} onPress={continueToPreview}>
        <Text style={flowStyles.primaryButtonText}>Continue</Text>
        <ChevronRight color={colors.navy950} size={19} />
      </Pressable>
    </FlowScreen>
  );
}

function Field({
  editable = true,
  label,
  onChangeText,
  placeholder,
  value
}: {
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
  inputDisabled: { opacity: 0.4 }
});
