import {
  useCallback,
  useEffect,
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

import SaleReceiptModal from
  "../components/SaleReceiptModal.js";

import {
  getGlobalStockMovements,
} from "../services/stockService.js";

import {
  colors,
} from "../theme/colors.js";

const movementLabels = {
  initial: "Stock initial",
  purchase: "Achat fournisseur",
  sale: "Vente client",
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

function TableCell({
  style,
  textStyle,
  children,
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
        numberOfLines={1}
      >
        {children}
      </Text>
    </View>
  );
}

export default function StockHistoryScreen({
  initialDirection = "entries",
  onBack,
  onOpenProduct,
}) {
  const [direction, setDirection] =
    useState(initialDirection);

  useEffect(() => {
    setDirection(initialDirection);
    setPage(1);
  }, [initialDirection]);

  const [movements, setMovements] =
    useState([]);

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

  const [searchInput, setSearchInput] =
    useState("");

  const [activeSearch, setActiveSearch] =
    useState("");

  const [
    selectedReceipt,
    setSelectedReceipt,
  ] = useState(null);

  const loadMovements = useCallback(
    async () => {
      setIsLoading(true);
      setRequestError("");

      try {
        const result =
          await getGlobalStockMovements({
            direction,
            search:
              activeSearch ||
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
          "Stock history loading error:",
          error
        );

        setRequestError(
          error?.message ||
            "Impossible de charger l’historique."
        );

        setMovements([]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      direction,
      activeSearch,
      page,
    ]
  );

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  function changeDirection(
    nextDirection
  ) {
    setDirection(nextDirection);
    setPage(1);
  }

  function submitSearch() {
    setPage(1);
    setActiveSearch(
      searchInput.trim()
    );
  }

  function clearSearch() {
    setSearchInput("");
    setActiveSearch("");
    setPage(1);
  }

  const isEntries =
    direction === "entries";

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
            Choisissez les entrées ou les
            sorties pour afficher le tableau.
          </Text>
        </View>

        <View style={styles.directionTabs}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              selected: isEntries,
            }}
            style={({ pressed }) => [
              styles.directionButton,
              isEntries &&
                styles.entryButtonSelected,
              pressed && styles.pressed,
            ]}
            onPress={() =>
              changeDirection("entries")
            }
          >
            <Text
              style={[
                styles.directionButtonText,
                isEntries &&
                  styles.selectedButtonText,
              ]}
            >
              ENTRÉES
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              selected: !isEntries,
            }}
            style={({ pressed }) => [
              styles.directionButton,
              !isEntries &&
                styles.exitButtonSelected,
              pressed && styles.pressed,
            ]}
            onPress={() =>
              changeDirection("exits")
            }
          >
            <Text
              style={[
                styles.directionButtonText,
                !isEntries &&
                  styles.selectedButtonText,
              ]}
            >
              SORTIES
            </Text>
          </Pressable>
        </View>

        <View style={styles.searchCard}>
          <TextInput
            style={styles.searchInput}
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmitEditing={submitSearch}
            placeholder="Date, parfum, client, téléphone, vendeuse…"
            placeholderTextColor={
              colors.textMuted
            }
            returnKeyType="search"
            autoCorrect={false}
          />

          {searchInput ||
          activeSearch ? (
            <Pressable
              style={styles.clearButton}
              onPress={clearSearch}
            >
              <Text
                style={
                  styles.clearButtonText
                }
              >
                Effacer
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            style={styles.searchButton}
            onPress={submitSearch}
          >
            <Text
              style={styles.searchButtonText}
            >
              Rechercher
            </Text>
          </Pressable>
        </View>

        <Text style={styles.searchHint}>
          Chaque mot doit correspondre à
          l’opération. Exemple : « 2026
          Sensoria ».
        </Text>

        {requestError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {requestError}
            </Text>

            <Pressable
              onPress={loadMovements}
            >
              <Text
                style={styles.retryText}
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
              {isEntries
                ? "Toutes les entrées"
                : "Toutes les sorties"}
            </Text>

            <Text
              style={styles.resultCount}
            >
              {pagination.total ?? 0}{" "}
              opération
              {(pagination.total ?? 0) >
              1
                ? "s"
                : ""}
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
                Aucune opération
              </Text>

              <Text
                style={styles.stateText}
              >
                Aucune{" "}
                {isEntries
                  ? "entrée"
                  : "sortie"}{" "}
                n’a encore été enregistrée.
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
                    Date et heure
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
                    Opération
                  </TableCell>

                  <TableCell
                    style={
                      styles.quantityColumn
                    }
                    textStyle={
                      styles.headerText
                    }
                  >
                    Qté
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
                    style={styles.clientColumn}
                    textStyle={
                      styles.headerText
                    }
                  >
                    {isEntries
                      ? "Fournisseur / Référence"
                      : "Client"}
                  </TableCell>

                  <TableCell
                    style={styles.sellerColumn}
                    textStyle={
                      styles.headerText
                    }
                  >
                    Vendeuse
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
                    const quantity =
                      Math.abs(
                        Number(
                          movement.quantity_change ??
                            0
                        )
                      );

                    const product =
                      movement.product;

                    const contactInformation =
                      isEntries
                        ? [
                            movement.supplier
                              ?.name,
                            movement.reference,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : movement.reference;

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
                            isEntries
                              ? styles.entryText
                              : styles.exitText
                          }
                        >
                          {quantity}
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
                            styles.clientColumn
                          }
                        >
                          {contactInformation ||
                            "—"}
                        </TableCell>

                        <TableCell
                          style={
                            styles.sellerColumn
                          }
                          textStyle={
                            styles.sellerText
                          }
                        >
                          {movement.seller
                            ?.staff_code ||
                            "—"}
                        </TableCell>

                        <View
                          style={[
                            styles.tableCell,
                            styles.actionColumn,
                          ]}
                        >
                          <Pressable
                            style={({
                              pressed,
                            }) => [
                              styles.openButton,
                              pressed &&
                                styles.pressed,
                              (movement.movement_type !==
                                "sale" &&
                                (!product ||
                                  !onOpenProduct)) &&
                                styles.disabledButton,
                            ]}
                            disabled={
                              movement.movement_type !==
                                "sale" &&
                              (!product ||
                                !onOpenProduct)
                            }
                            onPress={() => {
                              if (
                                movement.movement_type ===
                                "sale"
                              ) {
                                setSelectedReceipt(
                                  movement
                                );
                                return;
                              }

                              onOpenProduct?.(
                                product
                              );
                            }}
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

      <SaleReceiptModal
        movement={selectedReceipt}
        onClose={() =>
          setSelectedReceipt(null)
        }
      />
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

  directionTabs: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },

  searchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 5,
  },

  searchInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.surface,
  },

  searchButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },

  searchButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "900",
  },

  clearButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 9,
  },

  clearButtonText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },

  searchHint: {
    marginBottom: 10,
    color: colors.textMuted,
    fontSize: 11,
  },

  directionButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  entryButtonSelected: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },

  exitButtonSelected: {
    borderColor: colors.danger,
    backgroundColor: colors.danger,
  },

  directionButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.7,
  },

  selectedButtonText: {
    color: colors.white,
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
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

  retryText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "900",
  },

  tableCard: {
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

  resultCount: {
    color: colors.textMuted,
    fontSize: 11,
  },

  table: {
    minWidth: 1170,
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
    paddingHorizontal: 8,
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

  sellerText: {
    color: colors.secondaryDark,
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

  centerText: {
    textAlign: "center",
    fontWeight: "800",
  },

  dateColumn: {
    width: 145,
  },

  productColumn: {
    width: 180,
  },

  typeColumn: {
    width: 135,
  },

  quantityColumn: {
    width: 65,
  },

  stockColumn: {
    width: 65,
  },

  clientColumn: {
    width: 260,
  },

  sellerColumn: {
    width: 110,
  },

  actionColumn: {
    width: 65,
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
