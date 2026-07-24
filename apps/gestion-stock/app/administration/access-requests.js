import {
  Redirect,
  router,
} from "expo-router";

import AdministrationUsersScreen from
  "../../src/screens/AdministrationUsersScreen.js";

import {
  useAuthStore,
} from "../../src/store/authStore.js";

export default function AccessRequestsPage() {
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

  if (
    adminMembership?.role !==
    "owner"
  ) {
    return (
      <Redirect href="/dashboard" />
    );
  }

  return (
    <AdministrationUsersScreen
      view="requests"
      onBack={() => {
        router.push("/dashboard");
      }}
    />
  );
}
