import {
  Redirect,
  router,
} from "expo-router";

import DashboardScreen from
  "../src/screens/DashboardScreen.js";

import {
  useAuthStore,
} from "../src/store/authStore.js";

export default function DashboardPage() {
  const session =
    useAuthStore(
      (state) => state.session
    );

  const user =
    useAuthStore(
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
    <DashboardScreen
      user={user}
      membership={adminMembership}
      onNavigate={(section) => {
        const routes = {
          products: "/products",
          stock: "/stock",
          categories: "/categories",
          suppliers: "/suppliers",
        };

        const destination =
          routes[section];

        if (destination) {
          router.push(destination);
        }
      }}
      onSignedOut={() => {
        router.replace("/login");
      }}
    />
  );
}
