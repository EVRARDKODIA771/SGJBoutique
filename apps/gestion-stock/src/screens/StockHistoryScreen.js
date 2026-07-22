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
  View,
} from "react-native";

import {
  getGlobalStockMovements,
  getProducts,
} from "../services/stockService.js";

import { colors } from
  "../theme/colors.js";

const movementTypes = [
  {
    value: "",
    label: "Tous",
  },
  {
    value: "initial",
    label: "Stock initial",
  },
  {
    value: "purchase",
    label: "Achats",
  },
  {
    value: "sale",
    label: "Ventes",
  },
  {
    value: "return",
    label: "Retours",
  },
  {
    value: "damage",
    label: "Dommages",
  },
  {
    value: "loss",
    label: "Pertes",
  },
  {
    value: "adjustment",
    label: "Ajustements",
  },
];

const movementLabels = {
  initial: "Stock initial",
  purchase: "Achat",
  sale: "Vente",
  return: "Retour",
  damage: "Dommage",
  loss: "Perte",
  adjustment: "Ajustement",
};

function formatDate(value) {
  if (!value) {
    return "Date inconnue";
  }

  try {
    return new Intl.DateTimeFormat(
      "fr-FR",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    ).format(new Date(value));
  } catch {
    return value;
  }
}

export default function StockHistoryScreen({
  onBack,
  onOpenProduct,
}) {
  const [movements, setMovements] =
    useState([]);

  const [products, setProducts] =
    useState([]);

  const [
    selectedMovementType,
    setSelectedMovementType,
  ] = useState("");

  const [
    selectedProductId,
    setSelectedProductId,
  ] = useState("");

  const [page, setPage] =
    useState(1);

  const [pagination, setPagination] =
    useState({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });

  const [isLoading, setIsLoading] =
    useState(true);

  const [requestError, setRequestError] =
    useState("");

  const pageTotals = useMemo(() => {
    return movements.reduce(
      (totals, movement) => {
        const quantity = Number(
          movement.quantity_change ?? 0
        );

        if (quantity > 0) {
          totals.entries += quantity;
        }

        if (quantity < 0) {
          totals.exits +=
            Math.abs(quantity);
        }

        return totals;
      },
      {
        entries: 0,
        exits: 0,
      }
    );
  }, [movements]);

  async function loadProducts() {
    try {
      const result =
        await getProducts({
          page: 1,
          limit: 100,
        });

      setProducts(
        result.products ?? []
      );
    } catch (error) {
      console.error(
        "Stock products loading error:",
        error
      );
    }
  }

  async function loadMovements() {
    setIsLoading(true);
    setRequestError("");

    try {
      const result =
        await getGlobalStockMovements({
          movementType:
            selectedMovementType ||
            undefined,

          productId:
            selectedProductId ||
            undefined,

          page,
          limit: 20,
        });

      setMovements(
        result.movements ?? []
      );

      setPagination(
        result.pagination ?? {
          page,
          limit: 20,
          total: 0,
          totalPages: 0,
        }
      );
    } catch (error) {
      console.error(
        "Global stock movements loading error:",
        error
      );

      setRequestError(
        error?.message ||
          "Impossible de charger l’historique du stock."
      );

      setMovements([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    loadMovements();
  }, [
    page,
    selectedMovementType,
    selectedProductId,
  ]);

  function selectMovementType(
    movementType
  ) {
    setSelectedMovementType(
      movementType
    );

    setPage(1);
  }

  function selectProduct(
    productId
  ) {
    setSelectedProductId(
      productId
    );

    setPage(1);
  }

  function clearFilters() {
    setSelectedMovementType("");
    setSelectedProductId("");
    setPage(1);
  }

  const hasFilters =
    Boolean(selectedMovementType) ||
    Boolean(selectedProductId);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.scrollContent
      }
    >
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            onPress={onBack}
          >
            <Text
              style={
                styles.backButtonText
              }
            >
              ‹ Retour au tableau de bord
            </Text>
          </Pressable>
        </View>

        <View style={styles.heading}>
          <Text style={styles.eyebrow}>
            STOCK JDE
          </Text>

          <Text style={styles.title}>
            Historique du stock
          </Text>

          <Text style={styles.subtitle}>
            Consultez toutes les entrées,
            sorties et corrections
            enregistrées pour les parfums.
          </Text>
        </View>

        {requestError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {requestError}
            </Text>

            <Pressable
              style={styles.retryButton}
              onPress={loadMovements}
            >
              <Text
                style={
                  styles.retryButtonText
                }
              >
                Réessayer
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text
              style={styles.summaryLabel}
            >
              Mouvements trouvés
            </Text>

            <Text
              style={styles.summaryValue}
            >
              {pagination.total ?? 0}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text
              style={styles.summaryLabel}
            >
              Entrées sur cette page
            </Text>

            <Text
              style={[
                styles.summaryValue,
                styles.entryValue,
              ]}
            >
              +{pageTotals.entries}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text
              style={styles.summaryLabel}
            >
              Sorties sur cette page
            </Text>

            <Text
              style={[
                styles.summaryValue,
                styles.exitValue,
              ]}
            >
              −{pageTotals.exits}
            </Text>
          </View>
        </View>

        <View style={styles.filterCard}>
          <View style={styles.filterHeader}>
            <View>
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Filtres
              </Text>

              <Text
                style={
                  styles.sectionDescription
                }
              >
                Filtrez par type de
                mouvement ou par parfum.
              </Text>
            </View>

            {hasFilters ? (
              <Pressable
                style={({ pressed }) => [
                  styles.clearButton,
                  pressed &&
                    styles.pressed,
                ]}
                onPress={clearFilters}
              >
                <Text
                  style={
                    styles.clearButtonText
                  }
                >
                  Réinitialiser
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.filterLabel}>
            Type de mouvement
          </Text>

          <View style={styles.chipList}>
            {movementTypes.map(
              (movementType) => {
                const isSelected =
                  selectedMovementType ===
                  movementType.value;

                return (
                  <Pressable
                    key={
                      movementType.value ||
                      "all"
                    }
                    style={[
                      styles.chip,
                      isSelected &&
                        styles.chipSelected,
                    ]}
                    onPress={() =>
                      selectMovementType(
                        movementType.value
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSelected &&
                          styles.chipTextSelected,
                      ]}
                    >
                      {movementType.label}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </View>

          <Text style={styles.filterLabel}>
            Parfum
          </Text>

          <View style={styles.chipList}>
            <Pressable
              style={[
                styles.chip,
                selectedProductId ===
                  "" &&
                  styles.chipSelected,
              ]}
              onPress={() =>
                selectProduct("")
              }
            >
              <Text
                style={[
                  styles.chipText,
                  selectedProductId ===
                    "" &&
                    styles.chipTextSelected,
                ]}
              >
                Tous les parfums
              </Text>
            </Pressable>

            {products.map((product) => {
              const isSelected =
                selectedProductId ===
                product.id;

              return (
                <Pressable
                  key={product.id}
                  style={[
                    styles.chip,
                    isSelected &&
                      styles.chipSelected,
                  ]}
                  onPress={() =>
                    selectProduct(
                      product.id
                    )
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected &&
                        styles.chipTextSelected,
                    ]}
                  >
                    {product.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <View>
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Mouvements enregistrés
              </Text>

              <Text
                style={
                  styles.sectionDescription
                }
              >
                Page {pagination.page ?? page}
                {" sur "}
                {Math.max(
                  pagination.totalPages ??
                    0,
                  1
                )}
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.refreshButton,
                pressed && styles.pressed,
              ]}
              onPress={loadMovements}
              disabled={isLoading}
            >
              <Text
                style={
                  styles.refreshButtonText
                }
              >
                Actualiser
              </Text>
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator
                size="large"
                color={colors.primary}
              />

              <Text
                style={styles.loadingText}
              >
                Chargement de
                l’historique…
              </Text>
            </View>
          ) : movements.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text
                style={styles.emptyTitle}
              >
                Aucun mouvement
              </Text>

              <Text
                style={styles.emptyText}
              >
                Aucun mouvement ne
                correspond aux filtres
                sélectionnés.
              </Text>
            </View>
          ) : (
            <View style={styles.movementList}>
              {movements.map(
                (movement) => {
                  const quantity = Number(
                    movement.quantity_change ??
                      0
                  );

                  const isEntry =
                    quantity > 0;

                  const product =
                    movement.product;

                  return (
                    <View
                      key={movement.id}
                      style={
                        styles.movementCard
                      }
                    >
                      <View
                        style={
                          styles.movementTop
                        }
                      >
                        <View
                          style={
                            styles.movementIdentity
                          }
                        >
                          <Text
                            style={
                              styles.movementType
                            }
                          >
                            {movementLabels[
                              movement
                                .movement_type
                            ] ||
                              movement.movement_type}
                          </Text>

                          <Text
                            style={
                              styles.movementDate
                            }
                          >
                            {formatDate(
                              movement.created_at
                            )}
                          </Text>
                        </View>

                        <Text
                          style={[
                            styles.quantityChange,
                            isEntry
                              ? styles.entryValue
                              : styles.exitValue,
                          ]}
                        >
                          {quantity > 0
                            ? `+${quantity}`
                            : quantity}
                        </Text>
                      </View>

                      <Pressable
                        style={({ pressed }) => [
                          styles.productArea,
                          pressed &&
                            onOpenProduct &&
                            styles.pressed,
                        ]}
                        onPress={() => {
                          if (
                            product &&
                            onOpenProduct
                          ) {
                            onOpenProduct(
                              product
                            );
                          }
                        }}
                        disabled={
                          !product ||
                          !onOpenProduct
                        }
                      >
                        <Text
                          style={
                            styles.productName
                          }
                        >
                          {product?.name ||
                            "Parfum supprimé"}
                        </Text>

                        <Text
                          style={
                            styles.productMeta
                          }
                        >
                          {product?.brand ||
                            "Marque non renseignée"}

                          {product?.sku
                            ? ` • ${product.sku}`
                            : ""}
                        </Text>
                      </Pressable>

                      <View
                        style={styles.stockFlow}
                      >
                        <View
                          style={
                            styles.stockValueBox
                          }
                        >
                          <Text
                            style={
                              styles.stockLabel
                            }
                          >
                            Avant
                          </Text>

                          <Text
                            style={
                              styles.stockValue
                            }
                          >
                            {
                              movement.quantity_before
                            }
                          </Text>
                        </View>

                        <Text
                          style={
                            styles.stockArrow
                          }
                        >
                          →
                        </Text>

                        <View
                          style={
                            styles.stockValueBox
                          }
                        >
                          <Text
                            style={
                              styles.stockLabel
                            }
                          >
                            Après
                          </Text>

                          <Text
                            style={
                              styles.stockValue
                            }
                          >
                            {
                              movement.quantity_after
                            }
                          </Text>
                        </View>
                      </View>

                      {movement.reason ||
                      movement.reference ? (
                        <View
                          style={
                            styles.detailsBox
                          }
                        >
                          {movement.reason ? (
                            <View>
                              <Text
                                style={
                                  styles.detailLabel
                                }
                              >
                                Raison
                              </Text>

                              <Text
                                style={
                                  styles.detailValue
                                }
                              >
                                {movement.reason}
                              </Text>
                            </View>
                          ) : null}

                          {movement.reference ? (
                            <View>
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
                                {
                                  movement.reference
                                }
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                }
              )}
            </View>
          )}

          {!isLoading &&
          pagination.totalPages > 1 ? (
            <View
              style={styles.pagination}
            >
              <Pressable
                style={[
                  styles.pageButton,
                  page <= 1 &&
                    styles.disabledButton,
                ]}
                onPress={() =>
                  setPage((current) =>
                    Math.max(
                      current - 1,
                      1
                    )
                  )
                }
                disabled={page <= 1}
              >
                <Text
                  style={
                    styles.pageButtonText
                  }
                >
                  ‹ Précédent
                </Text>
              </Pressable>

              <Text
                style={styles.pageText}
              >
                Page {page} sur{" "}
                {pagination.totalPages}
              </Text>

              <Pressable
                style={[
                  styles.pageButton,
                  page >=
                    pagination.totalPages &&
                    styles.disabledButton,
                ]}
                onPress={() =>
                  setPage((current) =>
                    Math.min(
                      current + 1,
                      pagination.totalPages
                    )
                  )
                }
                disabled={
                  page >=
                  pagination.totalPages
                }
              >
                <Text
                  style={
                    styles.pageButtonText
                  }
                >
                  Suivant ›
                </Text>
              </Pressable>
            </View>
          ) : null}
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

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 20,
  },

  summaryCard: {
    flexGrow: 1,
    flexBasis: 220,
    padding: 18,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  summaryLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },

  summaryValue: {
    marginTop: 5,
    color: colors.primaryDark,
    fontSize: 27,
    fontWeight: "900",
  },

  entryValue: {
    color: "#34734A",
  },

  exitValue: {
    color: colors.danger,
  },

  filterCard: {
    marginBottom: 20,
    padding: 21,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  filterHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },

  sectionTitle: {
    color: colors.primaryDark,
    fontSize: 20,
    fontWeight: "800",
  },

  sectionDescription: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 13,
  },

  filterLabel: {
    marginTop: 19,
    marginBottom: 9,
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },

  chipList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  chip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:
      colors.inputBackground,
  },

  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },

  chipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },

  chipTextSelected: {
    color: colors.textOnPrimary,
  },

  clearButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 13,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.primary,
  },

  clearButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },

  historyCard: {
    padding: 21,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  historyHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 18,
  },

  refreshButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 9,
    backgroundColor: colors.primary,
  },

  refreshButtonText: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: "800",
  },

  loadingBox: {
    minHeight: 230,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },

  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },

  movementList: {
    gap: 12,
  },

  movementCard: {
    padding: 17,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:
      colors.inputBackground,
  },

  movementTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  movementIdentity: {
    flexShrink: 1,
  },

  movementType: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: "800",
  },

  movementDate: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 11,
  },

  quantityChange: {
    fontSize: 22,
    fontWeight: "900",
  },

  productArea: {
    marginTop: 14,
    padding: 13,
    borderRadius: 11,
    backgroundColor:
      colors.secondaryLight,
  },

  productName: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "800",
  },

  productMeta: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 11,
  },

  stockFlow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginTop: 15,
  },

  stockValueBox: {
    minWidth: 90,
    alignItems: "center",
  },

  stockLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },

  stockValue: {
    marginTop: 3,
    color: colors.primaryDark,
    fontSize: 20,
    fontWeight: "900",
  },

  stockArrow: {
    color: colors.secondaryDark,
    fontSize: 22,
    fontWeight: "800",
  },

  detailsBox: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    marginTop: 15,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  detailLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  detailValue: {
    marginTop: 3,
    color: colors.text,
    fontSize: 12,
  },

  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 13,
    marginTop: 22,
  },

  pageButton: {
    minHeight: 41,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    borderRadius: 9,
    backgroundColor: colors.primary,
  },

  pageButtonText: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: "800",
  },

  pageText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },

  emptyBox: {
    minHeight: 210,
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:
      colors.inputBackground,
  },

  emptyTitle: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: "800",
  },

  emptyText: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 12,
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

  retryButton: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.danger,
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.5,
  },

  pressed: {
    opacity: 0.83,
  },
});
