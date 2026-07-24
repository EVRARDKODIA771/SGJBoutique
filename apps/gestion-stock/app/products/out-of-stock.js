import {
  Redirect,
  router,
} from "expo-router";

import StockAlertProductsScreen from
  "../../src/screens/StockAlertProductsScreen.js";

import {
  useAuthStore,
} from "../../src/store/authStore.js";

export default function OutOfStockPage() {
  const session =
    useAuthStore(
      (state) => state.session
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

  if (!session) {
    return (
      <Redirect href="/login" />
    );
  }

  if (
    adminMembership?.status !==
    "approved"
  ) {
    return (
      <Redirect href="/access" />
    );
  }

  if (!companySessionId) {
    return (
      <Redirect
        href="/company-password"
      />
    );
  }

  return (
    <StockAlertProductsScreen
      view="out"
      onBack={() => {
        router.push("/dashboard");
      }}
      onOpenProduct={(productId) => {
        router.push(
          `/products/${productId}`
        );
      }}
    />
  );
}
