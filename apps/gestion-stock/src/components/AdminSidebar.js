import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { router, usePathname } from "expo-router";

import { useAuthStore } from "../store/authStore.js";

import { colors } from "../theme/colors.js";

const menuSections = [
  {
    title: null,

    items: [
      {
        label: "Tableau de bord",
        symbol: "T",
        route: "/dashboard",
        exact: true,
      },
    ],
  },

  {
    title: "PARFUMS",

    items: [
      {
        label: "Tous les parfums",
        route: "/products",
        exact: true,
      },

      {
        label: "Ajouter un parfum",
        route: "/products/new",
        exact: true,
      },

      {
        label: "Parfums vendus",
        route: "/products/sold",
        exact: true,
      },

      {
        label: "Parfums achetés chez les fournisseurs",

        route: "/products/supplier-purchases",

        exact: true,
      },
    ],
  },

  {
    title: "GESTION DU STOCK",

    items: [
      {
        label: "Ajouter ou retirer des parfums",

        route: "/stock/manage",
        exact: true,
      },

      {
        label: "Historique des entrées et sorties",

        route: "/stock",
        exact: true,
      },
    ],
  },

  {
    title: "ORGANISATION",

    items: [
      {
        label: "Fournisseurs",
        symbol: "F",
        route: "/suppliers",
        exact: true,
      },
    ],
  },

  {
    title: "ADMINISTRATION",
    ownerOnly: true,

    items: [
      {
        label: "Demandes d’accès",

        route: "/administration/access-requests",

        exact: true,
      },

      {
        label: "Utilisateurs autorisés",

        route: "/administration/authorized-users",

        exact: true,
      },
    ],
  },
];

function normalizePathname(pathname) {
  if (!pathname || pathname === "/") {
    return pathname || "/";
  }

  return pathname.replace(/\/+$/, "");
}

function isItemActive(pathname, item) {
  const currentPath = normalizePathname(pathname);

  const itemRoute = normalizePathname(item.route);

  if (item.exact) {
    return currentPath === itemRoute;
  }

  return currentPath === itemRoute || currentPath.startsWith(`${itemRoute}/`);
}

function MenuItem({ item, active, onNavigate }) {
  const nested = !item.symbol;

  function handlePress() {
    if (!active) {
      router.push(item.route);
    }

    /*
     * Sur smartphone, cette fonction
     * referme le menu après navigation.
     */
    onNavigate?.();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{
        selected: active,
      }}
      style={({ pressed }) => [
        styles.item,

        nested && styles.subItem,

        active && styles.activeItem,

        pressed && styles.pressedItem,
      ]}
      onPress={handlePress}
    >
      {nested ? (
        <View style={[styles.subDot, active && styles.activeSubDot]} />
      ) : (
        <View style={[styles.symbol, active && styles.activeSymbol]}>
          <Text style={[styles.symbolText, active && styles.activeSymbolText]}>
            {item.symbol}
          </Text>
        </View>
      )}

      <Text
        style={[
          styles.itemText,

          nested && styles.subItemText,

          active && styles.activeItemText,
        ]}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

export default function AdminSidebar({ onNavigate, isDrawer = false }) {
  const pathname = usePathname();

  const role = useAuthStore((state) => state.adminMembership?.role);

  function goToDashboard() {
    if (normalizePathname(pathname) !== "/dashboard") {
      router.push("/dashboard");
    }

    /*
     * Sur smartphone, cela referme
     * automatiquement le menu latéral.
     */
    onNavigate?.();
  }

  return (
    <View style={[styles.sidebar, isDrawer && styles.sidebarDrawer]}>
      <View style={styles.brand}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Retour au tableau de bord"}
          style={({ pressed }) => [
            styles.logoButton,

            pressed && styles.logoButtonPressed,
          ]}
          onPress={goToDashboard}
        >
          <Image
            source={require("../../assets/jde-logo.png")}
            style={styles.logo}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />

          <Text style={styles.brandName}>Gestion de la boutique</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        bounces
      >
        {menuSections.map((section, sectionIndex) => {
          if (section.ownerOnly && role !== "owner") {
            return null;
          }

          return (
            <View key={section.title ?? `main-${sectionIndex}`}>
              {section.title ? (
                <Text style={styles.sectionTitle}>{section.title}</Text>
              ) : null}

              {section.items.map((item, itemIndex) => (
                <MenuItem
                  key={`${item.route}-${itemIndex}`}
                  item={item}
                  active={isItemActive(pathname, item)}
                  onNavigate={onNavigate}
                />
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 292,
    height: "100%",
    minHeight: 0,
    flexShrink: 0,

    backgroundColor: colors.brandBlueDark,

    borderRightWidth: 4,

    borderRightColor: colors.secondaryDark,
  },

  sidebarDrawer: {
    width: "100%",
    minWidth: 0,
    flex: 1,
  },

  brand: {
    minHeight: 135,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 18,
    paddingVertical: 15,

    borderBottomWidth: 1,

    borderBottomColor: "rgba(255,255,255,0.16)",

    backgroundColor: colors.surface,
  },

  logoButton: {
    width: "100%",

    alignItems: "center",
    justifyContent: "center",

    paddingVertical: 4,

    borderRadius: 12,
  },

  logoButtonPressed: {
    opacity: 0.72,
  },

  logo: {
    width: 155,
    height: 72,
  },

  brandName: {
    marginTop: 4,

    color: colors.brandBlueDark,

    fontSize: 13,
    fontWeight: "800",
  },

  scroll: {
    flex: 1,
    minHeight: 0,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 11,
    paddingTop: 15,
    paddingBottom: 30,
  },

  sectionTitle: {
    marginTop: 19,
    marginBottom: 7,

    paddingHorizontal: 11,

    color: colors.secondary,

    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  item: {
    minHeight: 46,

    flexDirection: "row",
    alignItems: "center",

    gap: 11,

    paddingHorizontal: 11,
    paddingVertical: 8,

    borderRadius: 9,
  },

  subItem: {
    minHeight: 42,
    paddingLeft: 22,
  },

  activeItem: {
    backgroundColor: colors.secondaryDark,
  },

  pressedItem: {
    opacity: 0.82,
  },

  symbol: {
    width: 28,
    height: 28,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 8,

    backgroundColor: "rgba(255,255,255,0.12)",
  },

  activeSymbol: {
    backgroundColor: colors.surface,
  },

  symbolText: {
    color: colors.surface,

    fontSize: 12,
    fontWeight: "900",
  },

  activeSymbolText: {
    color: colors.secondaryDark,
  },

  subDot: {
    width: 6,
    height: 6,

    borderRadius: 999,

    backgroundColor: colors.secondary,
  },

  activeSubDot: {
    backgroundColor: colors.surface,
  },

  itemText: {
    flex: 1,

    color: colors.surface,

    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },

  subItemText: {
    color: "rgba(255,255,255,0.86)",

    fontSize: 12,
    fontWeight: "600",
  },

  activeItemText: {
    color: colors.surface,
    fontWeight: "900",
  },
});
