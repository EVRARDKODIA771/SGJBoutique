import {
  useCallback,
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

import {
  colors,
} from "../theme/colors.js";

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
        dateStyle: "short",
        timeStyle: "short",
      }
    ).format(new Date(value));
  } catch {
    return value;
  }
}

function FilterChip({
  label,
  selected,
  onPress,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{
        selected,
      }}
      style={({ pressed }) => [
        styles.filterChip,
        selected &&
          styles.filterChipSelected,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.filterChipText,
          selected &&
            styles.filterChipTextSelected,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SummaryItem({
  label,
  value,
  valueStyle,
}) {
  return (
    <View style={styles.summaryItem}>
      <Text
        style={styles.summaryLabel}
        numberOfLines={1}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.summaryValue,
          valueStyle,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function TableCell({
  style,
  textStyle,
  children,
  numberOfLines = 1,
}) {
  return (
    <View
      style={[
        styles.tableCell,
        style,
      ]}
    >
      <Text
        style={[
          styles.cellText,
          textStyle,
        ]}
        numberOfLines={numberOfLines}
      >
        {children}
      </Text>
    </View>
  );
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
        } else if (quantity < 0) {
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

  const loadProducts = useCallback(
    async () => {
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
    },
    []
  );

  const loadMovements = useCallback(
    async () => {
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
            "Impossible de charger l’historique des entrées et sorties."
        );

        setMovements([]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      page,
      selectedMovementType,
      selectedProductId,
    ]
  );

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

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
              style={styles.backButtonText}
            >
              ‹ Tableau de bord
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.pressed,
              isLoading &&
                styles.disabledButton,
            ]}
            disabled={isLoading}
            onPress={loadMovements}
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

        <View style={styles.heading}>
          <Text style={styles.eyebrow}>
            STOCK JDE
          </Text>

          <Text style={styles.title}>
            Historique des entrées et sorties
          </Text>

          <Text style={styles.subtitle}>
            Consultez toutes les opérations
            enregistrées pour les parfums.
          </Text>
        </View>

        <View style={styles.filtersCard}>
          <View style={styles.filterLine}>
            <Text
              style={styles.filterLabel}
            >
              Type
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.filterChipList
              }
            >
              {movementTypes.map(
                (movementType) => (
                  <FilterChip
                    key={
                      movementType.value ||
                      "all"
                    }
                    label={
                      movementType.label
                    }
                    selected={
                      selectedMovementType ===
                      movementType.value
                    }
                    onPress={() =>
                      selectMovementType(
                        movementType.value
                      )
                    }
                  />
                )
              )}
            </ScrollView>
          </View>

          <View style={styles.filterLine}>
            <Text
              style={styles.filterLabel}
            >
              Parfum
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.filterChipList
              }
            >
              <FilterChip
                label="Tous les parfums"
                selected={
                  selectedProductId === ""
                }
                onPress={() =>
                  selectProduct("")
                }
              />

              {products.map(
                (product) => (
                  <FilterChip
                    key={product.id}
                    label={product.name}
                    selected={
                      selectedProductId ===
                      product.id
                    }
                    onPress={() =>
                      selectProduct(
                        product.id
                      )
                    }
                  />
                )
              )}
            </ScrollView>
          </View>

          {hasFilters ? (
            <Pressable
              style={({ pressed }) => [
                styles.clearButton,
                pressed && styles.pressed,
              ]}
              onPress={clearFilters}
            >
              <Text
                style={
                  styles.clearButtonText
                }
              >
                Réinitialiser les filtres
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.summaryBar}>
          <SummaryItem
            label="Opérations"
            value={pagination.total ?? 0}
          />

          <View
            style={styles.summaryDivider}
          />

          <SummaryItem
            label="Entrées sur la page"
            value={`+${pageTotals.entries}`}
            valueStyle={styles.entryText}
          />

          <View
            style={styles.summaryDivider}
          />

          <SummaryItem
            label="Sorties sur la page"
            value={`−${pageTotals.exits}`}
            valueStyle={styles.exitText}
          />
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

        <View style={styles.tableCard}>
          <View style={styles.tableTop}>
            <Text
              style={styles.tableTitle}
            >
              Tableau récapitulatif
            </Text>

            <Text
              style={styles.pageIndicator}
            >
              Page {pagination.page ?? page}
              {" sur "}
              {Math.max(
                pagination.totalPages ?? 0,
                1
              )}
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator
                size="small"
                color={colors.primary}
              />

              <Text
                style={styles.stateText}
              >
                Chargement…
              </Text>
            </View>
          ) : movements.length === 0 ? (
            <View style={styles.stateBox}>
              <Text
                style={styles.emptyTitle}
              >
                Aucune opération trouvée
              </Text>

              <Text
                style={styles.stateText}
              >
                Modifiez les filtres pour
                afficher d’autres résultats.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator
            >
              <View style={styles.table}>
                <View
                  style={[
                    styles.tableRow,
                    styles.tableHeader,
                  ]}
                >
                  <TableCell
                    style={styles.dateColumn}
                    textStyle={
                      styles.headerText
                    }
                  >
                    Date
                  </TableCell>

                  <TableCell
                    style={
                      styles.productColumn
                    }
                    textStyle={
                      styles.headerText
                    }
                  >
                    Parfum
                  </TableCell>

                  <TableCell
                    style={styles.typeColumn}
                    textStyle={
                      styles.headerText
                    }
                  >
                    Type
                  </TableCell>

                  <TableCell
                    style={
                      styles.quantityColumn
                    }
                    textStyle={
                      styles.headerText
                    }
                  >
                    Quantité
                  </TableCell>

                  <TableCell
                    style={styles.stockColumn}
                    textStyle={
                      styles.headerText
                    }
                  >
                    Avant
                  </TableCell>

                  <TableCell
                    style={styles.stockColumn}
                    textStyle={
                      styles.headerText
                    }
                  >
                    Après
                  </TableCell>

                  <TableCell
                    style={styles.reasonColumn}
                    textStyle={
                      styles.headerText
                    }
                  >
                    Motif ou référence
                  </TableCell>

                  <TableCell
                    style={styles.actionColumn}
                    textStyle={
                      styles.headerText
                    }
                  >
                    Fiche
                  </TableCell>
                </View>

                {movements.map(
                  (movement, index) => {
                    const quantity = Number(
                      movement.quantity_change ??
                        0
                    );

                    const isEntry =
                      quantity > 0;

                    const product =
                      movement.product;

                    const details = [
                      movement.reason,
                      movement.reference,
                    ]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <View
                        key={movement.id}
                        style={[
                          styles.tableRow,
                          index % 2 === 1 &&
                            styles.alternateRow,
                        ]}
                      >
                        <TableCell
                          style={
                            styles.dateColumn
                          }
                        >
                          {formatDate(
                            movement.created_at
                          )}
                        </TableCell>

                        <TableCell
                          style={
                            styles.productColumn
                          }
                          textStyle={
                            styles.productText
                          }
                        >
                          {product?.name ||
                            "Parfum supprimé"}
                        </TableCell>

                        <TableCell
                          style={
                            styles.typeColumn
                          }
                        >
                          {movementLabels[
                            movement
                              .movement_type
                          ] ||
                            movement.movement_type}
                        </TableCell>

                        <TableCell
                          style={
                            styles.quantityColumn
                          }
                          textStyle={
                            isEntry
                              ? styles.entryText
                              : styles.exitText
                          }
                        >
                          {quantity > 0
                            ? `+${quantity}`
                            : quantity}
                        </TableCell>

                        <TableCell
                          style={
                            styles.stockColumn
                          }
                          textStyle={
                            styles.centerText
                          }
                        >
                          {movement.quantity_before ??
                            "—"}
                        </TableCell>

                        <TableCell
                          style={
                            styles.stockColumn
                          }
                          textStyle={
                            styles.centerText
                          }
                        >
                          {movement.quantity_after ??
                            "—"}
                        </TableCell>

                        <TableCell
                          style={
                            styles.reasonColumn
                          }
                        >
                          {details || "—"}
                        </TableCell>

                        <View
                          style={[
                            styles.tableCell,
                            styles.actionColumn,
                          ]}
                        >
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={
                              product
                                ? `Ouvrir ${product.name}`
                                : "Parfum indisponible"
                            }
                            style={({
                              pressed,
                            }) => [
                              styles.openButton,
                              pressed &&
                                styles.pressed,
                              (!product ||
                                !onOpenProduct) &&
                                styles.disabledButton,
                            ]}
                            disabled={
                              !product ||
                              !onOpenProduct
                            }
                            onPress={() =>
                              onOpenProduct?.(
                                product
                              )
                            }
                          >
                            <Text
                              style={
                                styles.openButtonText
                              }
                            >
                              ›
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  }
                )}
              </View>
            </ScrollView>
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
                disabled={page <= 1}
                onPress={() =>
                  setPage((current) =>
                    Math.max(
                      current - 1,
                      1
                    )
                  )
                }
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
                {page} /{" "}
                {pagination.totalPages}
              </Text>

              <Pressable
                style={[
                  styles.pageButton,
                  page >=
                    pagination.totalPages &&
                    styles.disabledButton,
                ]}
                disabled={
                  page >=
                  pagination.totalPages
                }
                onPress={() =>
                  setPage((current) =>
                    Math.min(
                      current + 1,
                      pagination.totalPages
                    )
                  )
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
    backgroundColor:
      colors.background,
  },

  scrollContent: {
    paddingBottom: 30,
  },

  container: {
    width: "100%",
    maxWidth: 1380,
    alignSelf: "center",
    paddingHorizontal: 14,
  },

  topBar: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  backButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
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

  refreshButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 13,
    borderRadius: 9,
    backgroundColor: colors.primary,
  },

  refreshButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "800",
  },

  heading: {
    paddingVertical: 15,
  },

  eyebrow: {
    color: colors.secondaryDark,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  title: {
    marginTop: 4,
    color: colors.primaryDark,
    fontSize: 27,
    fontWeight: "900",
  },

  subtitle: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 13,
  },

  filtersCard: {
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  filterLine: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  filterLabel: {
    width: 58,
    flexShrink: 0,
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
  },

  filterChipList: {
    alignItems: "center",
    gap: 6,
    paddingRight: 5,
  },

  filterChip: {
    height: 30,
    justifyContent: "center",
    paddingHorizontal: 11,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  filterChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },

  filterChipText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },

  filterChipTextSelected: {
    color: colors.white,
  },

  clearButton: {
    alignSelf: "flex-end",
    minHeight: 30,
    justifyContent: "center",
    paddingHorizontal: 11,
    borderRadius: 8,
    backgroundColor:
      colors.surfaceMuted,
  },

  clearButtonText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
  },

  summaryBar: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },

  summaryItem: {
    flex: 1,
    minWidth: 95,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  summaryDivider: {
    width: 1,
    backgroundColor: colors.border,
  },

  summaryLabel: {
    color: colors.textMuted,
    fontSize: 10,
  },

  summaryValue: {
    marginTop: 2,
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: "900",
  },

  entryText: {
    color: colors.success,
    fontWeight: "900",
  },

  exitText: {
    color: colors.danger,
    fontWeight: "900",
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },

  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12,
  },

  retryButton: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: 11,
    borderRadius: 8,
    backgroundColor: colors.danger,
  },

  retryButtonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
  },

  tableCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },

  tableTop: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  tableTitle: {
    flex: 1,
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "900",
  },

  pageIndicator: {
    color: colors.textMuted,
    fontSize: 11,
  },

  table: {
    minWidth: 1130,
  },

  tableRow: {
    height: 56,
    flexDirection: "row",
    alignItems: "stretch",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },

  tableHeader: {
    height: 38,
    backgroundColor:
      colors.surfaceMuted,
  },

  alternateRow: {
    backgroundColor: colors.background,
  },

  tableCell: {
    justifyContent: "center",
    paddingHorizontal: 9,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },

  cellText: {
    color: colors.text,
    fontSize: 11,
  },

  headerText: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  productText: {
    color: colors.primaryDark,
    fontWeight: "800",
  },

  centerText: {
    textAlign: "center",
    fontWeight: "800",
  },

  dateColumn: {
    width: 150,
  },

  productColumn: {
    width: 205,
  },

  typeColumn: {
    width: 125,
  },

  quantityColumn: {
    width: 85,
  },

  stockColumn: {
    width: 75,
  },

  reasonColumn: {
    width: 330,
  },

  actionColumn: {
    width: 70,
    alignItems: "center",
  },

  openButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor:
      colors.primaryLight,
  },

  openButtonText: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 21,
  },

  stateBox: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 18,
  },

  emptyTitle: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "800",
  },

  stateText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
  },

  pagination: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 8,
  },

  pageButton: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },

  pageButtonText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
  },

  pageText: {
    color: colors.textMuted,
    fontSize: 11,
  },

  disabledButton: {
    opacity: 0.45,
  },

  pressed: {
    opacity: 0.75,
  },
});
