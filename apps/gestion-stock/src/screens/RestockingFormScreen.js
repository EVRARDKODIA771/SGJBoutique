import { useEffect, useState } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";

import { createRestocking, getSuppliers } from "../services/stockService.js";
import { colors } from "../theme/colors.js";

export default function RestockingFormScreen({ onBack, onCreated }) {
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getSuppliers({ page: 1, limit: 100, isActive: true })
      .then((result) => setSuppliers(result.suppliers ?? []))
      .catch(() => setError("Impossible de charger les fournisseurs."))
      .finally(() => setLoading(false));
  }, []);

  async function submit() {
    if (!supplierId || !title.trim() || !date || !invoiceNumber.trim()) {
      setError("Le fournisseur, le titre, la date et le numéro de facture sont obligatoires.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const result = await createRestocking({
        supplierId,
        title: title.trim(),
        restockingDate: date,
        invoiceNumber: invoiceNumber.trim(),
      });
      onCreated?.(result.restocking);
    } catch (creationError) {
      setError(creationError?.message || "Impossible de créer le ravitaillement.");
    } finally {
      setSaving(false);
    }
  }

  const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backText}>‹ Retour</Text>
      </Pressable>

      <Text style={styles.eyebrow}>RAVITAILLEMENTS</Text>
      <Text style={styles.title}>Créer un ravitaillement</Text>
      <Text style={styles.description}>
        Ce ravitaillement regroupera précisément tous les parfums achetés sur cette facture.
      </Text>

      <View style={styles.card}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.primary} /> : null}

        <Text style={styles.label}>Fournisseur *</Text>
        <Pressable style={styles.input} onPress={() => setMenuOpen((value) => !value)}>
          <Text style={selectedSupplier ? styles.value : styles.placeholder}>
            {selectedSupplier?.name || "Choisir un fournisseur"}
          </Text>
        </Pressable>
        {menuOpen ? (
          <View style={styles.dropdown}>
            {suppliers.map((supplier) => (
              <Pressable key={supplier.id} style={styles.option} onPress={() => {
                setSupplierId(supplier.id);
                setMenuOpen(false);
              }}>
                <Text style={styles.value}>{supplier.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text style={styles.label}>Titre du ravitaillement *</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle}
          placeholder="Exemple : Arrivage août JDE" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Date du ravitaillement *</Text>
        <TextInput style={styles.input} value={date} onChangeText={setDate}
          placeholder="AAAA-MM-JJ" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Numéro de facture *</Text>
        <TextInput style={styles.input} value={invoiceNumber} onChangeText={setInvoiceNumber}
          placeholder="Exemple : FAC-2026-008" placeholderTextColor={colors.textMuted} />

        <Pressable style={[styles.submit, saving && styles.disabled]} onPress={submit} disabled={saving}>
          {saving ? <ActivityIndicator color="white" /> :
            <Text style={styles.submitText}>Créer le ravitaillement</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 850, alignSelf: "center", padding: 20, paddingBottom: 50 },
  backButton: { alignSelf: "flex-start", paddingVertical: 12 },
  backText: { color: colors.primary, fontWeight: "800", fontSize: 15 },
  eyebrow: { marginTop: 14, color: colors.secondaryDark, fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  title: { marginTop: 6, color: colors.primaryDark, fontSize: 32, fontWeight: "900" },
  description: { marginTop: 8, marginBottom: 22, color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  card: { padding: 22, gap: 9, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  label: { marginTop: 8, color: colors.text, fontWeight: "800" },
  input: { minHeight: 51, justifyContent: "center", padding: 14, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBackground, color: colors.text },
  dropdown: { borderWidth: 1, borderColor: colors.border, borderRadius: 11, overflow: "hidden" },
  option: { minHeight: 48, justifyContent: "center", paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  value: { color: colors.text },
  placeholder: { color: colors.textMuted },
  submit: { minHeight: 52, alignItems: "center", justifyContent: "center", marginTop: 16, borderRadius: 11, backgroundColor: colors.primary },
  submitText: { color: "white", fontWeight: "900" },
  disabled: { opacity: 0.6 },
  error: { padding: 12, borderRadius: 9, color: "#991B1B", backgroundColor: "#FEE2E2" },
});
