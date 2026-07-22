import {
  useEffect,
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
  getProductSuppliers,
  getSuppliers,
  removeProductSupplier,
  saveProductSupplier,
} from "../services/stockService.js";

import { colors } from
  "../theme/colors.js";

const associationSchema = z.object({
  supplierId: z
    .string()
    .uuid(
      "Sélectionnez un fournisseur"
    ),

  supplierReference: z
    .string()
    .trim()
    .max(
      150,
      "La référence ne peut pas dépasser 150 caractères"
    ),

  lastPurchasePrice: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        /^\d+$/.test(value),
      "Saisissez un nombre entier positif"
    ),
});

function formatPrice(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "Non renseigné";
  }

  return `${Number(value).toLocaleString(
    "fr-FR"
  )} FCFA`;
}

function FormInput({
  control,
  name,
  label,
  placeholder,
  error,
  keyboardType = "default",
}) {
  return (
    <View style={styles.field}>
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

export default function ProductSuppliersScreen({
  product,
  onBack,
  onChanged,
}) {
  const [suppliers, setSuppliers] =
    useState([]);

  const [
    productSuppliers,
    setProductSuppliers,
  ] = useState([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [requestError, setRequestError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [
    editingSupplierId,
    setEditingSupplierId,
  ] = useState(null);

  const [
    supplierToRemove,
    setSupplierToRemove,
  ] = useState(null);

  const [
    deletingSupplierId,
    setDeletingSupplierId,
  ] = useState(null);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm({
    resolver: zodResolver(
      associationSchema
    ),

    defaultValues: {
      supplierId: "",
      supplierReference: "",
      lastPurchasePrice: "",
    },
  });

  const selectedSupplierId =
    watch("supplierId");

  const associatedSupplierIds =
    useMemo(
      () =>
        new Set(
          productSuppliers.map(
            (association) =>
              association.supplier_id
          )
        ),
      [productSuppliers]
    );

  const selectedSupplier =
    useMemo(
      () =>
        suppliers.find(
          (supplier) =>
            supplier.id ===
            selectedSupplierId
        ) ?? null,
      [
        suppliers,
        selectedSupplierId,
      ]
    );

  async function loadData({
    showLoader = true,
  } = {}) {
    if (!product?.id) {
      setRequestError(
        "Aucun parfum n’a été sélectionné."
      );

      setIsLoading(false);

      return;
    }

    if (showLoader) {
      setIsLoading(true);
    }

    setRequestError("");

    try {
      const [
        suppliersResult,
        productSuppliersResult,
      ] = await Promise.all([
        getSuppliers({
          isActive: true,
          page: 1,
          limit: 100,
        }),

        getProductSuppliers(
          product.id
        ),
      ]);

      setSuppliers(
        suppliersResult.suppliers ?? []
      );

      setProductSuppliers(
        productSuppliersResult.suppliers ??
          []
      );
    } catch (error) {
      console.error(
        "Product suppliers loading error:",
        error
      );

      setRequestError(
        error?.message ||
          "Impossible de charger les fournisseurs."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [product?.id]);

  function clearForm() {
    reset({
      supplierId: "",
      supplierReference: "",
      lastPurchasePrice: "",
    });

    setEditingSupplierId(null);
  }

  function selectSupplier(supplier) {
    setRequestError("");
    setSuccessMessage("");
    setSupplierToRemove(null);

    const existingAssociation =
      productSuppliers.find(
        (association) =>
          association.supplier_id ===
          supplier.id
      );

    setValue(
      "supplierId",
      supplier.id,
      {
        shouldValidate: true,
      }
    );

    if (existingAssociation) {
      setEditingSupplierId(
        supplier.id
      );

      setValue(
        "supplierReference",
        existingAssociation
          .supplier_reference ?? ""
      );

      setValue(
        "lastPurchasePrice",
        existingAssociation
          .last_purchase_price ===
          null ||
          existingAssociation
            .last_purchase_price ===
            undefined
          ? ""
          : String(
              existingAssociation
                .last_purchase_price
            )
      );

      return;
    }

    setEditingSupplierId(null);

    setValue(
      "supplierReference",
      ""
    );

    setValue(
      "lastPurchasePrice",
      product?.purchase_price ===
        null ||
        product?.purchase_price ===
          undefined
        ? ""
        : String(
            product.purchase_price
          )
    );
  }

  function editAssociation(
    association
  ) {
    const supplier =
      association.supplier;

    if (!supplier) {
      return;
    }

    selectSupplier(supplier);
  }

  async function submitAssociation(
    values
  ) {
    setRequestError("");
    setSuccessMessage("");
    setSupplierToRemove(null);

    try {
      await saveProductSupplier(
        product.id,
        {
          supplierId:
            values.supplierId,

          supplierReference:
            values.supplierReference
              .trim() || null,

          lastPurchasePrice:
            values.lastPurchasePrice ===
            ""
              ? null
              : Number(
                  values.lastPurchasePrice
                ),
        }
      );

      const wasEditing = Boolean(
        editingSupplierId
      );

      await loadData({
        showLoader: false,
      });

      clearForm();

      setSuccessMessage(
        wasEditing
          ? "Les informations du fournisseur ont été mises à jour."
          : "Le fournisseur a été associé au parfum."
      );

      onChanged?.();
    } catch (error) {
      console.error(
        "Product supplier save error:",
        error
      );

      const errorMessage =
        error?.message ?? "";

      if (
        errorMessage
          .toLowerCase()
          .includes("inactive")
      ) {
        setRequestError(
          "Ce fournisseur est désactivé et ne peut pas être associé."
        );

        return;
      }

      if (
        errorMessage
          .toLowerCase()
          .includes(
            "supplier not found"
          )
      ) {
        setRequestError(
          "Ce fournisseur n’existe plus."
        );

        return;
      }

      setRequestError(
        errorMessage ||
          "Impossible d’associer ce fournisseur."
      );
    }
  }

  async function confirmRemoval() {
    if (!supplierToRemove) {
      return;
    }

    const supplierId =
      supplierToRemove.supplier_id;

    setDeletingSupplierId(
      supplierId
    );

    setRequestError("");
    setSuccessMessage("");

    try {
      await removeProductSupplier(
        product.id,
        supplierId
      );

      await loadData({
        showLoader: false,
      });

      if (
        selectedSupplierId ===
        supplierId
      ) {
        clearForm();
      }

      setSupplierToRemove(null);

      setSuccessMessage(
        "Le fournisseur a été retiré du parfum."
      );

      onChanged?.();
    } catch (error) {
      console.error(
        "Product supplier removal error:",
        error
      );

      setRequestError(
        error?.message ||
          "Impossible de retirer ce fournisseur."
      );
    } finally {
      setDeletingSupplierId(null);
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
            disabled={
              isSubmitting ||
              Boolean(
                deletingSupplierId
              )
            }
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
            FOURNISSEURS JDE
          </Text>

          <Text style={styles.title}>
            Fournisseurs du parfum
          </Text>

          <Text style={styles.subtitle}>
            Associez un ou plusieurs
            fournisseurs à ce parfum et
            conservez leurs références
            d’achat.
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

          <View style={styles.counterBox}>
            <Text
              style={styles.counterValue}
            >
              {productSuppliers.length}
            </Text>

            <Text
              style={styles.counterLabel}
            >
              fournisseur(s)
            </Text>
          </View>
        </View>

        {requestError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {requestError}
            </Text>
          </View>
        ) : null}

        {successMessage ? (
          <View style={styles.successBox}>
            <Text
              style={styles.successText}
            >
              {successMessage}
            </Text>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator
              size="large"
              color={colors.primary}
            />

            <Text
              style={styles.loadingText}
            >
              Chargement des
              fournisseurs…
            </Text>
          </View>
        ) : (
          <View style={styles.layout}>
            <View style={styles.formCard}>
              <Text
                style={
                  styles.sectionTitle
                }
              >
                {editingSupplierId
                  ? "Modifier l’association"
                  : "Associer un fournisseur"}
              </Text>

              <Text
                style={
                  styles.sectionDescription
                }
              >
                Sélectionnez un fournisseur
                actif dans la liste.
              </Text>

              {suppliers.length === 0 ? (
                <View
                  style={styles.emptyBox}
                >
                  <Text
                    style={
                      styles.emptyTitle
                    }
                  >
                    Aucun fournisseur actif
                  </Text>

                  <Text
                    style={
                      styles.emptyText
                    }
                  >
                    Créez ou réactivez un
                    fournisseur depuis la
                    gestion des
                    fournisseurs.
                  </Text>
                </View>
              ) : (
                <View
                  style={
                    styles.supplierOptions
                  }
                >
                  {suppliers.map(
                    (supplier) => {
                      const isSelected =
                        selectedSupplierId ===
                        supplier.id;

                      const isAssociated =
                        associatedSupplierIds.has(
                          supplier.id
                        );

                      return (
                        <Pressable
                          key={supplier.id}
                          style={[
                            styles.supplierOption,
                            isSelected &&
                              styles.supplierOptionSelected,
                          ]}
                          onPress={() =>
                            selectSupplier(
                              supplier
                            )
                          }
                          disabled={
                            isSubmitting
                          }
                        >
                          <View
                            style={
                              styles.supplierOptionHeader
                            }
                          >
                            <Text
                              style={[
                                styles.supplierOptionName,
                                isSelected &&
                                  styles.supplierOptionNameSelected,
                              ]}
                            >
                              {supplier.name}
                            </Text>

                            {isAssociated ? (
                              <Text
                                style={
                                  styles.associatedBadge
                                }
                              >
                                Déjà associé
                              </Text>
                            ) : null}
                          </View>

                          <Text
                            style={
                              styles.supplierOptionMeta
                            }
                          >
                            {supplier.phone ||
                              supplier.email ||
                              "Aucun contact renseigné"}
                          </Text>
                        </Pressable>
                      );
                    }
                  )}
                </View>
              )}

              {selectedSupplier ? (
                <>
                  <View
                    style={
                      styles.selectedSupplier
                    }
                  >
                    <Text
                      style={
                        styles.selectedLabel
                      }
                    >
                      Fournisseur sélectionné
                    </Text>

                    <Text
                      style={
                        styles.selectedName
                      }
                    >
                      {selectedSupplier.name}
                    </Text>

                    {selectedSupplier.address ? (
                      <Text
                        style={
                          styles.selectedMeta
                        }
                      >
                        {
                          selectedSupplier.address
                        }
                      </Text>
                    ) : null}
                  </View>

                  <View
                    style={styles.formGrid}
                  >
                    <FormInput
                      control={control}
                      name="supplierReference"
                      label="Référence fournisseur"
                      placeholder="Exemple : DIOR-SAUVAGE-100"
                      error={
                        errors.supplierReference
                      }
                    />

                    <FormInput
                      control={control}
                      name="lastPurchasePrice"
                      label="Dernier prix d’achat (FCFA)"
                      placeholder="350000"
                      keyboardType="numeric"
                      error={
                        errors.lastPurchasePrice
                      }
                    />
                  </View>

                  <View
                    style={styles.actions}
                  >
                    <Pressable
                      style={({ pressed }) => [
                        styles.cancelButton,
                        pressed &&
                          styles.pressed,
                      ]}
                      onPress={clearForm}
                      disabled={
                        isSubmitting
                      }
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
                        pressed &&
                          styles.pressed,
                        isSubmitting &&
                          styles.disabledButton,
                      ]}
                      onPress={handleSubmit(
                        submitAssociation
                      )}
                      disabled={
                        isSubmitting
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
                          {editingSupplierId
                            ? "Mettre à jour"
                            : "Associer le fournisseur"}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>

            <View style={styles.listCard}>
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Fournisseurs associés
              </Text>

              <Text
                style={
                  styles.sectionDescription
                }
              >
                Les fournisseurs
                actuellement liés à ce
                parfum.
              </Text>

              {productSuppliers.length ===
              0 ? (
                <View
                  style={styles.emptyBox}
                >
                  <Text
                    style={
                      styles.emptyTitle
                    }
                  >
                    Aucun fournisseur
                  </Text>

                  <Text
                    style={
                      styles.emptyText
                    }
                  >
                    Sélectionnez un
                    fournisseur pour créer
                    la première association.
                  </Text>
                </View>
              ) : (
                <View
                  style={
                    styles.associationList
                  }
                >
                  {productSuppliers.map(
                    (association) => {
                      const supplier =
                        association.supplier;

                      const isDeleting =
                        deletingSupplierId ===
                        association.supplier_id;

                      return (
                        <View
                          key={
                            association.supplier_id
                          }
                          style={
                            styles.associationCard
                          }
                        >
                          <View
                            style={
                              styles.associationHeader
                            }
                          >
                            <View
                              style={
                                styles.associationIdentity
                              }
                            >
                              <Text
                                style={
                                  styles.associationName
                                }
                              >
                                {supplier?.name ||
                                  "Fournisseur"}
                              </Text>

                              <Text
                                style={
                                  supplier?.is_active ===
                                  false
                                    ? styles.inactiveStatus
                                    : styles.activeStatus
                                }
                              >
                                {supplier?.is_active ===
                                false
                                  ? "Inactif"
                                  : "Actif"}
                              </Text>
                            </View>

                            <Text
                              style={
                                styles.associationPrice
                              }
                            >
                              {formatPrice(
                                association.last_purchase_price
                              )}
                            </Text>
                          </View>

                          <View
                            style={
                              styles.associationDetails
                            }
                          >
                            <Text
                              style={
                                styles.detailLabel
                              }
                            >
                              Référence
                            </Text>

                            <Text
                              style={
                                styles.detailValue
                              }
                            >
                              {association.supplier_reference ||
                                "Non renseignée"}
                            </Text>

                            {supplier?.phone ? (
                              <>
                                <Text
                                  style={
                                    styles.detailLabel
                                  }
                                >
                                  Téléphone
                                </Text>

                                <Text
                                  style={
                                    styles.detailValue
                                  }
                                >
                                  {
                                    supplier.phone
                                  }
                                </Text>
                              </>
                            ) : null}

                            {supplier?.email ? (
                              <>
                                <Text
                                  style={
                                    styles.detailLabel
                                  }
                                >
                                  E-mail
                                </Text>

                                <Text
                                  style={
                                    styles.detailValue
                                  }
                                >
                                  {
                                    supplier.email
                                  }
                                </Text>
                              </>
                            ) : null}
                          </View>

                          {supplierToRemove
                            ?.supplier_id ===
                          association.supplier_id ? (
                            <View
                              style={
                                styles.confirmationBox
                              }
                            >
                              <Text
                                style={
                                  styles.confirmationText
                                }
                              >
                                Retirer ce
                                fournisseur du
                                parfum ?
                              </Text>

                              <View
                                style={
                                  styles.confirmationActions
                                }
                              >
                                <Pressable
                                  style={
                                    styles.smallCancelButton
                                  }
                                  onPress={() =>
                                    setSupplierToRemove(
                                      null
                                    )
                                  }
                                  disabled={
                                    isDeleting
                                  }
                                >
                                  <Text
                                    style={
                                      styles.smallCancelText
                                    }
                                  >
                                    Non
                                  </Text>
                                </Pressable>

                                <Pressable
                                  style={
                                    styles.removeButton
                                  }
                                  onPress={
                                    confirmRemoval
                                  }
                                  disabled={
                                    isDeleting
                                  }
                                >
                                  {isDeleting ? (
                                    <ActivityIndicator
                                      color="#FFFFFF"
                                    />
                                  ) : (
                                    <Text
                                      style={
                                        styles.removeButtonText
                                      }
                                    >
                                      Oui, retirer
                                    </Text>
                                  )}
                                </Pressable>
                              </View>
                            </View>
                          ) : (
                            <View
                              style={
                                styles.cardActions
                              }
                            >
                              <Pressable
                                style={
                                  styles.editButton
                                }
                                onPress={() =>
                                  editAssociation(
                                    association
                                  )
                                }
                              >
                                <Text
                                  style={
                                    styles.editButtonText
                                  }
                                >
                                  Modifier
                                </Text>
                              </Pressable>

                              <Pressable
                                style={
                                  styles.removeOutlineButton
                                }
                                onPress={() =>
                                  setSupplierToRemove(
                                    association
                                  )
                                }
                              >
                                <Text
                                  style={
                                    styles.removeOutlineText
                                  }
                                >
                                  Retirer
                                </Text>
                              </Pressable>
                            </View>
                          )}
                        </View>
                      );
                    }
                  )}
                </View>
              )}
            </View>
          </View>
        )}
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
    maxWidth: 1180,
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

  counterBox: {
    minWidth: 130,
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor:
      colors.secondaryLight,
  },

  counterValue: {
    color: colors.primaryDark,
    fontSize: 29,
    fontWeight: "900",
  },

  counterLabel: {
    color: colors.textMuted,
    fontSize: 11,
  },

  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    minHeight: 260,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },

  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },

  layout: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 20,
  },

  formCard: {
    flexGrow: 1,
    flexBasis: 500,
    padding: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  listCard: {
    flexGrow: 1,
    flexBasis: 500,
    padding: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  sectionTitle: {
    color: colors.primaryDark,
    fontSize: 20,
    fontWeight: "800",
  },

  sectionDescription: {
    marginTop: 5,
    marginBottom: 17,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },

  supplierOptions: {
    gap: 9,
  },

  supplierOption: {
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:
      colors.inputBackground,
  },

  supplierOptionSelected: {
    borderColor: colors.primary,
    backgroundColor:
      colors.secondaryLight,
  },

  supplierOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },

  supplierOptionName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },

  supplierOptionNameSelected: {
    color: colors.primaryDark,
  },

  supplierOptionMeta: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
  },

  associatedBadge: {
    color: colors.secondaryDark,
    fontSize: 10,
    fontWeight: "800",
  },

  selectedSupplier: {
    marginTop: 20,
    marginBottom: 16,
    padding: 15,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
    backgroundColor:
      colors.secondaryLight,
  },

  selectedLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  selectedName: {
    marginTop: 4,
    color: colors.primaryDark,
    fontSize: 17,
    fontWeight: "800",
  },

  selectedMeta: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 12,
  },

  formGrid: {
    gap: 15,
  },

  field: {
    gap: 7,
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

  inputError: {
    borderColor: colors.danger,
  },

  fieldError: {
    color: colors.danger,
    fontSize: 12,
  },

  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 20,
  },

  cancelButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },

  cancelButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },

  submitButton: {
    minHeight: 48,
    minWidth: 180,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },

  submitButtonText: {
    color: colors.textOnPrimary,
    fontSize: 13,
    fontWeight: "800",
  },

  associationList: {
    gap: 12,
  },

  associationCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:
      colors.inputBackground,
  },

  associationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },

  associationIdentity: {
    gap: 4,
  },

  associationName: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: "800",
  },

  activeStatus: {
    color: "#34734A",
    fontSize: 11,
    fontWeight: "800",
  },

  inactiveStatus: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "800",
  },

  associationPrice: {
    color: colors.secondaryDark,
    fontSize: 14,
    fontWeight: "800",
  },

  associationDetails: {
    marginTop: 14,
    gap: 3,
  },

  detailLabel: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  detailValue: {
    color: colors.text,
    fontSize: 13,
  },

  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 16,
  },

  editButton: {
    minHeight: 39,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 9,
    backgroundColor: colors.primary,
  },

  editButtonText: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: "800",
  },

  removeOutlineButton: {
    minHeight: 39,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.danger,
  },

  removeOutlineText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
  },

  confirmationBox: {
    marginTop: 15,
    padding: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor:
      colors.dangerLight,
  },

  confirmationText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
  },

  confirmationActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 11,
  },

  smallCancelButton: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  smallCancelText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },

  removeButton: {
    minHeight: 38,
    minWidth: 110,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.danger,
  },

  removeButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  emptyBox: {
    alignItems: "center",
    padding: 24,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:
      colors.inputBackground,
  },

  emptyTitle: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },

  emptyText: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },

  errorBox: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor:
      colors.dangerLight,
  },

  errorText: {
    color: colors.danger,
    fontSize: 14,
  },

  successBox: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#6B9A78",
    backgroundColor: "#EEF7F0",
  },

  successText: {
    color: "#34734A",
    fontSize: 14,
    fontWeight: "700",
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
