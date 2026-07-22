import {
  useEffect,
} from "react";

import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  Stack,
} from "expo-router";

import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  StatusBar,
} from "expo-status-bar";

import {
  initializeAuth,
} from "../src/services/authService.js";

import {
  supabase,
} from "../src/lib/supabase.js";

import {
  useAuthStore,
} from "../src/store/authStore.js";

import {
  colors,
} from "../src/theme/colors.js";

function LoadingScreen() {
  return (
    <SafeAreaView
      style={styles.loadingScreen}
      edges={[
        "top",
        "right",
        "bottom",
        "left",
      ]}
    >
      <Image
        source={require(
          "../assets/jde-logo.png"
        )}
        style={styles.loadingLogo}
        resizeMode="contain"
      />

      <ActivityIndicator
        size="large"
        color={colors.primary}
      />

      <Text style={styles.loadingText}>
        Initialisation de l’espace
        sécurisé…
      </Text>
    </SafeAreaView>
  );
}

export default function RootLayout() {
  const isInitializing =
    useAuthStore(
      (state) =>
        state.isInitializing
    );

  const setSession =
    useAuthStore(
      (state) =>
        state.setSession
    );

  const resetAuthentication =
    useAuthStore(
      (state) =>
        state.resetAuthentication
    );

  useEffect(() => {
    initializeAuth().catch(
      (error) => {
        console.error(
          "Authentication initialization error:",
          error
        );
      }
    );

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (event === "SIGNED_OUT") {
          resetAuthentication();

          return;
        }

        setSession(newSession);
      }
    );

    return () => {
      authListener.subscription
        .unsubscribe();
    };
  }, [
    resetAuthentication,
    setSession,
  ]);

  if (isInitializing) {
    return (
      <SafeAreaProvider>
        <StatusBar
          style="dark"
          backgroundColor={
            colors.background
          }
        />

        <LoadingScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={styles.safeArea}
        edges={[
          "top",
          "right",
          "bottom",
          "left",
        ]}
      >
        <StatusBar
          style="dark"
          backgroundColor={
            colors.background
          }
        />

        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor:
                colors.background,
            },
          }}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor:
      colors.background,
  },

  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 17,
    backgroundColor:
      colors.background,
  },

  loadingLogo: {
    width: 245,
    height: 160,
  },

  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
