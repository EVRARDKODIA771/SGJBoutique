import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";

import { getRestockings } from "../services/stockService.js";
import { colors } from "../theme/colors.js";

function money(value) {
  return `${new Intl.NumberFormat("fr-FR").format(Number(value ?? 0))} FCFA`;
}

export default function ProfitHistoryScreen({ onBack, onOpenRestocking }) {
  const [restockings, setRestockings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getRestockings();
      setRestockings(result.restockings ?? []);
    } catch (loadError) {
      setError(loadError?.message || "Impossible de charger les bénéfices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => restockings.reduce((result, item) => ({
    revenue: result.revenue + Number(item.statistics?.salesRevenue ?? 0),
    cost: result.cost + Number(item.statistics?.purchaseCost ?? 0),
    profit: result.profit + Number(item.statistics?.profit ?? 0),
  }), { revenue: 0, cost: 0, profit: 0 }), [restockings]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack}><Text style={styles.back}>‹ Tableau de bord</Text></Pressable>
      <Text style={styles.eyebrow}>ANALYSE</Text>
      <Text style={styles.title}>Historique des bénéfices</Text>
      <Text style={styles.description}>Bénéfices calculés à partir des ventes réellement affectées à chaque ravitaillement.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} /> : null}

      <View style={styles.stats}>
        <View style={styles.stat}><Text style={styles.statLabel}>Chiffre d’affaires</Text><Text style={styles.statValue}>{money(totals.revenue)}</Text></View>
        <View style={styles.stat}><Text style={styles.statLabel}>Coût des produits vendus</Text><Text style={styles.statValue}>{money(totals.cost)}</Text></View>
        <View style={[styles.stat, styles.profitStat]}><Text style={styles.statLabel}>Bénéfice total</Text><Text style={styles.profit}>{money(totals.profit)}</Text></View>
      </View>

      <View style={styles.table}>
        <View style={[styles.row, styles.header]}>
          <Text style={[styles.cell, styles.wide]}>Ravitaillement</Text>
          <Text style={styles.cell}>Ventes</Text>
          <Text style={styles.cell}>Bénéfice</Text>
        </View>
        {restockings.map((item) => (
          <Pressable key={item.id} style={styles.row} onPress={() => onOpenRestocking?.(item.id)}>
            <View style={[styles.cell, styles.wide]}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.muted}>{item.supplier?.name} · {item.restocking_date}</Text>
            </View>
            <Text style={styles.cell}>{money(item.statistics?.salesRevenue)}</Text>
            <Text style={[styles.cell, styles.profitCell]}>{money(item.statistics?.profit)}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 1180, alignSelf: "center", padding: 20, paddingBottom: 50 },
  back: { color: colors.primary, fontWeight: "800", paddingVertical: 12 },
  eyebrow: { marginTop: 12, color: colors.secondaryDark, fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  title: { marginTop: 5, color: colors.primaryDark, fontSize: 32, fontWeight: "900" },
  description: { marginTop: 7, marginBottom: 20, color: colors.textMuted },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 22 },
  stat: { flexGrow: 1, flexBasis: 220, padding: 18, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  profitStat: { backgroundColor: "#ECFDF3", borderColor: "#86D19B" },
  statLabel: { color: colors.textMuted, fontWeight: "700" },
  statValue: { marginTop: 7, color: colors.text, fontSize: 20, fontWeight: "900" },
  profit: { marginTop: 7, color: "#16803A", fontSize: 22, fontWeight: "900" },
  table: { borderRadius: 15, borderWidth: 1, borderColor: colors.border, overflow: "hidden", backgroundColor: colors.surface },
  row: { minWidth: 700, flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  header: { backgroundColor: colors.inputBackground },
  cell: { flex: 1, color: colors.text, paddingHorizontal: 6 },
  wide: { flex: 1.6 },
  itemTitle: { color: colors.primaryDark, fontWeight: "900" },
  muted: { marginTop: 3, color: colors.textMuted, fontSize: 12 },
  profitCell: { color: "#16803A", fontWeight: "900" },
  error: { padding: 12, marginBottom: 12, borderRadius: 9, color: "#991B1B", backgroundColor: "#FEE2E2" },
});
