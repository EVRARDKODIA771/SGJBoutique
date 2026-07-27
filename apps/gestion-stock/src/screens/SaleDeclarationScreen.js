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
  getProducts,
  recordStockMovement,
} from "../services/stockService.js";

import {
  colors,
} from "../theme/colors.js";

export default function SaleDeclarationScreen({
  onBack,
  onCompleted,
}) {
  const [products, setProducts] =
    useState([]);

  const [
    selectedProductId,
    setSelectedProductId,
  ] = useState("");

  const [
    clientName,
    setClientName,
  ] = useState("");

  const [
    clientPhone,
    setClientPhone,
  ] = useState("");

  const [
    isProductDropdownOpen,
    setIsProductDropdownOpen,
  ] = useState(false);

  const [
    productSearch,
    setProductSearch,
  ] = useState("");

  const [quantity, setQuantity] =
    useState("1");

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    async function loadProducts() {
      try {
        const result =
          await getProducts({
            page: 1,
            limit: 100,
          });

        const availableProducts =
          (result.products ?? []).filter(
            (product) =>
              (product.stock_quantity ??
                0) > 0
          );

        setProducts(availableProducts);

        if (
          availableProducts.length === 1
        ) {
          setSelectedProductId(
            availableProducts[0].id
          );
        }
      } catch (error) {
        console.error(
          "Sale products loading error:",
          error
        );

        setErrorMessage(
          "Impossible de charger les parfums."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadProducts();
  }, []);

  const selectedProduct =
    products.find(
      (product) =>
        product.id ===
        selectedProductId
    ) ?? null;

  const filteredProducts =
    useMemo(() => {
      const normalizedSearch =
        productSearch
          .trim()
          .toLocaleLowerCase(
            "fr-FR"
          );

      if (!normalizedSearch) {
        return products;
      }

      return products.filter(
        (product) => {
          const searchableText = [
            product.name,
            product.brand,
            product.sku,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase(
              "fr-FR"
            );

          return searchableText.includes(
            normalizedSearch
          );
        }
      );
    }, [
      productSearch,
      products,
    ]);

  async function submitSale() {
    const parsedQuantity =
      Number(quantity);

    if (!selectedProductId) {
      setErrorMessage(
        "Choisissez le parfum vendu."
      );
      return;
    }

    if (
      !clientName.trim()
    ) {
      setErrorMessage(
        "Saisissez le nom du client."
      );
      return;
    }

    if (
      !Number.isInteger(
        parsedQuantity
      ) ||
      parsedQuantity <= 0
    ) {
      setErrorMessage(
        "La quantité doit être un nombre entier supérieur à zéro."
      );
      return;
    }

    if (
      parsedQuantity >
      (selectedProduct?.stock_quantity ??
        0)
    ) {
      setErrorMessage(
        "La quantité demandée dépasse le stock disponible."
      );
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      await recordStockMovement(
        selectedProductId,
        {
          movementType: "sale",
          quantity: parsedQuantity,
          reason:
            "Parfum acheté par un client",
          reference:
            [
              clientName.trim(),
              clientPhone.trim(),
            ]
              .filter(Boolean)
              .join(" · "),
        }
      );

      onCompleted?.();
    } catch (error) {
      console.error(
        "Sale declaration error:",
        error
      );

      setErrorMessage(
        error?.message ||
          "Impossible d’enregistrer la vente."
      );
    } finally {
      setIsSaving(false);
    }
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
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          onPress={onBack}
        >
          <Text
            style={styles.backButtonText}
          >
            ‹ Tableau de bord
          </Text>
        </Pressable>

        <View style={styles.heading}>
          <Text style={styles.eyebrow}>
            VENTE
          </Text>

          <Text style={styles.title}>
            Déclarer un parfum acheté par un
            client
          </Text>

          <Text style={styles.subtitle}>
            La quantité sera immédiatement
            retirée du stock.
          </Text>
        </View>

        <View style={styles.formCard}>
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text
                style={styles.errorText}
              >
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>
            Parfum vendu *
          </Text>

          {isLoading ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
            />
          ) : products.length === 0 ? (
            <Text style={styles.emptyText}>
              Aucun parfum disponible en
              stock.
            </Text>
          ) : (
            <View
              style={
                styles.dropdownContainer
              }
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  expanded:
                    isProductDropdownOpen,
                }}
                style={({ pressed }) => [
                  styles.dropdownButton,
                  isProductDropdownOpen &&
                    styles.dropdownButtonOpen,
                  pressed &&
                    styles.pressed,
                ]}
                onPress={() => {
                  setIsProductDropdownOpen(
                    (current) =>
                      !current
                  );

                  setProductSearch("");
                }}
              >
                <View
                  style={
                    styles.dropdownButtonTextArea
                  }
                >
                  <Text
                    style={[
                      styles.dropdownValue,
                      !selectedProduct &&
                        styles.dropdownPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {selectedProduct
                      ? selectedProduct.name
                      : "Choisir un parfum"}
                  </Text>

                  {selectedProduct ? (
                    <Text
                      style={
                        styles.dropdownStock
                      }
                      numberOfLines={1}
                    >
                      {selectedProduct.brand ||
                        "Sans marque"}
                      {" · Stock : "}
                      {
                        selectedProduct.stock_quantity
                      }
                    </Text>
                  ) : null}
                </View>

                <Text
                  style={
                    styles.dropdownArrow
                  }
                >
                  {isProductDropdownOpen
                    ? "⌃"
                    : "⌄"}
                </Text>
              </Pressable>

              {isProductDropdownOpen ? (
                <View
                  style={
                    styles.dropdownPanel
                  }
                >
                  <TextInput
                    style={
                      styles.dropdownSearch
                    }
                    value={productSearch}
                    onChangeText={
                      setProductSearch
                    }
                    placeholder="Rechercher par nom, marque ou SKU…"
                    placeholderTextColor={
                      colors.textMuted
                    }
                    autoFocus
                  />

                  <ScrollView
                    style={
                      styles.dropdownList
                    }
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator
                  >
                    {filteredProducts.length ===
                    0 ? (
                      <Text
                        style={
                          styles.dropdownEmpty
                        }
                      >
                        Aucun parfum trouvé.
                      </Text>
                    ) : (
                      filteredProducts.map(
                        (product) => {
                          const selected =
                            product.id ===
                            selectedProductId;

                          return (
                            <Pressable
                              key={
                                product.id
                              }
                              style={({
                                pressed,
                              }) => [
                                styles.dropdownOption,
                                selected &&
                                  styles.dropdownOptionSelected,
                                pressed &&
                                  styles.pressed,
                              ]}
                              onPress={() => {
                                setSelectedProductId(
                                  product.id
                                );

                                setIsProductDropdownOpen(
                                  false
                                );

                                setProductSearch(
                                  ""
                                );
                              }}
                            >
                              <View
                                style={
                                  styles.dropdownOptionTextArea
                                }
                              >
                                <Text
                                  style={[
                                    styles.dropdownOptionName,
                                    selected &&
                                      styles.dropdownOptionNameSelected,
                                  ]}
                                  numberOfLines={
                                    1
                                  }
                                >
                                  {
                                    product.name
                                  }
                                </Text>

                                <Text
                                  style={
                                    styles.dropdownOptionMeta
                                  }
                                  numberOfLines={
                                    1
                                  }
                                >
                                  {product.brand ||
                                    "Sans marque"}
                                  {product.sku
                                    ? ` · ${product.sku}`
                                    : ""}
                                </Text>
                              </View>

                              <Text
                                style={
                                  styles.dropdownOptionStock
                                }
                              >
                                Stock :{" "}
                                {
                                  product.stock_quantity
                                }
                              </Text>
                            </Pressable>
                          );
                        }
                      )
                    )}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          )}

          <Text style={styles.label}>
            Nom du client *
          </Text>

          <TextInput
            style={styles.input}
            value={clientName}
            onChangeText={
              setClientName
            }
            placeholder="Exemple : Aminata"
            placeholderTextColor={
              colors.textMuted
            }
            maxLength={100}
          />

          <Text style={styles.label}>
            Numéro du client
          </Text>

          <TextInput
            style={styles.input}
            value={clientPhone}
            onChangeText={setClientPhone}
            placeholder="Exemple : 07 00 00 00 00"
            placeholderTextColor={
              colors.textMuted
            }
            keyboardType="phone-pad"
            inputMode="tel"
            maxLength={30}
          />

          <Text style={styles.label}>
            Quantité achetée *
          </Text>

          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={(value) =>
              setQuantity(
                value.replace(
                  /[^0-9]/g,
                  ""
                )
              )
            }
            placeholder="1"
            placeholderTextColor={
              colors.textMuted
            }
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={5}
          />

          {selectedProduct ? (
            <Text style={styles.stockHint}>
              Stock disponible :{" "}
              {
                selectedProduct.stock_quantity
              }
            </Text>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.pressed,
              (isSaving ||
                isLoading ||
                products.length === 0) &&
                styles.disabledButton,
            ]}
            disabled={
              isSaving ||
              isLoading ||
              products.length === 0
            }
            onPress={submitSale}
          >
            {isSaving ? (
              <ActivityIndicator
                size="small"
                color={colors.white}
              />
            ) : (
              <Text
                style={
                  styles.submitButtonText
                }
              >
                Valider la vente
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor:
      colors.background,
  },

  scrollContent: {
    paddingBottom: 35,
  },

  container: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
  },

  backButton: {
    alignSelf: "flex-start",
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 13,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  backButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },

  heading: {
    paddingVertical: 20,
  },

  eyebrow: {
    color: colors.secondaryDark,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },

  title: {
    marginTop: 5,
    color: colors.primaryDark,
    fontSize: 27,
    fontWeight: "900",
  },

  subtitle: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 13,
  },

  formCard: {
    padding: 17,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  errorBox: {
    marginBottom: 14,
    padding: 11,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },

  errorText: {
    color: colors.danger,
    fontSize: 12,
  },

  label: {
    marginTop: 15,
    marginBottom: 7,
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "800",
  },

  dropdownContainer: {
    position: "relative",
    zIndex: 20,
  },

  dropdownButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:
      colors.inputBackground,
  },

  dropdownButtonOpen: {
    borderColor: colors.primary,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },

  dropdownButtonTextArea: {
    flex: 1,
    minWidth: 0,
  },

  dropdownValue: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "800",
  },

  dropdownPlaceholder: {
    color: colors.textMuted,
    fontWeight: "500",
  },

  dropdownStock: {
    marginTop: 2,
    color: colors.success,
    fontSize: 11,
    fontWeight: "700",
  },

  dropdownArrow: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "900",
  },

  dropdownPanel: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.primary,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },

  dropdownSearch: {
    minHeight: 43,
    margin: 8,
    paddingHorizontal: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:
      colors.background,
    color: colors.text,
    fontSize: 13,
  },

  dropdownList: {
    maxHeight: 245,
  },

  dropdownOption: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  dropdownOptionSelected: {
    backgroundColor:
      colors.primaryLight,
  },

  dropdownOptionTextArea: {
    flex: 1,
    minWidth: 0,
  },

  dropdownOptionName: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
  },

  dropdownOptionNameSelected: {
    color: colors.primary,
  },

  dropdownOptionMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 10,
  },

  dropdownOptionStock: {
    color: colors.success,
    fontSize: 10,
    fontWeight: "800",
  },

  dropdownEmpty: {
    padding: 14,
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
  },

  input: {
    minHeight: 48,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:
      colors.inputBackground,
    color: colors.text,
    fontSize: 14,
  },

  stockHint: {
    marginTop: 8,
    color: colors.success,
    fontSize: 12,
    fontWeight: "800",
  },

  submitButton: {
    minHeight: 49,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 23,
    borderRadius: 11,
    backgroundColor: colors.success,
  },

  submitButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "900",
  },

  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
  },

  disabledButton: {
    opacity: 0.5,
  },

  pressed: {
    opacity: 0.75,
  },
});
