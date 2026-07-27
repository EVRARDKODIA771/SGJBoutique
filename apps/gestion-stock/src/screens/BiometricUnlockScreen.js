import {
  useState,
} from "react";

import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  signOut,
} from "../services/authService.js";

import {
  unlockWithBiometrics,
} from "../services/biometricService.js";

import { colors } from
  "../theme/colors.js";

export default function BiometricUnlockScreen({
  userId,
  biometricLabel,
  onUnlocked,
  onUsePassword,
  onSignedOut,
}) {
  const [isUnlocking, setIsUnlocking] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  async function unlock() {
    setIsUnlocking(true);
    setErrorMessage("");

    try {
      await unlockWithBiometrics(
        userId
      );

      onUnlocked?.();
    } catch (error) {
      console.error(
        "Biometric unlock error:",
        error
      );

      setErrorMessage(
        error?.status === 403
          ? "Cet accès biométrique a été révoqué. Saisissez de nouveau le mot de passe entreprise."
          : error?.message ||
              "La vérification biométrique a échoué."
      );

      if (error?.status === 403) {
        onUsePassword?.();
      }
    } finally {
      setIsUnlocking(false);
    }
  }

  async function handleSignOut() {
    setIsUnlocking(true);

    try {
      await signOut();
      onSignedOut?.();
    } catch (error) {
      setErrorMessage(
        "Impossible de fermer la session."
      );
      setIsUnlocking(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Image
          source={require(
            "../../assets/jde-logo.png"
          )}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.symbol}>
          <Text style={styles.symbolText}>
            ◎
          </Text>
        </View>

        <Text style={styles.title}>
          Vérification biométrique
        </Text>

        <Text style={styles.subtitle}>
          Utilisez votre{" "}
          {biometricLabel} pour accéder à
          la gestion JDE Parfum.
        </Text>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed &&
              styles.buttonPressed,
          ]}
          onPress={unlock}
          disabled={isUnlocking}
        >
          {isUnlocking ? (
            <ActivityIndicator
              color={colors.white}
            />
          ) : (
            <Text
              style={
                styles.primaryButtonText
              }
            >
              Déverrouiller
            </Text>
          )}
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={onUsePassword}
          disabled={isUnlocking}
        >
          <Text
            style={
              styles.secondaryButtonText
            }
          >
            Utiliser le mot de passe
            entreprise
          </Text>
        </Pressable>

        <Pressable
          style={styles.signOutButton}
          onPress={handleSignOut}
          disabled={isUnlocking}
        >
          <Text style={styles.signOutText}>
            Utiliser un autre compte
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor:
      colors.background,
  },

  card: {
    width: "100%",
    maxWidth: 460,
    alignItems: "center",
    padding: 28,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  logo: {
    width: 180,
    height: 100,
  },

  symbol: {
    width: 78,
    height: 78,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    borderRadius: 39,
    backgroundColor:
      colors.brandBlueDark,
  },

  symbolText: {
    color: colors.white,
    fontSize: 48,
    lineHeight: 54,
  },

  title: {
    marginTop: 22,
    color: colors.text,
    fontSize: 23,
    fontWeight: "900",
    textAlign: "center",
  },

  subtitle: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
  },

  errorBox: {
    width: "100%",
    marginTop: 18,
    padding: 12,
    borderRadius: 10,
    backgroundColor:
      colors.dangerLight,
  },

  errorText: {
    color: colors.danger,
    lineHeight: 20,
  },

  primaryButton: {
    width: "100%",
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    borderRadius: 12,
    backgroundColor:
      colors.brandBlueDark,
  },

  primaryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "900",
  },

  secondaryButton: {
    width: "100%",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  secondaryButtonText: {
    color: colors.primary,
    fontWeight: "800",
    textAlign: "center",
  },

  signOutButton: {
    marginTop: 12,
    padding: 8,
  },

  signOutText: {
    color: colors.textMuted,
    fontSize: 13,
  },

  buttonPressed: {
    opacity: 0.72,
  },
});
