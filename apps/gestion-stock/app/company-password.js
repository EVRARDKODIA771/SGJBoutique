import {
  Redirect,
  router,
} from "expo-router";

import CompanyPasswordScreen from
  "../src/screens/CompanyPasswordScreen.js";

import {
  useAuthStore,
} from "../src/store/authStore.js";

export default function CompanyPasswordPage() {
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

  if (companySessionId) {
    return (
      <Redirect href="/dashboard" />
    );
  }

  return (
    <CompanyPasswordScreen
      userEmail={user?.email}
      onVerified={() => {
        router.replace("/dashboard");
      }}
      onSignedOut={() => {
        router.replace("/login");
      }}
    />
  );
}
