import {
  Redirect,
  router,
} from "expo-router";

import StockHistoryScreen from
  "../src/screens/StockHistoryScreen.js";

import {
  useAuthStore,
} from "../src/store/authStore.js";

export default function StockPage() {
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
    <StockHistoryScreen
      onBack={() => {
        router.push("/dashboard");
      }}
      onOpenProduct={(product) => {
        router.push(
          `/products/${product.id}`
        );
      }}
    />
  );
}
