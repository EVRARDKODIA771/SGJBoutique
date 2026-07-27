import {
  Redirect,
  router,
  useLocalSearchParams,
} from "expo-router";

import BiometricSetupScreen from
  "../src/screens/BiometricSetupScreen.js";

import {
  markNotificationRead,
} from "../src/services/notificationService.js";

import {
  useAuthStore,
} from "../src/store/authStore.js";

export default function BiometricSetupPage() {
  const parameters =
    useLocalSearchParams();

  const rawReturnTo =
    Array.isArray(
      parameters.returnTo
    )
      ? parameters.returnTo[0]
      : parameters.returnTo;

  const returnTo =
    typeof rawReturnTo === "string" &&
    rawReturnTo.startsWith("/") &&
    !rawReturnTo.startsWith("//")
      ? rawReturnTo
      : "/dashboard";

  const rawNotificationId =
    Array.isArray(
      parameters.notificationId
    )
      ? parameters.notificationId[0]
      : parameters.notificationId;

  const notificationId =
    typeof rawNotificationId ===
      "string"
      ? rawNotificationId
      : null;

  const session =
    useAuthStore(
      (state) => state.session
    );

  const user =
    useAuthStore(
      (state) => state.user
    );

  const membership =
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
    membership?.status !==
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
    <BiometricSetupScreen
      userId={user.id}
      onCompleted={async () => {
        await markNotificationRead(
          notificationId
        );

        router.replace(returnTo);
      }}
    />
  );
}
