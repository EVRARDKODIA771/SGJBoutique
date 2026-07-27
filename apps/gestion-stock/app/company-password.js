import {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";

import {
  Redirect,
  router,
  useLocalSearchParams,
} from "expo-router";

import CompanyPasswordScreen from
  "../src/screens/CompanyPasswordScreen.js";

import BiometricUnlockScreen from
  "../src/screens/BiometricUnlockScreen.js";

import {
  getBiometricCapabilities,
  hasBiometricCredential,
  shouldOfferBiometricEnrollment,
} from "../src/services/biometricService.js";

import { colors } from
  "../src/theme/colors.js";

import {
  useAuthStore,
} from "../src/store/authStore.js";

import {
  markNotificationRead,
} from "../src/services/notificationService.js";

export default function CompanyPasswordPage() {
  const [
    authenticationMode,
    setAuthenticationMode,
  ] = useState("checking");

  const [
    biometricLabel,
    setBiometricLabel,
  ] = useState("biométrie");

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

  const setCompanySessionId =
    useAuthStore(
      (state) =>
        state.setCompanySessionId
    );

  useEffect(() => {
    let isMounted = true;

    async function resolveMode() {
      if (!user?.id) {
        return;
      }

      try {
        const [
          capabilities,
          hasCredential,
        ] = await Promise.all([
          getBiometricCapabilities(),
          hasBiometricCredential(
            user.id
          ),
        ]);

        if (!isMounted) {
          return;
        }

        setBiometricLabel(
          capabilities.label
        );

        setAuthenticationMode(
          capabilities.available &&
            hasCredential
            ? "biometric"
            : "password"
        );
      } catch {
        if (isMounted) {
          setAuthenticationMode(
            "password"
          );
        }
      }
    }

    resolveMode();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

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

  if (
    authenticationMode ===
    "checking"
  ) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          size="large"
          color={
            colors.brandBlueDark
          }
        />
      </View>
    );
  }

  if (
    authenticationMode ===
    "biometric"
  ) {
    return (
      <BiometricUnlockScreen
        userId={user.id}
        biometricLabel={
          biometricLabel
        }
        onUnlocked={async () => {
          await markNotificationRead(
            notificationId
          );

          router.replace(returnTo);
        }}
        onUsePassword={() =>
          setAuthenticationMode(
            "password"
          )
        }
        onSignedOut={() => {
          router.replace("/login");
        }}
      />
    );
  }

  return (
    <CompanyPasswordScreen
      userEmail={user?.email}
      onVerified={async (result) => {
        const shouldOffer =
          await shouldOfferBiometricEnrollment(
            user.id
          );

        setCompanySessionId(
          result.session_id
        );

        if (shouldOffer) {
          router.replace({
            pathname:
              "/biometric-setup",
            params: {
              returnTo,
              notificationId:
                notificationId ?? "",
            },
          });

          return;
        }

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

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      colors.background,
  },
});
