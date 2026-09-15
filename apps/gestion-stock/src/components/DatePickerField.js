import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors.js";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  const date = parseIsoDate(value);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function getTodayIsoDate() {
  return toIsoDate(new Date());
}

export default function DatePickerField({ value, onChange, style }) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const selected = parseIsoDate(value);
    return new Date(selected.getFullYear(), selected.getMonth(), 1);
  });

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const leadingEmptyDays = (new Date(year, month, 1).getDay() + 6) % 7;
    const dayCount = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: leadingEmptyDays }, () => null),
      ...Array.from({ length: dayCount }, (_, index) => index + 1),
    ];
  }, [visibleMonth]);

  function showCalendar() {
    const selected = parseIsoDate(value);
    setVisibleMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    setOpen(true);
  }

  function changeMonth(offset) {
    setVisibleMonth((current) =>
      new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function selectDay(day) {
    const selected = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      day
    );
    onChange(toIsoDate(selected));
    setOpen(false);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choisir la date du ravitaillement"
        style={[styles.field, style]}
        onPress={showCalendar}
      >
        <Text style={styles.fieldText}>{formatDate(value)}</Text>
        <Text style={styles.calendarIcon}>▣</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.calendar} onPress={(event) => event.stopPropagation()}>
            <View style={styles.header}>
              <Pressable style={styles.arrow} onPress={() => changeMonth(-1)}>
                <Text style={styles.arrowText}>‹</Text>
              </Pressable>
              <Text style={styles.monthTitle}>
                {MONTHS[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
              </Text>
              <Pressable style={styles.arrow} onPress={() => changeMonth(1)}>
                <Text style={styles.arrowText}>›</Text>
              </Pressable>
            </View>

            <View style={styles.grid}>
              {WEEKDAYS.map((weekday, index) => (
                <View key={`${weekday}-${index}`} style={styles.cell}>
                  <Text style={styles.weekday}>{weekday}</Text>
                </View>
              ))}
              {days.map((day, index) => {
                const isoDate = day
                  ? toIsoDate(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day))
                  : null;
                const selected = isoDate === value;
                return (
                  <View key={`${day ?? "empty"}-${index}`} style={styles.cell}>
                    {day ? (
                      <Pressable
                        style={[styles.day, selected && styles.selectedDay]}
                        onPress={() => selectDay(day)}
                      >
                        <Text style={[styles.dayText, selected && styles.selectedDayText]}>{day}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 51,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
  },
  fieldText: { color: colors.text },
  calendarIcon: { color: colors.primary, fontSize: 20 },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  calendar: {
    width: "100%",
    maxWidth: 390,
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  arrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  arrowText: { color: colors.primary, fontSize: 34, lineHeight: 36 },
  monthTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 12 },
  cell: { width: "14.2857%", aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  weekday: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  day: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19 },
  selectedDay: { backgroundColor: colors.primary },
  dayText: { color: colors.text, fontWeight: "600" },
  selectedDayText: { color: "white", fontWeight: "900" },
});
