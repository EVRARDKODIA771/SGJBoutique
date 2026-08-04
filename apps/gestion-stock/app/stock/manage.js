import {
  Redirect,
  router,
} from "expo-router";

import ProductsScreen from
  "../../src/screens/ProductsScreen.js";

import {
  useAuthStore,
} from "../../src/store/authStore.js";

export default function ManageStockPage() {
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

  return (
    <ProductsScreen
      onBack={() => {
        router.back();
      }}
      onCreate={() => {
        router.push("/products/new");
      }}
      onOpenProduct={(product) => {
        router.push(
          `/products/${product.id}/stock`
        );
      }}
    />
  );
}
