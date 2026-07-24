import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  router,
  usePathname,
} from "expo-router";

import {
  useAuthStore,
} from "../store/authStore.js";

import { colors } from
  "../theme/colors.js";

const menuSections = [
  {
    title: null,
    items: [
      {
        label: "Tableau de bord",
        symbol: "T",
        route: "/dashboard",
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
      },
      {
        label: "Parfums vendus",
        route: "/products/sold",
      },
      {
        label:
          "Parfums achetés chez les fournisseurs",
        route:
          "/products/supplier-purchases",
      },
    ],
  },
  {
    title: "GESTION DU STOCK",
    items: [
      {
        label:
          "Ajouter ou retirer des parfums",
        route: "/stock",
      },
      {
        label:
          "Historique des entrées et sorties",
        route: "/stock",
      },
      {
        label:
          "Parfums bientôt épuisés",
        route: "/products/low-stock",
      },
      {
        label: "Parfums épuisés",
        route:
          "/products/out-of-stock",
      },
    ],
  },
  {
    title: "ORGANISATION",
    items: [
      {
        label: "Catégories",
        symbol: "C",
        route: "/categories",
      },
      {
        label: "Fournisseurs",
        symbol: "F",
        route: "/suppliers",
      },
    ],
  },
  {
    title: "ADMINISTRATION",
    ownerOnly: true,
    items: [
      {
        label: "Demandes d’accès",
        route:
          "/administration/access-requests",
      },
      {
        label:
          "Utilisateurs autorisés",
        route:
          "/administration/authorized-users",
      },
    ],
  },
];

function isItemActive(
  pathname,
  item
) {
  if (item.exact) {
    return pathname === item.route;
  }

  return pathname === item.route;
}

function MenuItem({
  item,
  active,
}) {
  const nested = !item.symbol;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.item,
        nested && styles.subItem,
        active && styles.activeItem,
        pressed && styles.pressedItem,
      ]}
      onPress={() => {
        if (!active) {
          router.push(item.route);
        }
      }}
    >
      {nested ? (
        <View style={styles.subDot} />
      ) : (
        <View
          style={[
            styles.symbol,
            active &&
              styles.activeSymbol,
          ]}
        >
          <Text
            style={[
              styles.symbolText,
              active &&
                styles.activeSymbolText,
            ]}
          >
            {item.symbol}
          </Text>
        </View>
      )}

      <Text
        style={[
          styles.itemText,
          nested && styles.subItemText,
          active &&
            styles.activeItemText,
        ]}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

export default function AdminSidebar() {
  const pathname = usePathname();

  const role =
    useAuthStore(
      (state) =>
        state.adminMembership?.role
    );

  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <Image
          source={require(
            "../../assets/jde-logo.png"
          )}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.brandName}>
          Gestion de la boutique
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {menuSections.map(
          (section, sectionIndex) => {
            if (
              section.ownerOnly &&
              role !== "owner"
            ) {
              return null;
            }

            return (
              <View
                key={
                  section.title ??
                  `main-${sectionIndex}`
                }
              >
                {section.title ? (
                  <Text
                    style={
                      styles.sectionTitle
                    }
                  >
                    {section.title}
                  </Text>
                ) : null}

                {section.items.map(
                  (item, itemIndex) => (
                    <MenuItem
                      key={`${item.route}-${itemIndex}`}
                      item={item}
                      active={isItemActive(
                        pathname,
                        item
                      )}
                    />
                  )
                )}
              </View>
            );
          }
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 292,
    flexShrink: 0,
    backgroundColor:
      colors.brandBlueDark,
    borderRightWidth: 4,
    borderRightColor:
      colors.secondaryDark,
  },
  brand: {
    minHeight: 135,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor:
      "rgba(255,255,255,0.16)",
    backgroundColor: colors.surface,
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
  },
  content: {
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
    backgroundColor:
      colors.secondaryDark,
  },
  pressedItem: {
    backgroundColor:
      "rgba(255,255,255,0.12)",
  },
  symbol: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor:
      "rgba(255,255,255,0.12)",
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
    backgroundColor:
      colors.secondary,
  },
  itemText: {
    flex: 1,
    color: colors.surface,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  subItemText: {
    color:
      "rgba(255,255,255,0.86)",
    fontSize: 12,
    fontWeight: "600",
  },
  activeItemText: {
    color: colors.surface,
    fontWeight: "900",
  },
});
