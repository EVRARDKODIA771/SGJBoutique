import {
  Redirect,
  router,
  useLocalSearchParams,
} from "expo-router";

import CompanyPasswordScreen from
  "../src/screens/CompanyPasswordScreen.js";

import {
  useAuthStore,
} from "../src/store/authStore.js";

import {
  markNotificationRead,
} from "../src/services/notificationService.js";

export default function CompanyPasswordPage() {
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
      "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      rawNotificationId
    )
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
      <Redirect href={returnTo} />
    );
  }

  return (
    <CompanyPasswordScreen
      userEmail={user?.email}
      onVerified={async () => {
        await markNotificationRead(
          notificationId
        );

        router.replace(returnTo);
      }}
      onSignedOut={() => {
        router.replace("/login");
      }}
    />
  );
}
