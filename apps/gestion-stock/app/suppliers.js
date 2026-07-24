import {
  Redirect,
  router,
} from "expo-router";

import SuppliersScreen from
  "../src/screens/SuppliersScreen.js";

import {
  useAuthStore,
} from "../src/store/authStore.js";

export default function SuppliersPage() {
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
    <SuppliersScreen
      onBack={() => {
        router.push("/dashboard");
      }}
    />
  );
}
