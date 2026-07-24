import {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import {
  Stack,
  usePathname,
} from "expo-router";

import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  StatusBar,
} from "expo-status-bar";

import AdminSidebar from
  "../src/components/AdminSidebar.js";

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

function isAdministrationPage(
  pathname
) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/stock") ||
    pathname.startsWith(
      "/categories"
    ) ||
    pathname.startsWith(
      "/suppliers"
    ) ||
    pathname.startsWith(
      "/administration"
    )
  );
}

export default function RootLayout() {
  const pathname = usePathname();
  const { width } =
    useWindowDimensions();

  const [isMenuOpen, setIsMenuOpen] =
    useState(false);

  const isMobile = width < 900;

  const isInitializing =
    useAuthStore(
      (state) =>
        state.isInitializing
    );

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

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

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

  const showSidebar =
    Boolean(session) &&
    adminMembership?.status ===
      "approved" &&
    Boolean(companySessionId) &&
    isAdministrationPage(pathname);

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

        <View style={styles.appShell}>
          {showSidebar &&
          !isMobile ? (
            <AdminSidebar />
          ) : null}

          <View style={styles.mainColumn}>
            {showSidebar &&
            isMobile ? (
              <View
                style={styles.mobileHeader}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ouvrir le menu"
                  style={({ pressed }) => [
                    styles.menuButton,
                    pressed &&
                      styles.menuButtonPressed,
                  ]}
                  onPress={() =>
                    setIsMenuOpen(true)
                  }
                >
                  <Text
                    style={
                      styles.menuButtonIcon
                    }
                  >
                    ☰
                  </Text>
                </Pressable>

                <Image
                  source={require(
                    "../assets/jde-logo.png"
                  )}
                  style={
                    styles.mobileLogo
                  }
                  resizeMode="contain"
                />

                <Text
                  style={
                    styles.mobileHeaderTitle
                  }
                  numberOfLines={1}
                >
                  Gestion de la boutique
                </Text>
              </View>
            ) : null}

            <View
              style={styles.pageContent}
            >
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: {
                  backgroundColor:
                    colors.background,
                },
              }}
            />
            </View>
          </View>

          {showSidebar &&
          isMobile &&
          isMenuOpen ? (
            <View
              style={styles.drawerLayer}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer le menu"
                style={styles.backdrop}
                onPress={() =>
                  setIsMenuOpen(false)
                }
              />

              <View
                style={styles.drawer}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Fermer le menu"
                  style={
                    styles.closeButton
                  }
                  onPress={() =>
                    setIsMenuOpen(false)
                  }
                >
                  <Text
                    style={
                      styles.closeButtonText
                    }
                  >
                    ×
                  </Text>
                </Pressable>

                <AdminSidebar
                  onNavigate={() =>
                    setIsMenuOpen(false)
                  }
                />
              </View>
            </View>
          ) : null}
        </View>
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

  appShell: {
    flex: 1,
    flexDirection: "row",
    backgroundColor:
      colors.background,
  },

  mainColumn: {
    flex: 1,
    minWidth: 0,
    backgroundColor:
      colors.background,
  },

  pageContent: {
    flex: 1,
    minWidth: 0,
    backgroundColor:
      colors.background,
  },

  mobileHeader: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  menuButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor:
      colors.brandBlueDark,
  },

  menuButtonPressed: {
    opacity: 0.72,
  },

  menuButtonIcon: {
    color: colors.white,
    fontSize: 23,
    fontWeight: "800",
    lineHeight: 25,
  },

  mobileLogo: {
    width: 52,
    height: 40,
  },

  mobileHeaderTitle: {
    flex: 1,
    color: colors.brandBlueDark,
    fontSize: 14,
    fontWeight: "800",
  },

  drawerLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 20,
    flexDirection: "row",
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:
      "rgba(15, 35, 45, 0.58)",
  },

  drawer: {
    width: "86%",
    maxWidth: 320,
    height: "100%",
    backgroundColor:
      colors.brandBlueDark,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 5,
      height: 0,
    },
    shadowOpacity: 0.28,
    shadowRadius: 14,
  },

  closeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 10,
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor:
      colors.brandBlueDark,
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.32)",
  },

  closeButtonText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: "400",
    lineHeight: 30,
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
