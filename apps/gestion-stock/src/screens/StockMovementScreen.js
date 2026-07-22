import {
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  Controller,
  useForm,
} from "react-hook-form";

import { zodResolver } from
  "@hookform/resolvers/zod";

import { z } from "zod";

import {
  recordStockMovement,
} from "../services/stockService.js";

import { colors } from
  "../theme/colors.js";

const movementOptions = [
  {
    value: "purchase",
    label: "Achat",
    description:
      "Ajoute des produits achetés au stock.",
    direction: "increase",
  },
  {
    value: "sale",
    label: "Vente",
    description:
      "Retire du stock les produits vendus.",
    direction: "decrease",
  },
  {
    value: "return",
    label: "Retour client",
    description:
      "Ajoute au stock un produit retourné.",
    direction: "increase",
  },
  {
    value: "damage",
    label: "Produit endommagé",
    description:
      "Retire un produit endommagé du stock.",
    direction: "decrease",
  },
  {
    value: "loss",
    label: "Perte",
    description:
      "Retire un produit perdu du stock.",
    direction: "decrease",
  },
  {
    value: "adjustment",
    label: "Ajustement",
    description:
      "Corrige manuellement la quantité en stock.",
    direction: "adjustment",
  },
];

const stockMovementSchema = z
  .object({
    movementType: z.enum([
      "purchase",
      "sale",
      "return",
      "damage",
      "loss",
      "adjustment",
    ]),

    quantity: z
      .string()
      .trim()
      .min(
        1,
        "La quantité est obligatoire"
      )
      .regex(
        /^\d+$/,
        "Saisissez un nombre entier positif"
      )
      .refine(
        (value) => Number(value) > 0,
        "La quantité doit être supérieure à zéro"
      ),

    adjustmentDirection: z
      .enum([
        "increase",
        "decrease",
      ])
      .nullable(),

    reason: z
      .string()
      .trim()
      .max(
        500,
        "La raison ne peut pas dépasser 500 caractères"
      ),

    reference: z
      .string()
      .trim()
      .max(
        100,
        "La référence ne peut pas dépasser 100 caractères"
      ),
  })
  .superRefine((values, context) => {
    if (
      values.movementType ===
        "adjustment" &&
      !values.adjustmentDirection
    ) {
      context.addIssue({
        code: "custom",
        path: [
          "adjustmentDirection",
        ],
        message:
          "Choisissez le sens de l’ajustement",
      });
    }
  });

function FormInput({
  control,
  name,
  label,
  placeholder,
  error,
  keyboardType = "default",
  multiline = false,
}) {
  return (
    <View
      style={[
        styles.field,
        multiline &&
          styles.fullWidthField,
      ]}
    >
      <Text style={styles.label}>
        {label}
      </Text>

      <Controller
        control={control}
        name={name}
        render={({
          field: {
            value,
            onChange,
            onBlur,
          },
        }) => (
          <TextInput
            style={[
              styles.input,
              multiline &&
                styles.multilineInput,
              error &&
                styles.inputError,
            ]}
            value={value ?? ""}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            placeholderTextColor={
              colors.textMuted
            }
            keyboardType={keyboardType}
            multiline={multiline}
            textAlignVertical={
              multiline ? "top" : "center"
            }
            autoCorrect={false}
          />
        )}
      />

      {error ? (
        <Text style={styles.fieldError}>
          {error.message}
        </Text>
      ) : null}
    </View>
  );
}

