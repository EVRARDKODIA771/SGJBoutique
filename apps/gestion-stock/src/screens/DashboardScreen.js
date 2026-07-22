import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { signOut } from
  "../services/authService.js";

import {
  getCategories,
  getProducts,
  getSuppliers,
} from "../services/stockService.js";

import { colors } from
  "../theme/colors.js";

function formatCurrency(value) {
  return new Intl.NumberFormat(
    "fr-FR"
  ).format(value ?? 0) + " FCFA";
}

function StatCard({
  label,
  value,
  detail,
  accentColor,
}) {
  return (
    <View style={styles.statCard}>
      <View
        style={[
          styles.statAccent,
          {
            backgroundColor:
              accentColor,
          },
        ]}
      />

      <Text style={styles.statLabel}>
        {label}
      </Text>

      <Text style={styles.statValue}>
        {value}
      </Text>

      <Text style={styles.statDetail}>
        {detail}
      </Text>
    </View>
  );
}

function MenuButton({
  title,
  description,
  symbol,
  onPress,
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuButton,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.menuSymbol}>
        <Text
          style={styles.menuSymbolText}
        >
          {symbol}
        </Text>
      </View>

      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>
          {title}
        </Text>

        <Text
          style={styles.menuDescription}
        >
          {description}
        </Text>
      </View>

      <Text style={styles.menuArrow}>
        ›
      </Text>
    </Pressable>
  );
}

