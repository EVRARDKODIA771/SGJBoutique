import {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Image,
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

import CategoriesScreen from
  "./src/screens/CategoriesScreen.js";

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

import StockHistoryScreen from
  "./src/screens/StockHistoryScreen.js";

import StockMovementScreen from
  "./src/screens/StockMovementScreen.js";

import SuppliersScreen from
  "./src/screens/SuppliersScreen.js";

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

function ApplicationContent() {
  const [
    activeSection,
    setActiveSection,
  ] = useState("dashboard");

  const [
    selectedProduct,
    setSelectedProduct,
  ] = useState(null);

  const [
    productReturnSection,
    setProductReturnSection,
  ] = useState("products");

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

  function returnToDashboard() {
    setActiveSection("dashboard");
    setSelectedProduct(null);

    setProductReturnSection(
      "products"
    );
  }

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
          returnToDashboard();

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
          returnToDashboard();
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
          returnToDashboard();
        }}
      />
    );
  }

  if (!companySessionId) {
    return (
      <CompanyPasswordScreen
        userEmail={user?.email}
        onVerified={() => {
          returnToDashboard();
        }}
        onSignedOut={() => {
          returnToDashboard();
        }}
      />
    );
  }

  if (activeSection === "stock") {
    return (
      <StockHistoryScreen
        onBack={() => {
          returnToDashboard();
        }}
        onOpenProduct={(product) => {
          setSelectedProduct(product);

          setProductReturnSection(
            "stock"
          );

          setActiveSection(
            "product-detail"
          );
        }}
      />
    );
  }

  if (
    activeSection === "categories"
  ) {
    return (
      <CategoriesScreen
        onBack={() => {
          returnToDashboard();
        }}
      />
    );
  }

  if (
    activeSection === "suppliers"
  ) {
    return (
      <SuppliersScreen
        onBack={() => {
          returnToDashboard();
        }}
      />
    );
  }

  if (activeSection === "products") {
    return (
      <ProductsScreen
        onBack={() => {
          returnToDashboard();
        }}
        onCreate={() => {
          setSelectedProduct(null);

          setProductReturnSection(
            "products"
          );

          setActiveSection(
            "product-create"
          );
        }}
        onOpenProduct={(product) => {
          setSelectedProduct(product);

          setProductReturnSection(
            "products"
          );

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

          setProductReturnSection(
            "products"
          );

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
          setSelectedProduct(null);

          setActiveSection(
            productReturnSection
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

  return (
    <DashboardScreen
      user={user}
      membership={adminMembership}
      onNavigate={(section) => {
        setSelectedProduct(null);

        setProductReturnSection(
          "products"
        );

        setActiveSection(section);
      }}
      onSignedOut={() => {
        returnToDashboard();
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
});
