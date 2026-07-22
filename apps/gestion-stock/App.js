import {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

import { StatusBar } from
  "expo-status-bar";

import AccessStatusScreen from
  "./src/screens/AccessStatusScreen.js";

import CompanyPasswordScreen from
  "./src/screens/CompanyPasswordScreen.js";

import DashboardScreen from
  "./src/screens/DashboardScreen.js";

import LoginScreen from
  "./src/screens/LoginScreen.js";

import ProductDetailScreen from
  "./src/screens/ProductDetailScreen.js";

import ProductFormScreen from
  "./src/screens/ProductFormScreen.js";

import ProductsScreen from
  "./src/screens/ProductsScreen.js";

import ProductSuppliersScreen from
  "./src/screens/ProductSuppliersScreen.js";

import StockMovementScreen from
  "./src/screens/StockMovementScreen.js";

import {
  initializeAuth,
} from "./src/services/authService.js";

import { supabase } from
  "./src/lib/supabase.js";

import { useAuthStore } from
  "./src/store/authStore.js";

import { colors } from
  "./src/theme/colors.js";

function LoadingScreen() {
  return (
    <View style={styles.loadingScreen}>
      <Image
        source={require(
          "./assets/jde-logo.png"
        )}
        style={styles.loadingLogo}
        resizeMode="contain"
      />

      <ActivityIndicator
        size="large"
        color={colors.primary}
      />

      <Text style={styles.loadingText}>
        Initialisation de l’espace
        sécurisé…
      </Text>
    </View>
  );
}

function SectionPlaceholder({
  section,
  onBack,
}) {
  const sectionNames = {
    stock: "Mouvements de stock",
    categories:
      "Gestion des catégories",
    suppliers:
      "Gestion des fournisseurs",
  };

  return (
    <View
      style={styles.placeholderScreen}
    >
      <View style={styles.placeholderCard}>
        <Text
          style={styles.placeholderEyebrow}
        >
          JDE — GESTION DE STOCK
        </Text>

        <Text
          style={styles.placeholderTitle}
        >
          {sectionNames[section] ??
            "Section"}
        </Text>

        <Text
          style={
            styles.placeholderDescription
          }
        >
          Cette section est maintenant
          reliée à l’application. Son
          interface complète sera ajoutée
          à l’étape suivante.
        </Text>

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
            Retour au tableau de bord
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ApplicationContent() {
  const [
    activeSection,
    setActiveSection,
  ] = useState("dashboard");

  const [
    selectedProduct,
    setSelectedProduct,
  ] = useState(null);

  const session = useAuthStore(
    (state) => state.session
  );

  const user = useAuthStore(
    (state) => state.user
  );

  const adminMembership =
    useAuthStore(
      (state) =>
        state.adminMembership
    );

  const companySessionId =
    useAuthStore(
      (state) =>
        state.companySessionId
    );

  const isInitializing =
    useAuthStore(
      (state) =>
        state.isInitializing
    );

  const setSession = useAuthStore(
    (state) => state.setSession
  );

  const setAdminMembership =
    useAuthStore(
      (state) =>
        state.setAdminMembership
    );

  const resetAuthentication =
    useAuthStore(
      (state) =>
        state.resetAuthentication
    );

  useEffect(() => {
    initializeAuth().catch(
      (error) => {
        console.error(
          "Authentication initialization error:",
          error
        );
      }
    );

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (event === "SIGNED_OUT") {
          resetAuthentication();

          setActiveSection(
            "dashboard"
          );

          setSelectedProduct(null);

          return;
        }

        setSession(newSession);
      }
    );

    return () => {
      authListener.subscription
        .unsubscribe();
    };
  }, [
    resetAuthentication,
    setSession,
  ]);

  if (isInitializing) {
    return <LoadingScreen />;
  }

  if (!session) {
    return (
      <LoginScreen
        onAuthenticated={() => {
          setActiveSection(
            "dashboard"
          );

          setSelectedProduct(null);
        }}
      />
    );
  }

  if (
    adminMembership?.status !==
    "approved"
  ) {
    return (
      <AccessStatusScreen
        membership={adminMembership}
        onStatusChanged={(
          membership
        ) => {
          setAdminMembership(
            membership
          );
        }}
        onSignedOut={() => {
          setActiveSection(
            "dashboard"
          );

          setSelectedProduct(null);
        }}
      />
    );
  }

  if (!companySessionId) {
    return (
      <CompanyPasswordScreen
        userEmail={user?.email}
        onVerified={() => {
          setActiveSection(
            "dashboard"
          );

          setSelectedProduct(null);
        }}
        onSignedOut={() => {
          setActiveSection(
            "dashboard"
          );

          setSelectedProduct(null);
        }}
      />
    );
  }

  if (activeSection === "products") {
    return (
      <ProductsScreen
        onBack={() => {
          setActiveSection(
            "dashboard"
          );

          setSelectedProduct(null);
        }}
        onCreate={() => {
          setSelectedProduct(null);

          setActiveSection(
            "product-create"
          );
        }}
        onOpenProduct={(product) => {
          setSelectedProduct(product);

          setActiveSection(
            "product-detail"
          );
        }}
      />
    );
  }

  if (
    activeSection ===
    "product-create"
  ) {
    return (
      <ProductFormScreen
        onBack={() => {
          setActiveSection(
            "products"
          );
        }}
        onCreated={(product) => {
          setSelectedProduct(product);

          setActiveSection(
            "product-detail"
          );
        }}
      />
    );
  }

  if (
    activeSection ===
      "product-edit" &&
    selectedProduct
  ) {
    return (
      <ProductFormScreen
        product={selectedProduct}
        onBack={() => {
          setActiveSection(
            "product-detail"
          );
        }}
        onUpdated={(product) => {
          setSelectedProduct(product);

          setActiveSection(
            "product-detail"
          );
        }}
      />
    );
  }

  if (
    activeSection ===
      "product-stock" &&
    selectedProduct
  ) {
    return (
      <StockMovementScreen
        product={selectedProduct}
        onBack={() => {
          setActiveSection(
            "product-detail"
          );
        }}
        onRecorded={(product) => {
          setSelectedProduct(product);

          setActiveSection(
            "product-detail"
          );
        }}
      />
    );
  }

  if (
    activeSection ===
      "product-suppliers" &&
    selectedProduct
  ) {
    return (
      <ProductSuppliersScreen
        product={selectedProduct}
        onBack={() => {
          setActiveSection(
            "product-detail"
          );
        }}
      />
    );
  }

  if (
    activeSection ===
      "product-detail" &&
    selectedProduct
  ) {
    return (
      <ProductDetailScreen
        productId={selectedProduct.id}
        initialProduct={
          selectedProduct
        }
        onBack={() => {
          setActiveSection(
            "products"
          );
        }}
        onEdit={(product) => {
          setSelectedProduct(product);

          setActiveSection(
            "product-edit"
          );
        }}
        onStockMovement={(
          product
        ) => {
          setSelectedProduct(product);

          setActiveSection(
            "product-stock"
          );
        }}
        onSuppliers={(product) => {
          setSelectedProduct(product);

          setActiveSection(
            "product-suppliers"
          );
        }}
        onProductChanged={(
          product
        ) => {
          setSelectedProduct(product);
        }}
      />
    );
  }

  if (activeSection !== "dashboard") {
    return (
      <SectionPlaceholder
        section={activeSection}
        onBack={() => {
          setActiveSection(
            "dashboard"
          );

          setSelectedProduct(null);
        }}
      />
    );
  }

  return (
    <DashboardScreen
      user={user}
      membership={adminMembership}
      onNavigate={(section) => {
        setSelectedProduct(null);
        setActiveSection(section);
      }}
      onSignedOut={() => {
        setActiveSection(
          "dashboard"
        );

        setSelectedProduct(null);
      }}
    />
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={styles.safeArea}
        edges={[
          "top",
          "right",
          "bottom",
          "left",
        ]}
      >
        <StatusBar
          style="dark"
          backgroundColor={
            colors.background
          }
        />

        <ApplicationContent />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 17,
    backgroundColor: colors.background,
  },

  loadingLogo: {
    width: 245,
    height: 160,
  },

  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },

  placeholderScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: colors.background,
  },

  placeholderCard: {
    width: "100%",
    maxWidth: 520,
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 36,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  placeholderEyebrow: {
    color: colors.secondaryDark,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textAlign: "center",
  },

  placeholderTitle: {
    marginTop: 11,
    color: colors.primaryDark,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
  },

  placeholderDescription: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
  },

  backButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 25,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },

  backButtonText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: "700",
  },

  pressed: {
    opacity: 0.84,
  },
});
