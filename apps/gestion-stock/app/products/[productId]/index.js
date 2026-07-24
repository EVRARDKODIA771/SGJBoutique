import {
  Redirect,
  router,
  useLocalSearchParams,
} from "expo-router";

import ProductDetailScreen from
  "../../../src/screens/ProductDetailScreen.js";

import {
  useAuthStore,
} from "../../../src/store/authStore.js";

export default function ProductDetailPage() {
  const parameters =
    useLocalSearchParams();

  const productId = Array.isArray(
    parameters.productId
  )
    ? parameters.productId[0]
    : parameters.productId;

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

  if (!productId) {
    return (
      <Redirect href="/products" />
    );
  }

  return (
    <ProductDetailScreen
      productId={productId}
      initialProduct={null}
      onBack={() => {
        router.push("/products");
      }}
      onEdit={() => {
        router.push(
          `/products/${productId}/edit`
        );
      }}
      onStockMovement={() => {
        router.push(
          `/products/${productId}/stock`
        );
      }}
      onSuppliers={() => {
        router.push(
          `/products/${productId}/suppliers`
        );
      }}
    />
  );
}
