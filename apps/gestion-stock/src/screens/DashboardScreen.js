import { useCallback, useEffect, useState } from "react";

import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { signOut } from "../services/authService.js";

import { getDashboardStatistics } from "../services/stockService.js";

import { colors } from "../theme/colors.js";

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR").format(value ?? 0) + " FCFA";
}

function StatCard({
  label,
  value,
  detail,
  accentColor,
  onPress,
  compact = false,
  hidden = false,
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.statCard,
        compact && styles.statCardCompact,
        pressed && Boolean(onPress) && styles.pressed,
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View
        style={[
          styles.statAccent,
          {
            backgroundColor: accentColor,
          },
        ]}
      />

      <Text style={[styles.statLabel, compact && styles.statLabelCompact]}>
        {label}
      </Text>

      <Text style={[styles.statValue, compact && styles.statValueCompact]}>
        {hidden ? "********" : value}
      </Text>

      <Text style={[styles.statDetail, compact && styles.statDetailCompact]}>
        {detail}
      </Text>
      {onPress ? (
        <Text style={[styles.statArrow, compact && styles.statArrowCompact]}>
          ›
        </Text>
      ) : null}
    </Pressable>
  );
}

function SidebarItem({
  label,
  symbol,
  active = false,
  nested = false,
  onPress,
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.sidebarItem,
        nested && styles.sidebarSubItem,
        active && styles.sidebarItemActive,
        pressed && styles.sidebarPressed,
      ]}
      onPress={onPress}
    >
      {!nested ? (
        <View
          style={[styles.sidebarSymbol, active && styles.sidebarSymbolActive]}
        >
          <Text
            style={[
              styles.sidebarSymbolText,
              active && styles.sidebarSymbolTextActive,
            ]}
          >
            {symbol}
          </Text>
        </View>
      ) : (
        <View style={styles.sidebarSubDot} />
      )}

      <Text
        style={[
          styles.sidebarItemText,
          nested && styles.sidebarSubItemText,
          active && styles.sidebarItemTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MenuButton({
  title,
  description,
  symbol,
  iconBackgroundColor,
  iconColor,
  onPress,
  compact = false,
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuButton,
        compact && styles.menuButtonCompact,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.menuSymbol,
          compact && styles.menuSymbolCompact,
          iconBackgroundColor
            ? {
                backgroundColor: iconBackgroundColor,
              }
            : null,
        ]}
      >
        <Text
          style={[
            styles.menuSymbolText,
            compact && styles.menuSymbolTextCompact,
            iconColor
              ? {
                  color: iconColor,
                }
              : null,
          ]}
        >
          {symbol}
        </Text>
      </View>

      <View style={[styles.menuContent, compact && styles.menuContentCompact]}>
        <Text
          style={[styles.menuTitle, compact && styles.menuTitleCompact]}
          numberOfLines={2}
        >
          {title}
        </Text>

        <Text
          style={[
            styles.menuDescription,
            compact && styles.menuDescriptionCompact,
          ]}
          numberOfLines={2}
        >
          {description}
        </Text>
      </View>

      <Text style={[styles.menuArrow, compact && styles.menuArrowCompact]}>
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
  const { width } = useWindowDimensions();

  const isCompact = width < 600;

  const [statistics, setStatistics] = useState({
    productTotal: 0,
    supplierTotal: 0,
    stockQuantity: 0,
    soldUnits: 0,
    salesRevenue: 0,
    purchaseCost: 0,
    profit: 0,
  });

  const [isLoading, setIsLoading] = useState(true);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const [isSigningOut, setIsSigningOut] = useState(false);

  const [areValuesVisible, setAreValuesVisible] = useState(true);

  const loadDashboard = useCallback(async () => {
    setErrorMessage("");

    try {
      const result =
        await getDashboardStatistics();

      setStatistics(
        result.statistics ?? {
          productTotal: 0,
          supplierTotal: 0,
          stockQuantity: 0,
          soldUnits: 0,
          salesRevenue: 0,
          purchaseCost: 0,
          profit: 0,
        }
      );
    } catch (error) {
      console.error("Dashboard loading error:", error);

      setErrorMessage("Impossible de charger les données du tableau de bord.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await signOut();
      onSignedOut?.();
    } catch (error) {
      console.error("Dashboard sign out error:", error);

      setErrorMessage("Impossible de fermer la session.");

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
          source={require("../../assets/jde-logo.png")}
          style={styles.loadingLogo}
          resizeMode="contain"
        />

        <ActivityIndicator size="large" color={colors.primary} />

        <Text style={styles.loadingText}>Chargement du stock…</Text>
      </View>
    );
  }

  return (
    <View style={styles.appShell}>
      <View style={styles.dashboardLegacySidebar}>
        <View style={styles.sidebarBrand}>
          <Image
            source={require("../../assets/jde-logo.png")}
            style={styles.sidebarLogo}
            resizeMode="contain"
          />

          <Text style={styles.sidebarName}>Gestion de la boutique</Text>
        </View>

        <ScrollView
          style={styles.sidebarScroll}
          contentContainerStyle={styles.sidebarContent}
          showsVerticalScrollIndicator={false}
        >
          <SidebarItem
            label="Tableau de bord"
            symbol="T"
            active
            onPress={() => onNavigate?.("dashboard")}
          />

          <Text style={styles.sidebarSection}>PARFUMS</Text>

          <SidebarItem
            label="Tous les parfums"
            nested
            onPress={() => onNavigate?.("products")}
          />

          <SidebarItem
            label="Ajouter un parfum"
            nested
            onPress={() => onNavigate?.("newProduct")}
          />

          <SidebarItem
            label="Parfums vendus"
            nested
            onPress={() => onNavigate?.("soldProducts")}
          />

          <SidebarItem
            label="Parfums achetés chez les fournisseurs"
            nested
            onPress={() => onNavigate?.("supplierPurchases")}
          />

          <Text style={styles.sidebarSection}>GESTION DU STOCK</Text>

          <SidebarItem
            label="Ajouter ou retirer des parfums"
            nested
            onPress={() => onNavigate?.("stock")}
          />

          <SidebarItem
            label="Historique des entrées et sorties"
            nested
            onPress={() => onNavigate?.("stock")}
          />

          <Text style={styles.sidebarSection}>ORGANISATION</Text>

          <SidebarItem
            label="Fournisseurs"
            symbol="F"
            onPress={() => onNavigate?.("suppliers")}
          />

          <Text style={styles.sidebarSection}>ADMINISTRATION</Text>

          <SidebarItem
            label="Demandes d’accès"
            nested
            onPress={() => onNavigate?.("accessRequests")}
          />

          <SidebarItem
            label="Utilisateurs autorisés"
            nested
            onPress={() => onNavigate?.("authorizedUsers")}
          />
        </ScrollView>
      </View>

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
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
              source={require("../../assets/jde-logo.png")}
              style={styles.headerLogo}
              resizeMode="contain"
            />

            <View style={styles.headerActions}>
              <View style={styles.userBox}>
                <Text style={styles.userEmail} numberOfLines={1}>
                  {user?.email ?? "Administrateur"}
                </Text>

                <Text style={styles.userRole}>
                  {membership?.role ?? "administrateur"}
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
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.logoutButtonText}>Déconnexion</Text>
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.welcome}>
            <Text style={styles.eyebrow}>ESPACE ADMINISTRATIF</Text>

            <Text style={styles.title}>Tableau de bord</Text>

            <Text style={styles.subtitle}>
              Vue d’ensemble du catalogue et du stock JDE.
            </Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>

              <Pressable onPress={loadDashboard}>
                <Text style={styles.retryText}>Réessayer</Text>
              </Pressable>
            </View>
          ) : null}

          {isCompact ? (
            <View style={styles.mobileProfitCard}>
              <View style={styles.mobileProfitInfo}>
                <Text style={styles.mobileProfitLabel}>Bénéfice :</Text>

                <Text style={styles.mobileProfitValue} numberOfLines={1}>
                  {areValuesVisible
                    ? formatCurrency(statistics.profit)
                    : "********"}
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.visibilityButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => setAreValuesVisible((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={
                  areValuesVisible
                    ? "Masquer les chiffres"
                    : "Afficher les chiffres"
                }
              >
                <Text style={styles.visibilityIcon}>
                  {areValuesVisible ? "👁" : "⊘"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View
            style={[styles.statsGrid, isCompact && styles.statsGridCompact]}
          >
            <StatCard
              compact={isCompact}
              hidden={isCompact && !areValuesVisible}
              label="Parfums"
              value={statistics.productTotal}
              detail="Produits enregistrés"
              accentColor={colors.primary}
              onPress={() => onNavigate?.("products")}
            />

            <StatCard
              compact={isCompact}
              hidden={isCompact && !areValuesVisible}
              label="Unités en stock"
              value={statistics.stockQuantity}
              detail="Quantité disponible"
              accentColor={colors.gold}
            />

            <StatCard
              compact={isCompact}
              hidden={isCompact && !areValuesVisible}
              label="Fournisseurs"
              value={statistics.supplierTotal}
              detail="Partenaires enregistrés"
              accentColor={colors.secondaryDark}
              onPress={() => onNavigate?.("suppliers")}
            />
          </View>

          <View style={[styles.section, isCompact && styles.sectionCompact]}>
            <Text
              style={[
                styles.sectionTitle,
                isCompact && styles.sectionTitleCompact,
              ]}
            >
              Gestion rapide
            </Text>

            <View
              style={[styles.menuGrid, isCompact && styles.menuGridCompact]}
            >
              <MenuButton
                compact={isCompact}
                title="Déclarer parfum acheté par un client"
                description="Enregistrer un parfum acheté par un client."
                symbol="✓"
                iconBackgroundColor={colors.successLight}
                iconColor={colors.success}
                onPress={() => onNavigate?.("declareSale")}
              />

              <MenuButton
                compact={isCompact}
                title="Mes parfums"
                description="Créer, consulter et modifier les parfums."
                symbol="P"
                iconBackgroundColor={colors.primaryLight}
                iconColor={colors.primary}
                onPress={() => onNavigate?.("products")}
              />

              <MenuButton
                compact={isCompact}
                title="Ajouter parfum"
                description="Ajouter un nouveau parfum."
                symbol="+"
                iconBackgroundColor={colors.secondaryLight}
                iconColor={colors.secondaryDark}
                onPress={() => onNavigate?.("newProduct")}
              />

              <MenuButton
                compact={isCompact}
                title="Historique des entrées et sorties"
                description="Consulter les achats, ventes et ajustements du stock."
                symbol="⇄"
                iconBackgroundColor={colors.infoLight}
                iconColor={colors.info}
                onPress={() => onNavigate?.("stock")}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  dashboardLegacySidebar: {
    display: "none",
  },

  appShell: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.background,
  },

  sidebar: {
    width: 292,
    flexShrink: 0,
    backgroundColor: colors.brandBlueDark,
    borderRightWidth: 4,
    borderRightColor: colors.secondaryDark,
  },

  sidebarBrand: {
    minHeight: 135,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.16)",
    backgroundColor: colors.surface,
  },

  sidebarLogo: {
    width: 155,
    height: 72,
  },

  sidebarName: {
    marginTop: 4,
    color: colors.brandBlueDark,
    fontSize: 13,
    fontWeight: "800",
  },

  sidebarScroll: {
    flex: 1,
  },

  sidebarContent: {
    paddingHorizontal: 11,
    paddingTop: 15,
    paddingBottom: 30,
  },

  sidebarSection: {
    marginTop: 19,
    marginBottom: 7,
    paddingHorizontal: 11,
    color: colors.secondary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  sidebarItem: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
  },

  sidebarSubItem: {
    minHeight: 42,
    paddingLeft: 22,
  },

  sidebarItemActive: {
    backgroundColor: colors.secondaryDark,
  },

  sidebarPressed: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  sidebarSymbol: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  sidebarSymbolActive: {
    backgroundColor: colors.surface,
  },

  sidebarSymbolText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: "900",
  },

  sidebarSymbolTextActive: {
    color: colors.secondaryDark,
  },

  sidebarSubDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.secondary,
  },

  sidebarItemText: {
    flex: 1,
    color: colors.surface,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },

  sidebarSubItemText: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 12,
    fontWeight: "600",
  },

  sidebarItemTextActive: {
    color: colors.surface,
    fontWeight: "900",
  },

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

  mobileProfitCard: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 17,
    backgroundColor: colors.brandBlueDark,
  },

  mobileProfitLabel: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },

  mobileProfitInfo: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  mobileProfitValue: {
    flexShrink: 1,
    color: colors.surface,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "900",
  },

  visibilityButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  visibilityIcon: {
    color: colors.surface,
    fontSize: 18,
    lineHeight: 22,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  statsGridCompact: {
    gap: 7,
  },

  statCard: {
    position: "relative",
    flexGrow: 1,
    flexBasis: 230,
    minHeight: 76,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  statCardCompact: {
    flexGrow: 1,
    flexBasis: "30%",
    maxWidth: "32%",
    minHeight: 76,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 13,
  },

  statAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 4,
  },

  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "600",
  },

  statLabelCompact: {
    fontSize: 9,
    lineHeight: 11,
  },

  statValue: {
    marginTop: 2,
    color: colors.primaryDark,
    fontSize: 22,
    lineHeight: 25,
    fontWeight: "800",
  },

  statValueCompact: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 16,
  },

  statDetail: {
    marginTop: 1,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
  },

  statDetailCompact: {
    marginTop: 2,
    fontSize: 8,
    lineHeight: 10,
  },

  statArrow: {
    position: "absolute",
    right: 12,
    bottom: 5,
    color: colors.secondaryDark,
    fontSize: 21,
    fontWeight: "800",
  },

  statArrowCompact: {
    right: 9,
    bottom: 3,
    fontSize: 17,
  },

  section: {
    marginTop: 18,
  },

  sectionCompact: {
    marginTop: 16,
  },

  sectionTitle: {
    marginBottom: 10,
    color: colors.primaryDark,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
  },

  sectionTitleCompact: {
    marginBottom: 10,
    fontSize: 17,
    lineHeight: 21,
  },

  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  menuGridCompact: {
    justifyContent: "space-between",
    columnGap: 7,
    rowGap: 9,
  },

  menuButton: {
    flexGrow: 1,
    flexBasis: 310,
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  menuButtonCompact: {
    flexGrow: 0,
    flexBasis: "31%",
    maxWidth: "31%",
    minHeight: 78,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 2,
    paddingVertical: 4,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
  },

  menuSymbol: {
    width: 38,
    height: 38,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: colors.primaryLight,
  },

  menuSymbolCompact: {
    width: 48,
    height: 48,
    borderRadius: 15,
  },

  menuSymbolText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900",
  },

  menuSymbolTextCompact: {
    fontSize: 17,
  },

  menuContent: {
    flex: 1,
    justifyContent: "center",
  },

  menuContentCompact: {
    flex: 0,
    width: "100%",
    alignItems: "center",
  },

  menuTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },

  menuTitleCompact: {
    textAlign: "center",
    fontSize: 10,
    lineHeight: 12,
  },

  menuDescription: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },

  menuDescriptionCompact: {
    display: "none",
  },

  menuArrow: {
    flexShrink: 0,
    color: colors.primary,
    fontSize: 22,
  },

  menuArrowCompact: {
    display: "none",
  },

  pressed: {
    opacity: 0.82,
  },
});
