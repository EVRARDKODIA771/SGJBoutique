
import {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  Redirect,
  router,
  useLocalSearchParams,
} from "expo-router";

import StockMovementScreen from
  "../../../src/screens/StockMovementScreen.js";

import {
  getProduct,
} from "../../../src/services/stockService.js";

import {
  useAuthStore,
} from "../../../src/store/authStore.js";

import {
  colors,
} from "../../../src/theme/colors.js";

export default function ProductStockPage() {
  const parameters =
    useLocalSearchParams();

  const productId = Array.isArray(
    parameters.productId
  )
    ? parameters.productId[0]
    : parameters.productId;

  const [product, setProduct] =
    useState(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const session = useAuthStore(
    (state) => state.session
  );

  const membership = useAuthStore(
    (state) =>
      state.adminMembership
  );

  const companySessionId =
    useAuthStore(
      (state) =>
        state.companySessionId
    );

  useEffect(() => {
    if (
      !session ||
      membership?.status !==
        "approved" ||
      !companySessionId ||
      !productId
    ) {
      return;
    }

    let isMounted = true;

    async function loadProduct() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const result =
          await getProduct(productId);

        if (isMounted) {
          setProduct(
            result.product ?? null
          );
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error?.message ||
              "Impossible de charger le parfum."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [
    session,
    membership?.status,
    companySessionId,
    productId,
  ]);

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (
    membership?.status !== "approved"
  ) {
    return <Redirect href="/access" />;
  }

  if (!companySessionId) {
    return (
      <Redirect
        href="/company-password"
      />
    );
  }

  if (!productId) {
    return (
      <Redirect href="/products" />
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />

        <Text style={styles.message}>
          Chargement du stock…
        </Text>
      </View>
    );
  }

  if (errorMessage || !product) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>
          {errorMessage ||
            "Parfum introuvable."}
        </Text>

        <Pressable
          style={styles.button}
          onPress={() => {
            router.push("/products");
          }}
        >
          <Text style={styles.buttonText}>
            Retour aux parfums
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <StockMovementScreen
      product={product}
      onBack={() => {
        router.push(
          `/products/${productId}`
        );
      }}
      onRecorded={(updatedProduct) => {
        router.replace(
          `/products/${updatedProduct.id}`
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
    backgroundColor:
      colors.background,
  },

  message: {
    color: colors.textMuted,
    fontSize: 15,
  },

  error: {
    color: colors.danger,
    fontSize: 15,
    textAlign: "center",
  },

  button: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },

  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
});
