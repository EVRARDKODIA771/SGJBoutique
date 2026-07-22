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

import { getProducts } from
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

function getStatusInformation(status) {
  const statuses = {
    draft: {
      label: "Brouillon",
      color: colors.warning,
      background:
        colors.warningLight,
    },

    active: {
      label: "Actif",
      color: colors.success,
      background:
        colors.successLight,
    },

    out_of_stock: {
      label: "Rupture",
      color: colors.danger,
      background:
        colors.dangerLight,
    },

    archived: {
      label: "Archivé",
      color: colors.textMuted,
      background:
        colors.surfaceMuted,
    },
  };

  return (
    statuses[status] ?? {
      label: status ?? "Inconnu",
      color: colors.textMuted,
      background:
        colors.surfaceMuted,
    }
  );
}

function ProductCard({
  product,
  onPress,
}) {
  const status =
    getStatusInformation(
      product.status
    );

  const stockQuantity =
    product.stock_quantity ?? 0;

  const lowStockThreshold =
    product.low_stock_threshold ?? 0;

  const isLowStock =
    stockQuantity <= lowStockThreshold;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.productCard,
        pressed && styles.pressed,
      ]}
      onPress={() => onPress?.(product)}
    >
      <View style={styles.productTop}>
        <View
          style={
            styles.productPlaceholder
          }
        >
          <Text
            style={
              styles.productPlaceholderText
            }
          >
            {product.name
              ?.trim()
              ?.charAt(0)
              ?.toUpperCase() ?? "P"}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                status.background,
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              {
                color: status.color,
              },
            ]}
          >
            {status.label}
          </Text>
        </View>
      </View>

      <Text
        style={styles.productName}
        numberOfLines={2}
      >
        {product.name}
      </Text>

      <Text
        style={styles.productBrand}
        numberOfLines={1}
      >
        {product.brand ||
          "Marque non renseignée"}
      </Text>

      <Text
        style={styles.productSku}
        numberOfLines={1}
      >
        {product.sku}
      </Text>

      <View style={styles.priceBox}>
        <Text style={styles.priceLabel}>
          Prix de vente
        </Text>

        <Text style={styles.priceValue}>
          {formatCurrency(
            product.sale_price
          )}
        </Text>
      </View>

      <View style={styles.stockRow}>
        <View>
          <Text style={styles.stockLabel}>
            Stock disponible
          </Text>

          <Text
            style={[
              styles.stockValue,
              isLowStock &&
                styles.lowStockValue,
            ]}
          >
            {stockQuantity} unité
            {stockQuantity > 1
              ? "s"
              : ""}
          </Text>
        </View>

        {isLowStock ? (
          <View
            style={styles.lowStockBadge}
          >
            <Text
              style={
                styles.lowStockBadgeText
              }
            >
              Stock faible
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.openRow}>
        <Text style={styles.openText}>
          Voir la fiche
        </Text>

        <Text style={styles.openArrow}>
          ›
        </Text>
      </View>
    </Pressable>
  );
}

