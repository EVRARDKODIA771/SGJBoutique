import {
  Redirect,
  router,
} from "expo-router";

import AccessStatusScreen from
  "../src/screens/AccessStatusScreen.js";

import {
  useAuthStore,
} from "../src/store/authStore.js";

export default function AccessPage() {
  const session =
    useAuthStore(
      (state) => state.session
    );

  const adminMembership =
    useAuthStore(
      (state) =>
        state.adminMembership
    );

  const setAdminMembership =
    useAuthStore(
      (state) =>
        state.setAdminMembership
    );

  if (!session) {
    return (
      <Redirect href="/login" />
    );
  }

  if (
    adminMembership?.status ===
    "approved"
  ) {
    return (
      <Redirect href="/" />
    );
  }

  return (
    <AccessStatusScreen
      membership={adminMembership}
      onStatusChanged={(
        membership
      ) => {
        setAdminMembership(
          membership
        );

        if (
          membership?.status ===
          "approved"
        ) {
          router.replace("/");
        }
      }}
      onSignedOut={() => {
        router.replace("/login");
      }}
    />
  );
}
