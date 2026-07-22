import {
  Redirect,
  router,
} from "expo-router";

import ProductFormScreen from
  "../../src/screens/ProductFormScreen.js";

import {
  useAuthStore,
} from "../../src/store/authStore.js";

export default function NewProductPage() {
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
    <ProductFormScreen
      onBack={() => {
        router.push("/products");
      }}
      onCreated={(product) => {
        router.replace(
          `/products/${product.id}`
        );
      }}
    />
  );
}
