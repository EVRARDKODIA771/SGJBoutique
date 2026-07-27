import { useState } from "react";

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors } from "../theme/colors.js";

function formatMoney(value) {
  return `${new Intl.NumberFormat(
    "fr-FR"
  ).format(Number(value ?? 0))} FCFA`;
}

function formatReceiptDate(value) {
  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle: "long",
      timeStyle: "short",
    }
  ).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getReceiptData(movement) {
  const [
    clientName = "Client non renseigné",
    clientPhone = "",
  ] = String(
    movement?.reference ?? ""
  ).split(" · ");

  const quantity = Math.abs(
    Number(
      movement?.quantity_change ?? 0
    )
  );

  const unitPrice = Number(
    movement?.unit_price ??
      movement?.product?.sale_price ??
      0
  );

  return {
    transactionId: movement?.id ?? "—",
    date: formatReceiptDate(
      movement?.created_at
    ),
    clientName,
    clientPhone,
    productName:
      movement?.product?.name ??
      "Parfum",
    brand:
      movement?.product?.brand ??
      "—",
    sku:
      movement?.product?.sku ??
      "—",
    quantity,
    unitPrice,
    total: quantity * unitPrice,
    seller:
      movement?.seller?.display_name ??
      movement?.seller?.staff_code ??
      "Équipe JDE",
  };
}

