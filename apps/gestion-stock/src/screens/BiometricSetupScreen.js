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
  View,
} from "react-native";

import {
  enrollBiometricAccess,
  getBiometricCapabilities,
  ignoreBiometricEnrollment,
} from "../services/biometricService.js";

import { colors } from
  "../theme/colors.js";

export default function BiometricSetupScreen({
  userId,
  onCompleted,
}) {
  const [label, setLabel] =
    useState("biométrie");

  const [isSaving, setIsSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    getBiometricCapabilities()
      .then((capabilities) => {
        setLabel(capabilities.label);
      })
      .catch(() => {});
  }, []);

  async function enable() {
    setIsSaving(true);
    setErrorMessage("");

    try {
      await enrollBiometricAccess(
        userId
      );

      onCompleted?.();
    } catch (error) {
      console.error(
        "Biometric enrollment error:",
        error
      );

      setErrorMessage(
        error?.message ||
          "Impossible d’activer la biométrie."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function ignore() {
    setIsSaving(true);

    try {
      await ignoreBiometricEnrollment(
        userId
      );

      onCompleted?.();
    } finally {
      setIsSaving(false);
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

        <Text style={styles.title}>
          Accès plus rapide
        </Text>

        <Text style={styles.subtitle}>
          Souhaitez-vous utiliser votre{" "}
          {label} à la place du mot de
          passe entreprise lors de vos
          prochaines ouvertures ?
        </Text>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Le mot de passe entreprise
            n’est jamais enregistré sur le
            téléphone. Une déconnexion ou
            le retrait de votre accès
            désactivera automatiquement la
            biométrie.
          </Text>
        </View>

        {errorMessage ? (
          <Text style={styles.errorText}>
            {errorMessage}
          </Text>
        ) : null}

        <Pressable
          style={styles.primaryButton}
          onPress={enable}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator
              color={colors.white}
            />
          ) : (
            <Text
              style={
                styles.primaryButtonText
              }
            >
              Activer {label}
            </Text>
          )}
        </Pressable>

        <Pressable
          style={styles.ignoreButton}
          onPress={ignore}
          disabled={isSaving}
        >
          <Text style={styles.ignoreText}>
            Ignorer pour le moment
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
    maxWidth: 480,
    alignItems: "center",
    padding: 28,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  logo: {
    width: 190,
    height: 110,
  },

  title: {
    marginTop: 12,
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },

  subtitle: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
  },

  notice: {
    width: "100%",
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    backgroundColor:
      colors.surfaceMuted,
  },

  noticeText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
  },

  errorText: {
    marginTop: 16,
    color: colors.danger,
    textAlign: "center",
  },

  primaryButton: {
    width: "100%",
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor:
      colors.brandBlueDark,
  },

  primaryButtonText: {
    color: colors.white,
    fontWeight: "900",
    textAlign: "center",
  },

  ignoreButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    paddingHorizontal: 16,
  },

  ignoreText: {
    color: colors.textMuted,
    fontWeight: "700",
  },
});