export default function DashboardScreen({
  user,
  membership,
  onNavigate,
  onSignedOut,
}) {
  const [products, setProducts] =
    useState([]);

  const [productTotal, setProductTotal] =
    useState(0);

  const [categoryTotal, setCategoryTotal] =
    useState(0);

  const [supplierTotal, setSupplierTotal] =
    useState(0);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [isSigningOut, setIsSigningOut] =
    useState(false);

  const loadDashboard = useCallback(
    async () => {
      setErrorMessage("");

      try {
        const [
          productsResult,
          categoriesResult,
          suppliersResult,
        ] = await Promise.all([
          getProducts({
            page: 1,
            limit: 100,
          }),

          getCategories({
            page: 1,
            limit: 100,
          }),

          getSuppliers({
            page: 1,
            limit: 100,
          }),
        ]);

        setProducts(
          productsResult.products ?? []
        );

        setProductTotal(
          productsResult.pagination
            ?.total ?? 0
        );

        setCategoryTotal(
          categoriesResult.pagination
            ?.total ?? 0
        );

        setSupplierTotal(
          suppliersResult.pagination
            ?.total ?? 0
        );
      } catch (error) {
        console.error(
          "Dashboard loading error:",
          error
        );

        setErrorMessage(
          "Impossible de charger les données du tableau de bord."
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const statistics = useMemo(() => {
    const visibleProducts =
      products.filter(
        (product) =>
          product.status !== "archived"
      );

    const stockQuantity =
      visibleProducts.reduce(
        (total, product) =>
          total +
          (product.stock_quantity ?? 0),
        0
      );

    const lowStockProducts =
      visibleProducts.filter(
        (product) =>
          (product.stock_quantity ?? 0) <=
          (product.low_stock_threshold ??
            0)
      );

    const purchaseValue =
      visibleProducts.reduce(
        (total, product) =>
          total +
          (product.stock_quantity ?? 0) *
            (product.purchase_price ?? 0),
        0
      );

    const saleValue =
      visibleProducts.reduce(
        (total, product) =>
          total +
          (product.stock_quantity ?? 0) *
            (product.sale_price ?? 0),
        0
      );

    return {
      stockQuantity,
      lowStockCount:
        lowStockProducts.length,
      purchaseValue,
      saleValue,
    };
  }, [products]);

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await signOut();
      onSignedOut?.();
    } catch (error) {
      console.error(
        "Dashboard sign out error:",
        error
      );

      setErrorMessage(
        "Impossible de fermer la session."
      );

      setIsSigningOut(false);
    }
  }

  function refreshDashboard() {
    setIsRefreshing(true);
    loadDashboard();
  }

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <Image
          source={require(
            "../../assets/jde-logo.png"
          )}
          style={styles.loadingLogo}
          resizeMode="contain"
        />

        <ActivityIndicator
          size="large"
          color={colors.primary}
        />

        <Text style={styles.loadingText}>
          Chargement du stock…
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.scrollContent
      }
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refreshDashboard}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Image
            source={require(
              "../../assets/jde-logo.png"
            )}
            style={styles.headerLogo}
            resizeMode="contain"
          />

          <View style={styles.headerActions}>
            <View style={styles.userBox}>
              <Text
                style={styles.userEmail}
                numberOfLines={1}
              >
                {user?.email ??
                  "Administrateur"}
              </Text>

              <Text style={styles.userRole}>
                {membership?.role ??
                  "administrateur"}
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.logoutButton,
                pressed && styles.pressed,
              ]}
              onPress={handleSignOut}
              disabled={isSigningOut}
            >
              {isSigningOut ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                />
              ) : (
                <Text
                  style={
                    styles.logoutButtonText
                  }
                >
                  Déconnexion
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.welcome}>
          <Text style={styles.eyebrow}>
            ESPACE ADMINISTRATIF
          </Text>

          <Text style={styles.title}>
            Tableau de bord
          </Text>

          <Text style={styles.subtitle}>
            Vue d’ensemble du catalogue et
            du stock JDE.
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>

            <Pressable
              onPress={loadDashboard}
            >
              <Text
                style={styles.retryText}
              >
                Réessayer
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.statsGrid}>
          <StatCard
            label="Parfums"
            value={productTotal}
            detail="Produits enregistrés"
            accentColor={colors.primary}
          />

          <StatCard
            label="Unités en stock"
            value={
              statistics.stockQuantity
            }
            detail="Quantité disponible"
            accentColor={colors.gold}
          />

          <StatCard
            label="Stock faible"
            value={
              statistics.lowStockCount
            }
            detail="Produits à surveiller"
            accentColor={
              statistics.lowStockCount > 0
                ? colors.warning
                : colors.success
            }
          />

          <StatCard
            label="Catégories"
            value={categoryTotal}
            detail="Catégories enregistrées"
            accentColor={colors.info}
          />

          <StatCard
            label="Fournisseurs"
            value={supplierTotal}
            detail="Partenaires enregistrés"
            accentColor={
              colors.secondaryDark
            }
          />

          <StatCard
            label="Valeur d’achat"
            value={formatCurrency(
              statistics.purchaseValue
            )}
            detail="Valeur du stock au coût"
            accentColor={colors.primary}
          />

          <StatCard
            label="Valeur de vente"
            value={formatCurrency(
              statistics.saleValue
            )}
            detail="Potentiel du stock"
            accentColor={colors.success}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Gestion rapide
          </Text>

          <View style={styles.menuGrid}>
            <MenuButton
              title="Parfums"
              description="Créer, consulter et modifier les parfums."
              symbol="P"
              onPress={() =>
                onNavigate?.("products")
              }
            />

            <MenuButton
              title="Mouvements de stock"
              description="Enregistrer les achats, ventes et ajustements."
              symbol="S"
              onPress={() =>
                onNavigate?.("stock")
              }
            />

            <MenuButton
              title="Catégories"
              description="Organiser le catalogue de parfums."
              symbol="C"
              onPress={() =>
                onNavigate?.("categories")
              }
            />

            <MenuButton
              title="Fournisseurs"
              description="Gérer les partenaires et leurs coordonnées."
              symbol="F"
              onPress={() =>
                onNavigate?.("suppliers")
              }
            />
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

  scrollContent: {
    paddingBottom: 40,
  },

  container: {
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    paddingHorizontal: 20,
  },

  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: colors.background,
  },

  loadingLogo: {
    width: 230,
    height: 140,
  },

  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },

  header: {
    minHeight: 94,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  headerLogo: {
    width: 170,
    height: 68,
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  userBox: {
    maxWidth: 240,
    alignItems: "flex-end",
  },

  userEmail: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },

  userRole: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12,
    textTransform: "capitalize",
  },

  logoutButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },

  logoutButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },

  welcome: {
    paddingTop: 34,
    paddingBottom: 25,
  },

  eyebrow: {
    color: colors.secondaryDark,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.3,
  },

  title: {
    marginTop: 7,
    color: colors.primaryDark,
    fontSize: 34,
    fontWeight: "800",
  },

  subtitle: {
    marginTop: 7,
    color: colors.textMuted,
    fontSize: 16,
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
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

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },

  statCard: {
    position: "relative",
    flexGrow: 1,
    flexBasis: 230,
    minHeight: 145,
    overflow: "hidden",
    padding: 20,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  statAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 5,
  },

  statLabel: {
    color: colors.textMuted,
    fontSize: 13,
,
    fontWeight: "600",
  },

  statValue: {
    marginTop: 11,
    color: colors.primaryDark,
    fontSize: 27,
    fontWeight: "800",
  },

  statDetail: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 12,
  },

  section: {
    marginTop: 34,
  },

  sectionTitle: {
    marginBottom: 15,
    color: colors.primaryDark,
    fontSize: 22,
    fontWeight: "800",
  },

  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },

  menuButton: {
    flexGrow: 1,
    flexBasis: 310,
    minHeight: 112,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    padding: 18,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  menuSymbol: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor:
      colors.primaryLight,
  },

  menuSymbolText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "900",
  },

  menuContent: {
    flex: 1,
  },

  menuTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },

  menuDescription: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },

  menuArrow: {
    color: colors.primary,
    fontSize: 28,
  },

  pressed: {
    opacity: 0.82,
  },
});