export default function ProductsScreen({
  onBack,
  onCreate,
  onOpenProduct,
}) {
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
        const result =
          await getProducts({
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
          "Products loading error:",
          error
        );

        setErrorMessage(
          "Impossible de charger les parfums."
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

  const hasPreviousPage =
    page > 1;

  const hasNextPage =
    pagination.totalPages > page;

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
          tintColor={colors.primary}
          colors={[colors.primary]}
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
              ‹ Tableau de bord
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.createButton,
              pressed && styles.pressed,
            ]}
            onPress={onCreate}
          >
            <Text
              style={
                styles.createButtonText
              }
            >
              + Nouveau parfum
            </Text>
          </Pressable>
        </View>

        <View style={styles.heading}>
          <Text style={styles.eyebrow}>
            CATALOGUE JDE
          </Text>

          <Text style={styles.title}>
            Parfums
          </Text>

          <Text style={styles.subtitle}>
            Consultez et gérez les parfums
            enregistrés dans la boutique.
          </Text>
        </View>

        <View style={styles.searchCard}>
          <TextInput
            style={styles.searchInput}
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Rechercher par nom…"
            placeholderTextColor={
              colors.textMuted
            }
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={submitSearch}
          />

          {searchInput ||
          activeSearch ? (
            <Pressable
              style={({ pressed }) => [
                styles.clearButton,
                pressed &&
                  styles.pressed,
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

        <View style={styles.resultHeader}>
          <Text style={styles.resultText}>
            {pagination.total} parfum
            {pagination.total > 1
              ? "s"
              : ""}
          </Text>

          {activeSearch ? (
            <Text
              style={styles.filterText}
            >
              Recherche : “
              {activeSearch}”
            </Text>
          ) : null}
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>

            <Pressable
              onPress={loadProducts}
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

            <Text
              style={styles.loadingText}
            >
              Chargement des parfums…
            </Text>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>
              Aucun parfum trouvé
            </Text>

            <Text
              style={
                styles.emptyDescription
              }
            >
              {activeSearch
                ? "Aucun parfum ne correspond à cette recherche."
                : "Commencez par enregistrer le premier parfum de la boutique."}
            </Text>

            {!activeSearch ? (
              <Pressable
                style={({ pressed }) => [
                  styles.emptyButton,
                  pressed &&
                    styles.pressed,
                ]}
                onPress={onCreate}
              >
                <Text
                  style={
                    styles.emptyButtonText
                  }
                >
                  Créer un parfum
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.productGrid}>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onPress={
                  onOpenProduct
                }
              />
            ))}
          </View>
        )}

        {!isLoading &&
        pagination.totalPages > 1 ? (
          <View style={styles.pagination}>
            <Pressable
              style={({ pressed }) => [
                styles.pageButton,
                !hasPreviousPage &&
                  styles.disabledButton,
                pressed &&
                  hasPreviousPage &&
                  styles.pressed,
              ]}
              onPress={() =>
                setPage(
                  (current) =>
                    current - 1
                )
              }
              disabled={!hasPreviousPage}
            >
              <Text
                style={
                  styles.pageButtonText
                }
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
                !hasNextPage &&
                  styles.disabledButton,
                pressed &&
                  hasNextPage &&
                  styles.pressed,
              ]}
              onPress={() =>
                setPage(
                  (current) =>
                    current + 1
                )
              }
              disabled={!hasNextPage}
            >
              <Text
                style={
                  styles.pageButtonText
                }
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
    paddingBottom: 42,
  },

  container: {
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    paddingHorizontal: 20,
  },

  topBar: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  backButton: {
    minHeight: 42,
    alignItems: "center",
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

  createButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 17,
    borderRadius: 11,
    backgroundColor: colors.primary,
  },

  createButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  heading: {
    paddingTop: 32,
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
  },

  searchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  searchInput: {
    flex: 1,
    minWidth: 120,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:
      colors.inputBackground,
    color: colors.text,
    fontSize: 15,
    outlineStyle: "none",
  },

  searchButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 17,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },

  searchButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "700",
  },

  clearButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  clearButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },

  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 20,
  },

  resultText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },

  filterText: {
    color: colors.textMuted,
    fontSize: 13,
  },

  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 15,
  },

  productCard: {
    flexGrow: 1,
    flexBasis: 260,
    maxWidth: 395,
    minHeight: 360,
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,

    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },

  productTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  productPlaceholder: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor:
      colors.primaryLight,
  },

  productPlaceholderText: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: "900",
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },

  productName: {
    marginTop: 18,
    color: colors.primaryDark,
    fontSize: 21,
    fontWeight: "800",
  },

  productBrand: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 14,
  },

  productSku: {
    marginTop: 7,
    color: colors.secondaryDark,
    fontSize: 12,
    fontWeight: "700",
  },

  priceBox: {
    marginTop: 20,
    padding: 13,
    borderRadius: 12,
    backgroundColor:
      colors.surfaceMuted,
  },

  priceLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },

  priceValue: {
    marginTop: 4,
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: "800",
  },

  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 17,
  },

  stockLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },

  stockValue: {
    marginTop: 3,
    color: colors.success,
    fontSize: 15,
    fontWeight: "800",
  },

  lowStockValue: {
    color: colors.warning,
  },

  lowStockBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor:
      colors.warningLight,
  },

  lowStockBadgeText: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: "800",
  },

  openRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: "auto",
    paddingTop: 20,
  },

  openText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },

  openArrow: {
    color: colors.primary,
    fontSize: 23,
  },

  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    minHeight: 280,
  },

  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },

  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 300,
    padding: 25,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  emptyTitle: {
    color: colors.primaryDark,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },

  emptyDescription: {
    maxWidth: 430,
    marginTop: 9,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },

  emptyButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    paddingHorizontal: 19,
    borderRadius: 11,
    backgroundColor: colors.primary,
  },

  emptyButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.danger,
  },

  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 14,
  },

  retryText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "800",
  },

  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 28,
  },

  pageButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },

  pageButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },

  pageText: {
    color: colors.textMuted,
    fontSize: 13,
  },

  disabledButton: {
    opacity: 0.4,
  },

  pressed: {
    opacity: 0.82,
  },
});
