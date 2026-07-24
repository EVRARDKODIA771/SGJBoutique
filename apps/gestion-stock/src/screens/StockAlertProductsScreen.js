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

import {
  getLowStockProducts,
  getOutOfStockProducts,
} from "../services/stockService.js";

import { colors } from
  "../theme/colors.js";

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle: "short",
      timeStyle: "short",
    }
  ).format(date);
}

function getProductId(product) {
  return (
    product?.id ??
    product?.product_id ??
    null
  );
}

export default function StockAlertProductsScreen({
  view,
  onBack,
  onOpenProduct,
}) {
  const isOutOfStock =
    view === "out";

  const title = isOutOfStock
    ? "Parfums épuisés"
    : "Parfums bientôt épuisés";

  const description = isOutOfStock
    ? "Ces parfums ne sont plus disponibles en stock."
    : "Ces parfums ont atteint leur seuil d’alerte et doivent bientôt être réapprovisionnés.";

  const [products, setProducts] =
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

  const loadProducts = useCallback(
    async () => {
      setErrorMessage("");

      try {
        const loader = isOutOfStock
          ? getOutOfStockProducts
          : getLowStockProducts;

        const result = await loader({
          search:
            activeSearch || undefined,
          page,
          limit: 20,
        });

        setProducts(
          result.products ?? []
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
          "Stock alert products loading error:",
          error
        );

        setErrorMessage(
          error?.message ||
            "Impossible de charger les parfums."
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [
      activeSearch,
      isOutOfStock,
      page,
    ]
  );

  useEffect(() => {
    setIsLoading(true);
    loadProducts();
  }, [loadProducts]);

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

  function refreshProducts() {
    setIsRefreshing(true);
    loadProducts();
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
          onRefresh={refreshProducts}
          tintColor={
            colors.brandBlue ??
            colors.primary
          }
        />
      }
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
            ‹ Retour
          </Text>
        </Pressable>

        <View style={styles.headingRow}>
          <View style={styles.heading}>
            <Text style={styles.eyebrow}>
              GESTION DU STOCK
            </Text>

            <Text style={styles.title}>
              {title}
            </Text>

            <Text style={styles.subtitle}>
              {description}
            </Text>
          </View>

          <View
            style={[
              styles.totalCard,
              isOutOfStock &&
                styles.totalCardDanger,
            ]}
          >
            <Text
              style={styles.totalLabel}
            >
              {isOutOfStock
                ? "Parfums épuisés"
                : "Parfums à surveiller"}
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
            placeholder="Rechercher un nom, une marque, un SKU, une date ou une personne…"
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

        <View style={styles.tableCard}>
          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator
                size="large"
                color={
                  colors.brandBlue ??
                  colors.primary
                }
              />

              <Text
                style={styles.stateText}
              >
                Chargement des parfums…
              </Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.stateBox}>
              <Text
                style={styles.errorText}
              >
                {errorMessage}
              </Text>

              <Pressable
                style={styles.retryButton}
                onPress={loadProducts}
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
          ) : products.length === 0 ? (
            <View style={styles.stateBox}>
              <Text
                style={styles.emptyTitle}
              >
                Aucun parfum trouvé
              </Text>

              <Text
                style={styles.stateText}
              >
                {activeSearch
                  ? "Essayez un autre mot-clé ou effacez la recherche."
                  : isOutOfStock
                    ? "Aucun parfum n’est actuellement épuisé."
                    : "Aucun parfum n’est actuellement bientôt épuisé."}
              </Text>
            </View>
          ) : (
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
                      styles.stockColumn,
                    ]}
                  >
                    Stock
                  </Text>

                  <Text
                    style={[
                      styles.headerCell,
                      styles.thresholdColumn,
                    ]}
                  >
                    Seuil d’alerte
                  </Text>

                  <Text
                    style={[
                      styles.headerCell,
                      styles.personColumn,
                    ]}
                  >
                    Ajouté par
                  </Text>

                  <Text
                    style={[
                      styles.headerCell,
                      styles.dateColumn,
                    ]}
                  >
                    Dernière mise à jour
                  </Text>

                  <Text
                    style={[
                      styles.headerCell,
                      styles.actionColumn,
                    ]}
                  >
                    Action
                  </Text>
                </View>

                {products.map(
                  (product, index) => {
                    const productId =
                      getProductId(product);

                    return (
                      <View
                        key={
                          productId ??
                          `${product.sku}-${index}`
                        }
                        style={[
                          styles.tableRow,
                          index % 2 === 1 &&
                            styles.alternateRow,
                        ]}
                      >
                        <View
                          style={[
                            styles.bodyCell,
                            styles.productColumn,
                          ]}
                        >
                          <Text
                            style={
                              styles.productName
                            }
                            numberOfLines={1}
                          >
                            {product.name ??
                              product.product_name ??
                              "Parfum"}
                          </Text>

                          <Text
                            style={
                              styles.productBrand
                            }
                            numberOfLines={1}
                          >
                            {product.brand ??
                              product.product_brand ??
                              "Marque non renseignée"}
                          </Text>
                        </View>

                        <Text
                          style={[
                            styles.bodyText,
                            styles.skuColumn,
                          ]}
                          numberOfLines={1}
                        >
                          {product.sku ??
                            product.product_sku ??
                            "—"}
                        </Text>

                        <View
                          style={[
                            styles.bodyCell,
                            styles.stockColumn,
                          ]}
                        >
                          <View
                            style={[
                              styles.stockBadge,
                              isOutOfStock
                                ? styles.outBadge
                                : styles.lowBadge,
                            ]}
                          >
                            <Text
                              style={[
                                styles.stockBadgeText,
                                isOutOfStock
                                  ? styles.outBadgeText
                                  : styles.lowBadgeText,
                              ]}
                            >
                              {product.stock_quantity ??
                                0}
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={[
                            styles.bodyText,
                            styles.thresholdColumn,
                          ]}
                        >
                          {product.low_stock_threshold ??
                            0}
                        </Text>

                        <Text
                          style={[
                            styles.bodyText,
                            styles.personColumn,
                          ]}
                          numberOfLines={1}
                        >
                          {product.added_by_code ??
                            "—"}
                        </Text>

                        <Text
                          style={[
                            styles.bodyText,
                            styles.dateColumn,
                          ]}
                          numberOfLines={1}
                        >
                          {formatDate(
                            product.updated_at ??
                              product.created_at
                          )}
                        </Text>

                        <View
                          style={[
                            styles.bodyCell,
                            styles.actionColumn,
                          ]}
                        >
                          <Pressable
                            disabled={!productId}
                            style={({
                              pressed,
                            }) => [
                              styles.openButton,
                              pressed &&
                                styles.pressed,
                              !productId &&
                                styles.disabled,
                            ]}
                            onPress={() =>
                              onOpenProduct(
                                productId
                              )
                            }
                          >
                            <Text
                              style={
                                styles.openButtonText
                              }
                            >
                              Ouvrir
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
        </View>

        {!isLoading &&
        !errorMessage &&
        pagination.totalPages > 1 ? (
          <View style={styles.pagination}>
            <Pressable
              disabled={page <= 1}
              style={({ pressed }) => [
                styles.pageButton,
                page <= 1 &&
                  styles.disabled,
                pressed && styles.pressed,
              ]}
              onPress={() =>
                setPage((value) =>
                  Math.max(1, value - 1)
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
              Page {pagination.page} sur{" "}
              {pagination.totalPages}
            </Text>

            <Pressable
              disabled={
                page >=
                pagination.totalPages
              }
              style={({ pressed }) => [
                styles.pageButton,
                page >=
                  pagination.totalPages &&
                  styles.disabled,
                pressed && styles.pressed,
              ]}
              onPress={() =>
                setPage((value) =>
                  value + 1
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

const brandBlue =
  colors.brandBlue ?? "#1E6682";

const brandBlueDark =
  colors.brandBlueDark ?? "#154C61";

const brandBlueLight =
  colors.brandBlueLight ?? "#E7F1F5";

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scrollContent: {
    flexGrow: 1,
  },

  container: {
    width: "100%",
    maxWidth: 1500,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 28,
  },

  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 2,
    marginBottom: 18,
  },

  backButtonText: {
    color: brandBlueDark,
    fontSize: 15,
    fontWeight: "700",
  },

  headingRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: 18,
    marginBottom: 22,
  },

  heading: {
    flex: 1,
    minWidth: 280,
    justifyContent: "center",
  },

  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 7,
  },

  title: {
    color: brandBlueDark,
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 8,
  },

  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 720,
  },

  totalCard: {
    minWidth: 190,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 6,
    borderLeftColor: colors.warning,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 18,
    justifyContent: "center",
  },

  totalCardDanger: {
    borderLeftColor: colors.danger,
  },

  totalLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 5,
  },

  totalValue: {
    color: brandBlueDark,
    fontSize: 30,
    fontWeight: "900",
  },

  searchCard: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },

  searchInput: {
    flex: 1,
    minWidth: 250,
    minHeight: 46,
    color: colors.text,
    backgroundColor:
      colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    outlineStyle: "none",
  },

  clearButton: {
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 17,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor:
      colors.surfaceMuted,
  },

  clearButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },

  searchButton: {
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: brandBlue,
  },

  searchButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },

  searchNote: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 10,
  },

  tableCard: {
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    marginTop: 8,
  },

  table: {
    minWidth: 1240,
  },

  tableRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  tableHeader: {
    minHeight: 52,
    backgroundColor: brandBlueDark,
  },

  alternateRow: {
    backgroundColor:
      colors.surfaceMuted,
  },

  headerCell: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    paddingHorizontal: 14,
  },

  bodyCell: {
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  bodyText: {
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 14,
  },

  productColumn: {
    width: 260,
  },

  skuColumn: {
    width: 190,
  },

  stockColumn: {
    width: 110,
  },

  thresholdColumn: {
    width: 140,
  },

  personColumn: {
    width: 140,
  },

  dateColumn: {
    width: 210,
  },

  actionColumn: {
    width: 140,
  },

  productName: {
    color: brandBlueDark,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },

  productBrand: {
    color: colors.textMuted,
    fontSize: 13,
  },

  stockBadge: {
    alignSelf: "flex-start",
    minWidth: 42,
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  lowBadge: {
    backgroundColor:
      colors.warningLight,
  },

  outBadge: {
    backgroundColor:
      colors.dangerLight,
  },

  stockBadgeText: {
    fontSize: 13,
    fontWeight: "900",
  },

  lowBadgeText: {
    color: colors.warning,
  },

  outBadgeText: {
    color: colors.danger,
  },

  openButton: {
    alignSelf: "flex-start",
    backgroundColor: brandBlueLight,
    borderWidth: 1,
    borderColor: brandBlue,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },

  openButtonText: {
    color: brandBlueDark,
    fontSize: 13,
    fontWeight: "800",
  },

  stateBox: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },

  stateText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 12,
  },

  emptyTitle: {
    color: brandBlueDark,
    fontSize: 18,
    fontWeight: "800",
  },

  errorText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 16,
  },

  retryButton: {
    backgroundColor: brandBlue,
    borderRadius: 9,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },

  retryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },

  pagination: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginTop: 20,
  },

  pageButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: brandBlue,
    borderRadius: 9,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },

  pageButtonText: {
    color: brandBlueDark,
    fontSize: 14,
    fontWeight: "800",
  },

  pageText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },

  pressed: {
    opacity: 0.72,
  },

  disabled: {
    opacity: 0.4,
  },
});