export default function StockMovementScreen({
  product,
  onBack,
  onRecorded,
}) {
  const [requestError, setRequestError] =
    useState("");

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm({
    resolver: zodResolver(
      stockMovementSchema
    ),

    defaultValues: {
      movementType: "purchase",
      quantity: "",
      adjustmentDirection: null,
      reason: "",
      reference: "",
    },
  });

  const selectedMovementType =
    watch("movementType");

  const selectedAdjustmentDirection =
    watch("adjustmentDirection");

  const enteredQuantity =
    watch("quantity");

  const selectedMovement = useMemo(
    () =>
      movementOptions.find(
        (movement) =>
          movement.value ===
          selectedMovementType
      ) ?? movementOptions[0],
    [selectedMovementType]
  );

  const quantityNumber =
    /^\d+$/.test(enteredQuantity ?? "")
      ? Number(enteredQuantity)
      : 0;

  const quantityChange = useMemo(() => {
    if (!quantityNumber) {
      return 0;
    }

    if (
      [
        "sale",
        "damage",
        "loss",
      ].includes(selectedMovementType)
    ) {
      return -quantityNumber;
    }

    if (
      selectedMovementType ===
        "adjustment" &&
      selectedAdjustmentDirection ===
        "decrease"
    ) {
      return -quantityNumber;
    }

    return quantityNumber;
  }, [
    quantityNumber,
    selectedMovementType,
    selectedAdjustmentDirection,
  ]);

  const projectedStock =
    Number(product?.stock_quantity ?? 0) +
    quantityChange;

  const productIsArchived =
    product?.status === "archived";

  function selectMovementType(
    movementType
  ) {
    setValue(
      "movementType",
      movementType,
      {
        shouldValidate: true,
      }
    );

    if (
      movementType !== "adjustment"
    ) {
      setValue(
        "adjustmentDirection",
        null,
        {
          shouldValidate: true,
        }
      );
    }

    setRequestError("");
  }

  async function submitMovement(values) {
    setRequestError("");

    const movementData = {
      movementType:
        values.movementType,

      quantity: Number(
        values.quantity
      ),

      reason:
        values.reason.trim() || null,

      reference:
        values.reference.trim() ||
        null,
    };

    if (
      values.movementType ===
      "adjustment"
    ) {
      movementData.adjustmentDirection =
        values.adjustmentDirection;
    }

    try {
      const result =
        await recordStockMovement(
          product.id,
          movementData
        );

      onRecorded?.(
        result.product,
        result.movement
      );
    } catch (error) {
      console.error(
        "Stock movement error:",
        error
      );

      const errorMessage =
        error?.message ?? "";

      if (
        errorMessage
          .toLowerCase()
          .includes(
            "insufficient stock"
          )
      ) {
        setRequestError(
          "Stock insuffisant pour effectuer ce mouvement."
        );

        return;
      }

      if (
        errorMessage
          .toLowerCase()
          .includes(
            "product not found"
          )
      ) {
        setRequestError(
          "Ce parfum n’existe plus."
        );

        return;
      }

      setRequestError(
        errorMessage ||
          "Impossible d’enregistrer le mouvement de stock."
      );
    }
  }

  if (!product?.id) {
    return (
      <View style={styles.centeredScreen}>
        <Text style={styles.errorTitle}>
          Parfum introuvable
        </Text>

        <Text style={styles.errorMessage}>
          Aucun parfum n’a été sélectionné.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
          onPress={onBack}
        >
          <Text
            style={
              styles.primaryButtonText
            }
          >
            Retour
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.scrollContent
      }
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            onPress={onBack}
            disabled={isSubmitting}
          >
            <Text
              style={
                styles.backButtonText
              }
            >
              ‹ Retour à la fiche
            </Text>
          </Pressable>
        </View>

        <View style={styles.heading}>
          <Text style={styles.eyebrow}>
            STOCK JDE
          </Text>

          <Text style={styles.title}>
            Nouveau mouvement
          </Text>

          <Text style={styles.subtitle}>
            Enregistrez une entrée, une
            sortie ou une correction de
            stock pour ce parfum.
          </Text>
        </View>

        <View style={styles.productCard}>
          <View style={styles.productInfo}>
            <Text
              style={styles.productName}
            >
              {product.name}
            </Text>

            <Text
              style={styles.productMeta}
            >
              {product.brand ||
                "Marque non renseignée"}
              {product.sku
                ? ` • ${product.sku}`
                : ""}
            </Text>
          </View>

          <View
            style={styles.currentStockBox}
          >
            <Text
              style={
                styles.currentStockLabel
              }
            >
              Stock actuel
            </Text>

            <Text
              style={
                styles.currentStockValue
              }
            >
              {product.stock_quantity ??
                0}
            </Text>

            <Text
              style={
                styles.currentStockUnit
              }
            >
              unité(s)
            </Text>
          </View>
        </View>

        {productIsArchived ? (
          <View style={styles.warningBox}>
            <Text
              style={styles.warningTitle}
            >
              Parfum archivé
            </Text>

            <Text
              style={styles.warningText}
            >
              Aucun mouvement de stock ne
              peut être enregistré sur un
              parfum archivé.
            </Text>
          </View>
        ) : null}

        {requestError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {requestError}
            </Text>
          </View>
        ) : null}

        <View style={styles.formCard}>
          <Text
            style={styles.sectionTitle}
          >
            Type de mouvement
          </Text>

          <View
            style={
              styles.movementOptions
            }
          >
            {movementOptions.map(
              (movement) => {
                const isSelected =
                  selectedMovementType ===
                  movement.value;

                return (
                  <Pressable
                    key={movement.value}
                    style={({ pressed }) => [
                      styles.movementCard,
                      isSelected &&
                        styles.movementCardSelected,
                      pressed &&
                        styles.pressed,
                    ]}
                    onPress={() =>
                      selectMovementType(
                        movement.value
                      )
                    }
                    disabled={
                      isSubmitting ||
                      productIsArchived
                    }
                  >
                    <View
                      style={
                        styles.movementCardHeader
                      }
                    >
                      <Text
                        style={[
                          styles.movementLabel,
                          isSelected &&
                            styles.movementLabelSelected,
                        ]}
                      >
                        {movement.label}
                      </Text>

                      <Text
                        style={[
                          styles.directionBadge,
                          movement.direction ===
                            "increase"
                            ? styles.increaseText
                            : movement.direction ===
                                "decrease"
                              ? styles.decreaseText
                              : styles.adjustmentText,
                        ]}
                      >
                        {movement.direction ===
                        "increase"
                          ? "+ Entrée"
                          : movement.direction ===
                              "decrease"
                            ? "− Sortie"
                            : "± Correction"}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.movementDescription,
                        isSelected &&
                          styles.movementDescriptionSelected,
                      ]}
                    >
                      {movement.description}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </View>

          <View
            style={styles.selectedSummary}
          >
            <Text
              style={
                styles.selectedSummaryLabel
              }
            >
              Mouvement sélectionné
            </Text>

            <Text
              style={
                styles.selectedSummaryValue
              }
            >
              {selectedMovement.label}
            </Text>

            <Text
              style={
                styles.selectedSummaryText
              }
            >
              {selectedMovement.description}
            </Text>
          </View>

          {selectedMovementType ===
          "adjustment" ? (
            <View
              style={
                styles.adjustmentArea
              }
            >
              <Text style={styles.label}>
                Sens de l’ajustement *
              </Text>

              <View
                style={
                  styles.directionOptions
                }
              >
                <Pressable
                  style={[
                    styles.directionButton,
                    selectedAdjustmentDirection ===
                      "increase" &&
                      styles.directionButtonSelected,
                  ]}
                  onPress={() =>
                    setValue(
                      "adjustmentDirection",
                      "increase",
                      {
                        shouldValidate:
                          true,
                      }
                    )
                  }
                  disabled={isSubmitting}
                >
                  <Text
                    style={[
                      styles.directionButtonText,
                      selectedAdjustmentDirection ===
                        "increase" &&
                        styles.directionButtonTextSelected,
                    ]}
                  >
                    Augmenter le stock
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.directionButton,
                    selectedAdjustmentDirection ===
                      "decrease" &&
                      styles.directionButtonSelected,
                  ]}
                  onPress={() =>
                    setValue(
                      "adjustmentDirection",
                      "decrease",
                      {
                        shouldValidate:
                          true,
                      }
                    )
                  }
                  disabled={isSubmitting}
                >
                  <Text
                    style={[
                      styles.directionButtonText,
                      selectedAdjustmentDirection ===
                        "decrease" &&
                        styles.directionButtonTextSelected,
                    ]}
                  >
                    Diminuer le stock
                  </Text>
                </Pressable>
              </View>

              {errors.adjustmentDirection ? (
                <Text
                  style={
                    styles.fieldError
                  }
                >
                  {
                    errors
                      .adjustmentDirection
                      .message
                  }
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.divider} />

          <Text
            style={styles.sectionTitle}
          >
            Détails du mouvement
          </Text>

          <View style={styles.formGrid}>
            <FormInput
              control={control}
              name="quantity"
              label="Quantité *"
              placeholder="Exemple : 5"
              keyboardType="numeric"
              error={errors.quantity}
            />

            <FormInput
              control={control}
              name="reference"
              label="Référence"
              placeholder="Exemple : ACHAT-2026-001"
              error={errors.reference}
            />

            <FormInput
              control={control}
              name="reason"
              label="Raison ou commentaire"
              placeholder="Précisez la raison du mouvement…"
              multiline
              error={errors.reason}
            />
          </View>

          {quantityNumber > 0 ? (
            <View
              style={[
                styles.projectionBox,
                projectedStock < 0 &&
                  styles.projectionBoxError,
              ]}
            >
              <View
                style={
                  styles.projectionItem
                }
              >
                <Text
                  style={
                    styles.projectionLabel
                  }
                >
                  Stock avant
                </Text>

                <Text
                  style={
                    styles.projectionValue
                  }
                >
                  {product.stock_quantity ??
                    0}
                </Text>
              </View>

              <Text
                style={
                  quantityChange >= 0
                    ? styles.projectionIncrease
                    : styles.projectionDecrease
                }
              >
                {quantityChange >= 0
                  ? `+${quantityChange}`
                  : quantityChange}
              </Text>

              <View
                style={
                  styles.projectionItem
                }
              >
                <Text
                  style={
                    styles.projectionLabel
                  }
                >
                  Stock après
                </Text>

                <Text
                  style={[
                    styles.projectionValue,
                    projectedStock < 0 &&
                      styles.projectionErrorValue,
                  ]}
                >
                  {projectedStock}
                </Text>
              </View>
            </View>
          ) : null}

          {projectedStock < 0 ? (
            <Text
              style={
                styles.insufficientText
              }
            >
              Le stock disponible est
              insuffisant pour ce
              mouvement.
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.pressed,
              ]}
              onPress={onBack}
              disabled={isSubmitting}
            >
              <Text
                style={
                  styles.cancelButtonText
                }
              >
                Annuler
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.pressed,
                (isSubmitting ||
                  productIsArchived ||
                  projectedStock < 0) &&
                  styles.disabledButton,
              ]}
              onPress={handleSubmit(
                submitMovement
              )}
              disabled={
                isSubmitting ||
                productIsArchived ||
                projectedStock < 0
              }
            >
              {isSubmitting ? (
                <ActivityIndicator
                  color={
                    colors.textOnPrimary
                  }
                />
              ) : (
                <Text
                  style={
                    styles.submitButtonText
                  }
                >
                  Enregistrer le mouvement
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  centeredScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.background,
  },

  scrollContent: {
    paddingBottom: 45,
  },

  container: {
    width: "100%",
    maxWidth: 1050,
    alignSelf: "center",
    paddingHorizontal: 20,
  },

  topBar: {
    minHeight: 76,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  backButton: {
    alignSelf: "flex-start",
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  backButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },

  heading: {
    paddingTop: 31,
    paddingBottom: 23,
  },

  eyebrow: {
    color: colors.secondaryDark,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.3,
  },

  title: {
    marginTop: 6,
    color: colors.primaryDark,
    fontSize: 34,
    fontWeight: "800",
  },

  subtitle: {
    marginTop: 7,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },

  productCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 18,
    marginBottom: 20,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  productInfo: {
    flexGrow: 1,
    flexBasis: 260,
  },

  productName: {
    color: colors.primaryDark,
    fontSize: 23,
    fontWeight: "800",
  },

  productMeta: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 13,
  },

  currentStockBox: {
    minWidth: 135,
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor:
      colors.secondaryLight,
  },

  currentStockLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },

  currentStockValue: {
    marginTop: 2,
    color: colors.primaryDark,
    fontSize: 30,
    fontWeight: "900",
  },

  currentStockUnit: {
    color: colors.textMuted,
    fontSize: 11,
  },

  formCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  sectionTitle: {
    marginBottom: 17,
    color: colors.primaryDark,
    fontSize: 20,
    fontWeight: "800",
  },

  movementOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  movementCard: {
    flexGrow: 1,
    flexBasis: 285,
    minHeight: 112,
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:
      colors.inputBackground,
  },

  movementCardSelected: {
    borderColor: colors.primary,
    backgroundColor:
      colors.secondaryLight,
  },

  movementCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },

  movementLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },

  movementLabelSelected: {
    color: colors.primaryDark,
  },

  movementDescription: {
    marginTop: 9,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },

  movementDescriptionSelected: {
    color: colors.text,
  },

  directionBadge: {
    fontSize: 11,
    fontWeight: "800",
  },

  increaseText: {
    color: "#34734A",
  },

  decreaseText: {
    color: colors.danger,
  },

  adjustmentText: {
    color: colors.secondaryDark,
  },

  selectedSummary: {
    marginTop: 18,
    padding: 15,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
    backgroundColor:
      colors.secondaryLight,
  },

  selectedSummaryLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  selectedSummaryValue: {
    marginTop: 4,
    color: colors.primaryDark,
    fontSize: 17,
    fontWeight: "800",
  },

  selectedSummaryText: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 12,
  },

  adjustmentArea: {
    marginTop: 20,
    gap: 9,
  },

  directionOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  directionButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  directionButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },

  directionButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },

  directionButtonTextSelected: {
    color: colors.textOnPrimary,
  },

  divider: {
    height: 1,
    marginVertical: 27,
    backgroundColor: colors.border,
  },

  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 17,
  },

  field: {
    flexGrow: 1,
    flexBasis: 300,
    gap: 7,
  },

  fullWidthField: {
    flexBasis: "100%",
  },

  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },

  input: {
    minHeight: 51,
    paddingHorizontal: 14,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:
      colors.inputBackground,
    color: colors.text,
    fontSize: 15,
    outlineStyle: "none",
  },

  multilineInput: {
    minHeight: 108,
    paddingTop: 13,
    paddingBottom: 13,
  },

  inputError: {
    borderColor: colors.danger,
  },

  fieldError: {
    color: colors.danger,
    fontSize: 12,
  },

  projectionBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 24,
    marginTop: 24,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:
      colors.inputBackground,
  },

  projectionBoxError: {
    borderColor: colors.danger,
    backgroundColor:
      colors.dangerLight,
  },

  projectionItem: {
    alignItems: "center",
    minWidth: 100,
  },

  projectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },

  projectionValue: {
    marginTop: 4,
    color: colors.primaryDark,
    fontSize: 25,
    fontWeight: "900",
  },

  projectionIncrease: {
    color: "#34734A",
    fontSize: 21,
    fontWeight: "900",
  },

  projectionDecrease: {
    color: colors.danger,
    fontSize: 21,
    fontWeight: "900",
  },

  projectionErrorValue: {
    color: colors.danger,
  },

  insufficientText: {
    marginTop: 10,
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },

  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 11,
    marginTop: 29,
  },

  cancelButton: {
    minHeight: 51,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 21,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.primary,
  },

  cancelButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },

  submitButton: {
    minHeight: 51,
    minWidth: 220,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 21,
    borderRadius: 11,
    backgroundColor: colors.primary,
  },

  submitButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  warningBox: {
    marginBottom: 18,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.secondary,
    backgroundColor:
      colors.secondaryLight,
  },

  warningTitle: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "800",
  },

  warningText: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },

  errorBox: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },

  errorText: {
    color: colors.danger,
    fontSize: 14,
  },

  errorTitle: {
    color: colors.primaryDark,
    fontSize: 25,
    fontWeight: "800",
  },

  errorMessage: {
    marginTop: 8,
    marginBottom: 20,
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
  },

  primaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
  },

  primaryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.58,
  },

  pressed: {
    opacity: 0.83,
  },
});
