import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";

import {
  completeRestocking, getRestocking, getRestockings, getSuppliers,
} from "../services/stockService.js";
import { verifyCompanyPassword } from "../services/authService.js";
import {
  authenticateLocally, getBiometricCapabilities,
} from "../services/biometricService.js";
import { colors } from "../theme/colors.js";

function money(value) {
  return `${new Intl.NumberFormat("fr-FR").format(value ?? 0)} FCFA`;
}

export default function RestockingHistoryScreen({
  onBack,
  onCreate,
  onOpenRestocking,
  initialRestockingId,
  detailOnly = false,
}) {
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [supplierMenuOpen, setSupplierMenuOpen] = useState(false);
  const [restockings, setRestockings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [showPasswordStep, setShowPasswordStep] = useState(false);
  const [pendingCompletion, setPendingCompletion] = useState(null);

  const load = useCallback(async () => {
    setError("");
    if (!supplierId) {
      setRestockings([]);
      setLoading(false);
      return;
    }
    try {
      const result = await getRestockings({ supplierId });
      setRestockings(result.restockings ?? []);
    } catch (loadError) {
      setError(loadError?.message || "Impossible de charger les ravitaillements.");
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    getSuppliers({ page: 1, limit: 100 })
      .then((result) => setSuppliers(result.suppliers ?? []))
      .catch(() => setError("Impossible de charger les fournisseurs."));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (initialRestockingId) openDetail(initialRestockingId);
  }, [initialRestockingId]);

  async function openDetail(id) {
    if (!detailOnly && onOpenRestocking) {
      onOpenRestocking(id);
      return;
    }

    setLoading(true);
    try {
      const result = await getRestocking(id);
      setSelected(result.restocking);
    } catch (detailError) {
      setError(detailError?.message || "Impossible d'ouvrir ce ravitaillement.");
    } finally {
      setLoading(false);
    }
  }

  async function authorizeAndComplete(restocking) {
    const remaining = restocking.items.filter((item) => item.remaining_quantity > 0);
    const message = remaining.length
      ? `Ce ravitaillement n'est pas terminé.\n\n${remaining.map((item) =>
          `• ${item.product?.name ?? "Parfum"} : ${item.remaining_quantity} restant(s)`
        ).join("\n")}\n\nEn continuant, ces quantités seront remises à zéro.`
      : "Confirmer la clôture de ce ravitaillement ?";

    Alert.alert("Terminer le ravitaillement", message, [
      { text: "Annuler", style: "cancel" },
      { text: "Continuer", style: "destructive", onPress: async () => {
        if (Platform.OS !== "web") {
          const capabilities = await getBiometricCapabilities();
          if (capabilities.available) {
            const accepted = await authenticateLocally(capabilities.label);
            if (!accepted) return;
            await completeRestocking(restocking.id, "biometric");
            setSelected(null);
            await load();
            return;
          }
        }
        setPendingCompletion(restocking);
        setShowPasswordStep(true);
      } },
    ]);
  }

  async function completeWithPassword() {
    if (!password) return;
    setLoading(true);
    try {
      await verifyCompanyPassword(password);
      await completeRestocking(pendingCompletion.id, "company_password");
      setPassword("");
      setPendingCompletion(null);
      setShowPasswordStep(false);
      setSelected(null);
      await load();
    } catch (completionError) {
      setError(completionError?.message || "Autorisation refusée.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>‹ Retour</Text>
      </Pressable>
      <View style={styles.titleRow}>
        <View style={styles.titleArea}>
          <Text style={styles.title}>
            {detailOnly ? "Détail du ravitaillement" : "Historique des ravitaillements"}
          </Text>
          <Text style={styles.description}>
            Consultez les achats, les ventes, les clients, les vendeuses et le bénéfice de chaque ravitaillement.
          </Text>
        </View>
        {!selected && !detailOnly ? (
          <Pressable style={styles.primaryButton} onPress={onCreate}>
            <Text style={styles.buttonText}>+ Créer un ravitaillement</Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} /> : null}

      {showPasswordStep ? (
        <View style={styles.card}>
          <Text style={styles.subtitle}>Mot de passe de l'entreprise</Text>
          <TextInput
            style={styles.input} secureTextEntry value={password}
            onChangeText={setPassword} placeholder="Mot de passe entreprise"
          />
          <Pressable style={styles.dangerButton} onPress={completeWithPassword}>
            <Text style={styles.buttonText}>Autoriser la clôture</Text>
          </Pressable>
        </View>
      ) : null}

      {!selected && !detailOnly ? (
        <>
          <Text style={styles.subtitle}>Choisir d'abord un fournisseur</Text>
          <View style={styles.supplierPicker}>
            <Pressable style={styles.supplierButton}
              onPress={() => setSupplierMenuOpen((value) => !value)}>
              <Text style={supplierId ? styles.supplierValue : styles.supplierPlaceholder}>
                {suppliers.find((supplier) => supplier.id === supplierId)?.name || "Sélectionner un fournisseur"}
              </Text>
              <Text style={styles.chevron}>{supplierMenuOpen ? "⌃" : "⌄"}</Text>
            </Pressable>
            {supplierMenuOpen ? (
              <View style={styles.supplierMenu}>
                {suppliers.map((supplier) => (
                  <Pressable key={supplier.id} style={[
                    styles.supplierOption,
                    supplierId === supplier.id && styles.supplierOptionSelected,
                  ]} onPress={() => {
                    setSupplierId(supplier.id);
                    setSupplierMenuOpen(false);
                  }}>
                    <Text style={styles.supplierValue}>{supplier.name}</Text>
                    {supplierId === supplier.id ? <Text style={styles.selectedMark}>✓</Text> : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          {supplierId ? (
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableCell, styles.nameCell]}>Ravitaillement</Text>
                  <Text style={styles.tableCell}>Date</Text>
                  <Text style={styles.tableCell}>Fournisseur</Text>
                  <Text style={styles.tableCell}>Facture</Text>
                  <Text style={styles.tableCell}>État</Text>
                  <Text style={styles.tableCell}>Bénéfice</Text>
                </View>
                {restockings.map((restocking) => (
                  <Pressable key={restocking.id} style={styles.tableRow}
                    onPress={() => openDetail(restocking.id)}>
                    <Text style={[styles.tableCell, styles.nameCell, styles.cardTitle]}>{restocking.title}</Text>
                    <Text style={styles.tableCell}>{restocking.restocking_date}</Text>
                    <Text style={styles.tableCell}>{restocking.supplier?.name}</Text>
                    <Text style={styles.tableCell}>{restocking.invoice_number}</Text>
                    <Text style={[styles.tableCell, restocking.status === "active" ? styles.active : styles.inactive]}>
                      {restocking.status === "active" ? "ACTIF" : "INACTIF"}
                    </Text>
                    <Text style={[styles.tableCell, styles.profit]}>{money(restocking.statistics?.profit)}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          ) : null}
        </>
      ) : selected ? (
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.cardTitle}>{selected.title}</Text>
            <Text style={selected.status === "active" ? styles.active : styles.inactive}>
              {selected.status === "active" ? "ACTIF" : "INACTIF"}
            </Text>
          </View>
          <Text>{selected.supplier?.name} · {selected.restocking_date}</Text>
          <Text>Facture : {selected.invoice_number}</Text>
          <Text style={styles.profit}>Bénéfice : {money(selected.statistics?.profit)}</Text>
          <Text>Ventes : {money(selected.statistics?.salesRevenue)}</Text>
          <Text>Coût des unités vendues : {money(selected.statistics?.purchaseCost)}</Text>

          <Text style={styles.subtitle}>Produits achetés chez ce fournisseur</Text>
          {selected.items.map((item) => (
            <View key={item.id} style={styles.line}>
              <Text style={styles.lineTitle}>{item.product?.name} {item.product?.brand ? `· ${item.product.brand}` : ""}</Text>
              <Text>Quantité achetée ce jour : {item.initial_quantity}</Text>
              <Text>Vendue : {item.initial_quantity - item.remaining_quantity} · Restante : {item.remaining_quantity}</Text>
              <Text>Achat : {money(item.purchase_price)} / unité · Vente : {money(item.sale_price)} / unité</Text>
            </View>
          ))}

          <Text style={styles.subtitle}>Clients et ventes</Text>
          {selected.allocations.map((sale) => (
            <View key={sale.id} style={styles.line}>
              <Text>{sale.restocking_item?.product?.name}</Text>
              <Text>Quantité : {sale.quantity} · Client : {sale.client?.name || "Client non renseigné"}</Text>
              {sale.client?.phone ? <Text>Téléphone : {sale.client.phone}</Text> : null}
              <Text>Vendeuse : {sale.seller?.display_name || sale.seller?.staff_code || "Non renseignée"}</Text>
              <Text>Vendu le {new Date(sale.movement?.created_at || sale.created_at).toLocaleString("fr-FR")}</Text>
            </View>
          ))}

          {selected.status === "active" ? (
            <Pressable style={styles.dangerButton} onPress={() => authorizeAndComplete(selected)}>
              <Text style={styles.buttonText}>Mettre fin au ravitaillement</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 14 },
  back: { color: colors.primary, fontWeight: "700", fontSize: 16 },
  title: { fontSize: 28, fontWeight: "800", color: colors.text },
  titleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 },
  titleArea: { flex: 1, minWidth: 260 },
  description: { marginTop: 5, color: colors.textMuted, lineHeight: 20 },
  subtitle: { fontSize: 17, fontWeight: "700", marginTop: 10 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: "800", flex: 1 },
  lineTitle: { fontWeight: "900", color: colors.primaryDark },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  active: { color: "#16803A", fontWeight: "900" },
  inactive: { color: "#C62828", fontWeight: "900" },
  profit: { color: "#16803A", fontWeight: "900", fontSize: 18 },
  supplierPicker: { maxWidth: 520, marginBottom: 8 },
  supplierButton: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface },
  supplierPlaceholder: { color: colors.textMuted },
  supplierValue: { flex: 1, color: colors.text, fontWeight: "700" },
  chevron: { color: colors.primary, fontSize: 20, fontWeight: "900" },
  supplierMenu: { marginTop: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: "hidden", backgroundColor: colors.surface },
  supplierOption: { minHeight: 50, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  supplierOptionSelected: { backgroundColor: "#ECFDF3" },
  selectedMark: { color: "#16803A", fontWeight: "900" },
  line: { borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingTop: 8, gap: 2 },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 10, padding: 12 },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 10, padding: 13 },
  table: { minWidth: 1040, borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: "hidden", backgroundColor: colors.surface },
  tableRow: { minHeight: 58, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 10 },
  tableHeader: { minHeight: 48, backgroundColor: colors.inputBackground },
  tableCell: { width: 155, paddingHorizontal: 6, color: colors.text },
  nameCell: { width: 235 },
  dangerButton: { backgroundColor: "#C62828", borderRadius: 10, padding: 13, marginTop: 12 },
  buttonText: { color: "white", textAlign: "center", fontWeight: "800" },
  error: { backgroundColor: "#FEE2E2", color: "#991B1B", padding: 10, borderRadius: 8 },
});
