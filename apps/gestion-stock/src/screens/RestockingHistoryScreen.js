import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";

import {
  completeRestocking, createRestocking, getRestocking, getRestockings, getSuppliers,
} from "../services/stockService.js";
import { verifyCompanyPassword } from "../services/authService.js";
import {
  authenticateLocally, getBiometricCapabilities,
} from "../services/biometricService.js";
import { colors } from "../theme/colors.js";

function money(value) {
  return `${new Intl.NumberFormat("fr-FR").format(value ?? 0)} FCFA`;
}

export default function RestockingHistoryScreen({ onBack }) {
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [restockings, setRestockings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [showPasswordStep, setShowPasswordStep] = useState(false);
  const [pendingCompletion, setPendingCompletion] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newInvoice, setNewInvoice] = useState("");

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

  async function openDetail(id) {
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

  async function saveRestocking() {
    if (!supplierId || !newTitle.trim() || !newDate || !newInvoice.trim()) {
      setError("Choisissez un fournisseur et renseignez le titre, la date et la facture.");
      return;
    }
    setLoading(true);
    try {
      await createRestocking({
        title: newTitle.trim(), restockingDate: newDate,
        supplierId, invoiceNumber: newInvoice.trim(),
      });
      setNewTitle("");
      setNewInvoice("");
      setShowCreate(false);
      await load();
    } catch (creationError) {
      setError(creationError?.message || "Impossible de créer le ravitaillement.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={selected ? () => setSelected(null) : onBack}>
        <Text style={styles.back}>‹ Retour</Text>
      </Pressable>
      <Text style={styles.title}>Historique des bénéfices</Text>

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

      {!selected ? (
        <>
          <Text style={styles.subtitle}>Choisir d'abord un fournisseur</Text>
          <View style={styles.chips}>
            {suppliers.map((supplier) => (
              <Pressable key={supplier.id} style={[styles.chip, supplierId === supplier.id && styles.chipSelected]}
                onPress={() => setSupplierId(supplier.id)}>
                <Text>{supplier.name}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={{ backgroundColor: colors.primary, borderRadius: 10, padding: 12 }}
            onPress={() => setShowCreate((value) => !value)}>
            <Text style={styles.buttonText}>+ Créer un ravitaillement</Text>
          </Pressable>

          {showCreate ? (
            <View style={styles.card}>
              <Text style={styles.subtitle}>Nouveau ravitaillement</Text>
              <TextInput style={styles.input} value={newTitle} onChangeText={setNewTitle}
                placeholder="Titre" />
              <TextInput style={styles.input} value={newDate} onChangeText={setNewDate}
                placeholder="AAAA-MM-JJ" />
              <TextInput style={styles.input} value={newInvoice} onChangeText={setNewInvoice}
                placeholder="Numéro de facture" />
              <Pressable style={{ backgroundColor: colors.primary, borderRadius: 10, padding: 12 }}
                onPress={saveRestocking}>
                <Text style={styles.buttonText}>Créer</Text>
              </Pressable>
            </View>
          ) : null}

          {restockings.map((restocking) => (
            <Pressable key={restocking.id} style={styles.card} onPress={() => openDetail(restocking.id)}>
              <View style={styles.row}>
                <Text style={styles.cardTitle}>{restocking.title}</Text>
                <Text style={restocking.status === "active" ? styles.active : styles.inactive}>
                  {restocking.status === "active" ? "ACTIF" : "INACTIF"}
                </Text>
              </View>
              <Text>{restocking.supplier?.name} · {restocking.restocking_date}</Text>
              <Text>Facture : {restocking.invoice_number}</Text>
              <Text>Restant : {restocking.statistics?.remainingUnits ?? 0} unité(s)</Text>
            </Pressable>
          ))}
        </>
      ) : (
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

          <Text style={styles.subtitle}>Parfums du ravitaillement</Text>
          {selected.items.map((item) => (
            <View key={item.id} style={styles.line}>
              <Text>{item.product?.name}</Text>
              <Text>{item.initial_quantity - item.remaining_quantity} vendu(s) / {item.remaining_quantity} restant(s)</Text>
            </View>
          ))}

          <Text style={styles.subtitle}>Clients et ventes</Text>
          {selected.allocations.map((sale) => (
            <View key={sale.id} style={styles.line}>
              <Text>{sale.restocking_item?.product?.name}</Text>
              <Text>{sale.quantity} · {sale.movement?.reference || "Client non renseigné"}</Text>
              <Text>{new Date(sale.movement?.created_at || sale.created_at).toLocaleString("fr-FR")}</Text>
            </View>
          ))}

          {selected.status === "active" ? (
            <Pressable style={styles.dangerButton} onPress={() => authorizeAndComplete(selected)}>
              <Text style={styles.buttonText}>Mettre fin au ravitaillement</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 14 },
  back: { color: colors.primary, fontWeight: "700", fontSize: 16 },
  title: { fontSize: 28, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 17, fontWeight: "700", marginTop: 10 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: "800", flex: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  active: { color: "#16803A", fontWeight: "900" },
  inactive: { color: "#C62828", fontWeight: "900" },
  profit: { color: "#16803A", fontWeight: "900", fontSize: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18, backgroundColor: "#E5E7EB" },
  chipSelected: { backgroundColor: "#BBF7D0" },
  line: { borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingTop: 8, gap: 2 },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 10, padding: 12 },
  dangerButton: { backgroundColor: "#C62828", borderRadius: 10, padding: 13, marginTop: 12 },
  buttonText: { color: "white", textAlign: "center", fontWeight: "800" },
  error: { backgroundColor: "#FEE2E2", color: "#991B1B", padding: 10, borderRadius: 8 },
});
