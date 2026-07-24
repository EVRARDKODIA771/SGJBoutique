import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { getSoldProducts } from
  "../services/stockService.js";

import { colors } from
  "../theme/colors.js";

function formatCurrency(value) {
  return (
    new Intl.NumberFormat(
      "fr-FR"
    ).format(value ?? 0) + " FCFA"
  );
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle: "short",
      timeStyle: "short",
    }
  ).format(new Date(value));
}

export default function SoldProductsScreen({
  onBack,
  onOpenProduct,
}) {
  const [sales, setSales] =
    useState([]);

  const [searchInput, setSearchInput] =
    useState("");

  const [activeSearch, setActiveSearch] =
    useState("");

  const [page, setPage] = useState(1);

  const [pagination, setPagination] =
    useState({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });

  const [isLoading, setIsLoading] =
    useState(true);

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const loadSales = useCallback(
    async () => {
      setErrorMessage("");

      try {
        const result =
          await getSoldProducts({
            search:
              activeSearch || undefined,
            page,
            limit: 20,
          });

        setSales(
          result.soldProducts ?? []
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
          "Sold products loading error:",
          error
        );

        setErrorMessage(
          error?.message ||
            "Impossible de charger les parfums vendus."
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeSearch, page]
  );

  useEffect(() => {
    setIsLoading(true);
    loadSales();
  }, [loadSales]);

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

  function refreshSales() {
    setIsRefreshing(true);
    loadSales();
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.scrollContent
      }
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refreshSales}
          tintColor={colors.primary}
        />
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
              ‹ Retour
            </Text>
          </Pressable>
        </View>

        <View style={styles.headingRow}>
          <View style={styles.heading}>
            <Text style={styles.eyebrow}>
              PARFUMS
            </Text>

            <Text style={styles.title}>
              Parfums vendus
            </Text>

            <Text style={styles.subtitle}>
              Consultez toutes les ventes,
              de la plus récente à la plus
              ancienne.
            </Text>
          </View>

          <View style={styles.totalCard}>
            <Text
              style={styles.totalLabel}
            >
              Ventes enregistrées
            </Text>

            <Text
              style={styles.totalValue}
            >
              {pagination.total}
            </Text>
          </View>
        </View>

        <View style={styles.searchCard}>
          <TextInput
            style={styles.searchInput}
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmitEditing={submitSearch}
            placeholder="Rechercher un parfum, un SKU, une date, une référence ou une personne…"
            placeholderTextColor={
              colors.textMuted
            }
            returnKeyType="search"
            autoCorrect={false}
          />

          {searchInput ||
          activeSearch ? (
            <Pressable
              style={({ pressed }) => [
                styles.clearButton,
                pressed && styles.pressed,
              ]}
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
            style={({ pressed }) => [
              styles.searchButton,
              pressed && styles.pressed,
            ]}
            onPress={submitSearch}
          >
            <Text
              style={
                styles.searchButtonText
              }
            >
              Rechercher
            </Text>
          </Pressable>
        </View>

        {activeSearch ? (
          <Text style={styles.searchNote}>
            Résultats pour «{" "}
            {activeSearch} »
          </Text>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>

            <Pressable
              onPress={loadSales}
            >
              <Text
                style={styles.retryText}
              >
                Réessayer
              </Text>
            </Pressable>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator
              size="large"
              color={colors.primary}
            />

            <Text style={styles.loadingText}>
              Chargement des ventes…
            </Text>
          </View>
        ) : null}

        {!isLoading &&
        !errorMessage &&
        sales.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>
              Aucune vente trouvée
            </Text>

            <Text style={styles.emptyText}>
              Aucun parfum vendu ne
              correspond à votre recherche.
            </Text>
          </View>
        ) : null}

        {!isLoading &&
        sales.length > 0 ? (
          <View style={styles.tableCard}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
            >
              <View style={styles.table}>
                <View
                  style={[
                    styles.tableRow,
                    styles.tableHeader,
                  ]}
                >
                  <Text
                    style={[
                      styles.headerCell,
                      styles.dateColumn,
                    ]}
                  >
                    Date
                  </Text>

                  <Text
                    style={[
                      styles.headerCell,
                      styles.productColumn,
                    ]}
                  >
                    Parfum
                  </Text>

                  <Text
                    style={[
                      styles.headerCell,
                      styles.skuColumn,
                    ]}
                  >
                    SKU
                  </Text>

                  <Text
                    style={[
                      styles.headerCell,
                      styles.quantityColumn,
                    ]}
                  >
                    Quantité
                  </Text>

                  <Text
                    style={[
                      styles.headerCell,
                      styles.priceColumn,
                    ]}
                  >
                    Prix unitaire
                  </Text>

                  <Text
                    style={[
                      styles.headerCell,
                      styles.priceColumn,
                    ]}
                  >
                    Total
                  </Text>

                  <Text
                    style={[
                      styles.headerCell,
                      styles.personColumn,
                    ]}
                  >
                    Enregistré par
                  </Text>
                </View>

                {sales.map((sale) => {
                  const quantity =
                    Math.abs(
                      sale.quantityChange ??
                        0
                    );

                  const unitPrice =
                    sale.unitPrice ??
                    sale.product
                      ?.salePrice ??
                    0;

                  return (
                    <Pressable
                      key={sale.id}
                      style={({ pressed }) => [
                        styles.tableRow,
                        styles.dataRow,
                        pressed &&
                          styles.rowPressed,
                      ]}
                      onPress={() =>
                        onOpenProduct?.(
                          sale.product
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.bodyCell,
                          styles.dateColumn,
                        ]}
                      >
                        {formatDate(
                          sale.createdAt
                        )}
                      </Text>

                      <View
                        style={
                          styles.productColumn
                        }
                      >
                        <Text
                          style={
                            styles.productName
                          }
                          numberOfLines={1}
                        >
                          {sale.product?.name ??
                            "Parfum"}
                        </Text>

                        <Text
                          style={
                            styles.productBrand
                          }
                          numberOfLines={1}
                        >
                          {sale.product?.brand ||
                            "Marque non renseignée"}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.bodyCell,
                          styles.skuColumn,
                        ]}
                      >
                        {sale.product?.sku ??
                          "—"}
                      </Text>

                      <Text
                        style={[
                          styles.bodyCell,
                          styles.quantityColumn,
                          styles.quantityText,
                        ]}
                      >
                        {quantity}
                      </Text>

                      <Text
                        style={[
                          styles.bodyCell,
                          styles.priceColumn,
                        ]}
                      >
                        {formatCurrency(
                          unitPrice
                        )}
                      </Text>

                      <Text
                        style={[
                          styles.bodyCell,
                          styles.priceColumn,
                          styles.totalText,
                        ]}
                      >
                        {formatCurrency(
                          quantity *
                            unitPrice
                        )}
                      </Text>

                      <Text
                        style={[
                          styles.bodyCell,
                          styles.personColumn,
                        ]}
                      >
                        {sale
                          .performedByStaff
                          ?.code ||
                          sale.product
                            ?.addedByCode ||
                          "—"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {!isLoading &&
        pagination.totalPages > 1 ? (
          <View style={styles.pagination}>
            <Pressable
              style={({ pressed }) => [
                styles.pageButton,
                page <= 1 &&
                  styles.disabledButton,
                pressed &&
                  page > 1 &&
                  styles.pressed,
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
                style={styles.pageButtonText}
              >
                Précédent
              </Text>
            </Pressable>

            <Text style={styles.pageText}>
              Page {page} sur{" "}
              {pagination.totalPages}
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.pageButton,
                page >=
                  pagination.totalPages &&
                  styles.disabledButton,
                pressed &&
                  page <
                    pagination.totalPages &&
                  styles.pressed,
              ]}
              disabled={
                page >=
                pagination.totalPages
              }
              onPress={() =>
                setPage((current) =>
                  current + 1
                )
              }
            >
              <Text
                style={styles.pageButtonText}
              >
                Suivant
              </Text>
            </Pressable>
          </View>
        ) : null}
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
    maxWidth: 1450,
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

  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 20,
    paddingVertical: 28,
  },

  heading: {
    flexGrow: 1,
    flexBasis: 400,
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

  totalCard: {
    minWidth: 190,
    padding: 18,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  totalLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },

  totalValue: {
    marginTop: 5,
    color: colors.primaryDark,
    fontSize: 30,
    fontWeight: "900",
  },

  searchCard: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  searchInput: {
    flexGrow: 1,
    flexBasis: 370,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:
      colors.inputBackground,
    color: colors.text,
    fontSize: 14,
    outlineStyle: "none",
  },

  searchButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },

  searchButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  clearButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },

  clearButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },

  searchNote: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 13,
  },

  tableCard: {
    marginTop: 20,
    overflow: "hidden",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  table: {
    minWidth: 1240,
  },

  tableRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  tableHeader: {
    minHeight: 51,
    backgroundColor:
      colors.surfaceMuted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  dataRow: {
    minHeight: 72,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  rowPressed: {
    backgroundColor:
      colors.secondaryLight,
  },

  headerCell: {
    paddingHorizontal: 13,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  bodyCell: {
    paddingHorizontal: 13,
    color: colors.text,
    fontSize: 13,
  },

  dateColumn: {
    width: 160,
  },

  productColumn: {
    width: 220,
    paddingHorizontal: 13,
  },

  skuColumn: {
    width: 180,
  },

  quantityColumn: {
    width: 100,
    textAlign: "center",
  },

  priceColumn: {
    width: 180,
  },

  personColumn: {
    width: 150,
  },

  productName: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "800",
  },

  productBrand: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
  },

  quantityText: {
    color: colors.danger,
    fontWeight: "900",
  },

  totalText: {
    color: colors.primaryDark,
    fontWeight: "800",
  },

  loadingBox: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    gap: 13,
  },

  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },

  emptyBox: {
    marginTop: 20,
    alignItems: "center",
    padding: 42,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  emptyTitle: {
    color: colors.primaryDark,
    fontSize: 19,
    fontWeight: "800",
  },

  emptyText: {
    marginTop: 7,
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
  },

  errorBox: {
    marginTop: 18,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },

  errorText: {
    color: colors.danger,
    fontSize: 14,
  },

  retryText: {
    marginTop: 8,
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },

  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 22,
  },

  pageButton: {
    minHeight: 43,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },

  pageButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },

  pageText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },

  disabledButton: {
    opacity: 0.4,
  },

  pressed: {
    opacity: 0.82,
  },
});