function buildReceiptHtml(data) {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: Arial, sans-serif; color: #32190f; padding: 32px; }
      .receipt { max-width: 620px; margin: auto; border: 1px solid #d9d0c8; border-radius: 18px; overflow: hidden; }
      .header { background: #0d5266; color: white; padding: 28px; text-align: center; }
      .header h1 { margin: 0 0 6px; font-size: 30px; }
      .header p { margin: 0; letter-spacing: 2px; }
      .body { padding: 28px; }
      .meta { color: #6d5d55; font-size: 13px; overflow-wrap: anywhere; }
      .line { display: flex; justify-content: space-between; gap: 20px; padding: 13px 0; border-bottom: 1px solid #eee8e3; }
      .total { font-size: 22px; font-weight: 800; color: #0d5266; }
      .footer { text-align: center; color: #7b6b63; font-size: 12px; padding: 20px; }
    </style>
  </head>
  <body>
    <section class="receipt">
      <header class="header">
        <h1>JDE Parfum</h1>
        <p>REÇU DE VENTE</p>
      </header>
      <main class="body">
        <p><strong>Date :</strong> ${escapeHtml(data.date)}</p>
        <p class="meta"><strong>ID de transaction :</strong> ${escapeHtml(data.transactionId)}</p>
        <div class="line"><span>Client</span><strong>${escapeHtml(data.clientName)}</strong></div>
        ${data.clientPhone ? `<div class="line"><span>Téléphone</span><strong>${escapeHtml(data.clientPhone)}</strong></div>` : ""}
        <div class="line"><span>Parfum</span><strong>${escapeHtml(data.productName)}</strong></div>
        <div class="line"><span>Marque / SKU</span><strong>${escapeHtml(data.brand)} · ${escapeHtml(data.sku)}</strong></div>
        <div class="line"><span>Quantité</span><strong>${data.quantity}</strong></div>
        <div class="line"><span>Prix unitaire</span><strong>${escapeHtml(formatMoney(data.unitPrice))}</strong></div>
        <div class="line total"><span>Total</span><span>${escapeHtml(formatMoney(data.total))}</span></div>
        <p><strong>Vendeuse :</strong> ${escapeHtml(data.seller)}</p>
      </main>
      <footer class="footer">Conservez cet identifiant pour toute réclamation.</footer>
    </section>
  </body>
</html>`;
}

export default function SaleReceiptModal({
  movement,
  onClose,
}) {
  const [isSharing, setIsSharing] =
    useState(false);

  if (!movement) {
    return null;
  }

  const receipt =
    getReceiptData(movement);

  async function sharePdf() {
    setIsSharing(true);

    try {
      const html =
        buildReceiptHtml(receipt);

      if (Platform.OS === "web") {
        await Print.printAsync({ html });
        return;
      }

      const { uri } =
        await Print.printToFileAsync({
          html,
        });

      const canShare =
        await Sharing.isAvailableAsync();

      if (!canShare) {
        Alert.alert(
          "Partage indisponible",
          "Le PDF a été créé, mais aucun service de partage n’est disponible."
        );
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle:
          "Partager le reçu JDE Parfum",
        UTI: ".pdf",
      });
    } catch (error) {
      console.error(
        "Receipt PDF error:",
        error
      );

      Alert.alert(
        "PDF impossible",
        "Le reçu n’a pas pu être généré."
      );
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <ScrollView
            contentContainerStyle={
              styles.scrollContent
            }
          >
            <View style={styles.header}>
              <Text style={styles.brand}>
                JDE
              </Text>
              <Text
                style={styles.headerTitle}
              >
                REÇU DE VENTE
              </Text>
            </View>

            <View style={styles.receiptBody}>
              <Text style={styles.date}>
                {receipt.date}
              </Text>

              <Text
                style={
                  styles.transactionLabel
                }
              >
                ID DE TRANSACTION
              </Text>
              <Text
                selectable
                style={styles.transactionId}
              >
                {receipt.transactionId}
              </Text>

              {[
                ["Client", receipt.clientName],
                receipt.clientPhone
                  ? [
                      "Téléphone",
                      receipt.clientPhone,
                    ]
                  : null,
                ["Parfum", receipt.productName],
                [
                  "Marque / SKU",
                  `${receipt.brand} · ${receipt.sku}`,
                ],
                ["Quantité", receipt.quantity],
                [
                  "Prix unitaire",
                  formatMoney(
                    receipt.unitPrice
                  ),
                ],
              ]
                .filter(Boolean)
                .map(([label, value]) => (
                  <View
                    key={label}
                    style={styles.row}
                  >
                    <Text
                      style={styles.rowLabel}
                    >
                      {label}
                    </Text>
                    <Text
                      style={styles.rowValue}
                    >
                      {value}
                    </Text>
                  </View>
                ))}

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  TOTAL
                </Text>
                <Text style={styles.totalValue}>
                  {formatMoney(
                    receipt.total
                  )}
                </Text>
              </View>

              <Text style={styles.seller}>
                Vendeuse : {receipt.seller}
              </Text>
              <Text style={styles.footer}>
                Conservez cet identifiant
                pour toute réclamation.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              style={styles.secondaryButton}
              onPress={onClose}
            >
              <Text
                style={
                  styles.secondaryButtonText
                }
              >
                Fermer
              </Text>
            </Pressable>
            <Pressable
              disabled={isSharing}
              style={[
                styles.primaryButton,
                isSharing &&
                  styles.disabled,
              ]}
              onPress={sharePdf}
            >
              {isSharing ? (
                <ActivityIndicator
                  color={colors.white}
                />
              ) : (
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Partager en PDF
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: 14,
    backgroundColor:
      "rgba(20, 12, 8, 0.58)",
  },
  modal: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "92%",
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    alignItems: "center",
    padding: 22,
    backgroundColor: colors.primary,
  },
  brand: {
    color: colors.white,
    fontSize: 34,
    fontWeight: "900",
  },
  headerTitle: {
    marginTop: 3,
    color: colors.white,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },
  receiptBody: {
    padding: 20,
  },
  date: {
    color: colors.textMuted,
    textAlign: "center",
  },
  transactionLabel: {
    marginTop: 18,
    color: colors.secondaryDark,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  transactionId: {
    marginTop: 5,
    marginBottom: 14,
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    color: colors.textMuted,
  },
  rowValue: {
    flex: 1,
    color: colors.primaryDark,
    fontWeight: "800",
    textAlign: "right",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 15,
    marginTop: 12,
    paddingVertical: 15,
  },
  totalLabel: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "900",
  },
  totalValue: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "900",
  },
  seller: {
    marginTop: 10,
    color: colors.primaryDark,
    fontWeight: "700",
  },
  footer: {
    marginTop: 18,
    color: colors.textMuted,
    fontSize: 11,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontWeight: "900",
  },
  primaryButton: {
    flex: 1.4,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.6,
  },
});
