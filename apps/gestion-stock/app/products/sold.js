import {
  Redirect,
  router,
} from "expo-router";

import SoldProductsScreen from
  "../../src/screens/SoldProductsScreen.js";

import {
  useAuthStore,
} from "../../src/store/authStore.js";

export default function SoldProductsPage() {
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
    <SoldProductsScreen
      onBack={() => {
        router.push("/products");
      }}
      onOpenProduct={(product) => {
        if (!product?.id) {
          return;
        }

        router.push(
          `/products/${product.id}`
        );
      }}
    />
  );
}
