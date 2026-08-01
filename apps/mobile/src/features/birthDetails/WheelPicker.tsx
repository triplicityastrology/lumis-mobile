import { useEffect, useMemo, useRef, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import { colors } from "../../theme/tokens";
import { composeBirthTime12h } from "./birthTimePicker";

/**
 * PROF-003 — Edit Birth Details native-style wheel picker (founder rework pack).
 *
 * Matches the supplied design: three scroll-snap columns for the date
 * (Month / Day / Year) and three for the time (Hour / Minute / AM·PM), with a
 * fixed 176px wheel, 44px rows, and a centred selection band.
 *
 * Correctness (founder notes):
 *   • The snapped item is always read from the scroll offset — every column can
 *     be changed, and every change re-derives the staged Date, so there is no
 *     "always 8am" / first-item lock.
 *   • The parent stages the returned Date and only commits it on "Done"; a
 *     cancel/scrim dismissal keeps the previously saved value untouched.
 */

const ITEM_HEIGHT = 44;
const WHEEL_HEIGHT = 176;
const PAD = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MIN_YEAR = 1900;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** A single scroll-snapping wheel column. */
function WheelColumn({
  items,
  index,
  onIndexChange,
  accessibilityLabel
}: {
  items: string[];
  index: number;
  onIndexChange: (nextIndex: number) => void;
  accessibilityLabel: string;
}) {
  const ref = useRef<ScrollView>(null);
  const [live, setLive] = useState(index);

  // Reflect external index changes (e.g. day clamped after a month/year change).
  useEffect(() => {
    setLive(index);
    const id = setTimeout(() => {
      ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
    }, 0);
    return () => clearTimeout(id);
  }, [index]);

  const indexFromOffset = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    clamp(Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT), 0, items.length - 1);

  return (
    <View accessibilityLabel={accessibilityLabel} style={styles.column}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        scrollEventThrottle={16}
        nestedScrollEnabled
        contentContainerStyle={styles.columnContent}
        onScroll={(event) => {
          const next = indexFromOffset(event);
          if (next !== live) setLive(next);
        }}
        onMomentumScrollEnd={(event) => {
          const next = indexFromOffset(event);
          setLive(next);
          onIndexChange(next);
        }}
        onScrollEndDrag={(event) => {
          const next = indexFromOffset(event);
          setLive(next);
          onIndexChange(next);
        }}
      >
        {items.map((label, itemIndex) => (
          <View key={label + itemIndex} style={styles.item}>
            <Text style={[styles.itemText, itemIndex === live ? styles.itemTextSelected : styles.itemTextIdle]}>
              {label}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export function WheelPicker({
  mode,
  value,
  onChange,
  maximumDate
}: {
  mode: "date" | "time";
  value: Date;
  onChange: (next: Date) => void;
  maximumDate?: Date;
}) {
  const maxYear = maximumDate ? maximumDate.getFullYear() : new Date().getFullYear();
  // All memos are computed unconditionally (Rules of Hooks); only the matching
  // set is rendered for the active mode.
  const years = useMemo(() => {
    const list: string[] = [];
    for (let year = MIN_YEAR; year <= maxYear; year += 1) list.push(String(year));
    return list;
  }, [maxYear]);
  const dateYear = value.getFullYear();
  const dateMonthIndex = value.getMonth();
  const dateDayCount = daysInMonth(dateYear, dateMonthIndex);
  const days = useMemo(() => Array.from({ length: dateDayCount }, (_, i) => String(i + 1)), [dateDayCount]);
  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => String(i + 1)), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")), []);

  if (mode === "date") {
    const year = dateYear;
    const monthIndex = dateMonthIndex;
    const day = clamp(value.getDate(), 1, dateDayCount);

    const emit = (nextYear: number, nextMonth: number, nextDay: number) => {
      const boundedDay = clamp(nextDay, 1, daysInMonth(nextYear, nextMonth));
      let next = new Date(nextYear, nextMonth, boundedDay, 12, 0, 0, 0);
      if (maximumDate && next.getTime() > maximumDate.getTime()) next = new Date(maximumDate.getTime());
      onChange(next);
    };

    return (
      <View style={styles.wheelRow}>
        <View style={styles.selectionBand} pointerEvents="none" />
        <WheelColumn
          accessibilityLabel="Month"
          items={MONTHS}
          index={monthIndex}
          onIndexChange={(i) => emit(year, i, day)}
        />
        <WheelColumn
          accessibilityLabel="Day"
          items={days}
          index={day - 1}
          onIndexChange={(i) => emit(year, monthIndex, i + 1)}
        />
        <WheelColumn
          accessibilityLabel="Year"
          items={years}
          index={clamp(year - MIN_YEAR, 0, years.length - 1)}
          onIndexChange={(i) => emit(MIN_YEAR + i, monthIndex, day)}
        />
      </View>
    );
  }

  // time mode
  const hour24 = value.getHours();
  const meridiemIndex = hour24 >= 12 ? 1 : 0;
  const hour12 = hour24 % 12 || 12;
  const minute = value.getMinutes();

  const emitTime = (nextHour12: number, nextMinute: number, nextMeridiem: number) => {
    const { hour24 } = composeBirthTime12h(nextHour12, nextMinute, nextMeridiem === 1 ? "PM" : "AM");
    const next = new Date(value.getFullYear(), value.getMonth(), value.getDate(), hour24, nextMinute, 0, 0);
    onChange(next);
  };

  return (
    <View style={styles.wheelRow}>
      <View style={styles.selectionBand} pointerEvents="none" />
      <WheelColumn
        accessibilityLabel="Hour"
        items={hours}
        index={hour12 - 1}
        onIndexChange={(i) => emitTime(i + 1, minute, meridiemIndex)}
      />
      <WheelColumn
        accessibilityLabel="Minute"
        items={minutes}
        index={minute}
        onIndexChange={(i) => emitTime(hour12, i, meridiemIndex)}
      />
      <WheelColumn
        accessibilityLabel="AM or PM"
        items={["AM", "PM"]}
        index={meridiemIndex}
        onIndexChange={(i) => emitTime(hour12, minute, i)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wheelRow: { alignItems: "center", flexDirection: "row", height: WHEEL_HEIGHT, justifyContent: "center" },
  // Centred selection band (SPEC: top 50%, translateY(-50%), 44px).
  selectionBand: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    height: ITEM_HEIGHT,
    left: 8,
    position: "absolute",
    right: 8,
    top: (WHEEL_HEIGHT - ITEM_HEIGHT) / 2
  },
  column: { flex: 1, height: WHEEL_HEIGHT },
  columnContent: { paddingVertical: PAD },
  item: { alignItems: "center", height: ITEM_HEIGHT, justifyContent: "center" },
  itemText: { fontSize: 17, textAlign: "center" },
  itemTextSelected: { color: colors.ice, fontWeight: "600" },
  itemTextIdle: { color: colors.muted, opacity: 0.55 }
});
