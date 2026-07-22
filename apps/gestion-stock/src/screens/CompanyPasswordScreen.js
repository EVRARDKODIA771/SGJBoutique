import { useState } from "react";

import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  Controller,
  useForm,
} from "react-hook-form";

import { zodResolver } from
  "@hookform/resolvers/zod";

import { z } from "zod";

import {
  signOut,
  verifyCompanyPassword,
} from "../services/authService.js";

import { colors } from
  "../theme/colors.js";

const companyPasswordSchema = z.object({
  password: z
    .string()
    .min(
      1,
      "Le mot de passe entreprise est obligatoire"
    ),
});

export default function CompanyPasswordScreen({
  userEmail,
  onVerified,
  onSignedOut,
}) {
  const [showPassword, setShowPassword] =
    useState(false);

  const [requestError, setRequestError] =
    useState("");

  const [isSigningOut, setIsSigningOut] =
    useState(false);

  const {
    control,
    handleSubmit,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm({
    resolver: zodResolver(
      companyPasswordSchema
    ),
    defaultValues: {
      password: "",
    },
  });

  async function submitPassword(values) {
    setRequestError("");

    try {
      const result =
        await verifyCompanyPassword(
          values.password
        );

      onVerified?.(result);
    } catch (error) {
      console.error(
        "Company password error:",
        error
      );

      if (
        error?.status === 403 ||
        error?.message
          ?.toLowerCase()
          .includes("password")
      ) {
        setRequestError(
          "Le mot de passe entreprise est incorrect ou l’accès a été refusé."
        );

        return;
      }

      setRequestError(
        "Impossible de vérifier le mot de passe entreprise. Réessayez."
      );
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    setRequestError("");

    try {
      await signOut();
      onSignedOut?.();
    } catch (error) {
      console.error(
        "Sign out error:",
        error
      );

      setRequestError(
        "Impossible de fermer complètement la session."
      );
    } finally {
      setIsSigningOut(false);
    }
  }

  const isBusy =
    isSubmitting || isSigningOut;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Image
            source={require(
              "../../assets/jde-logo.png"
            )}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Logo JDE Parfum d’Exception"
          />

          <View style={styles.lockBadge}>
            <Text style={styles.lockSymbol}>
              JDE
            </Text>
          </View>

          <Text style={styles.title}>
            Sécurité entreprise
          </Text>

          <Text style={styles.subtitle}>
            Saisissez le mot de passe
            supplémentaire de l’entreprise
            pour accéder à la gestion du
            stock.
          </Text>

          {userEmail ? (
            <View style={styles.accountBox}>
              <Text
                style={
                  styles.accountLabel
                }
              >
                Compte connecté
              </Text>

              <Text
                style={
                  styles.accountEmail
                }
                numberOfLines={1}
              >
                {userEmail}
              </Text>
            </View>
          ) : null}

          {requestError ? (
            <View style={styles.errorBox}>
              <Text
                style={styles.errorText}
              >
                {requestError}
              </Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>
              Mot de passe entreprise
            </Text>

            <View
              style={[
                styles.passwordContainer,
                errors.password &&
                  styles.inputError,
              ]}
            >
              <Controller
                control={control}
                name="password"
                render={({
                  field: {
                    onChange,
                    onBlur,
                    value,
                  },
                }) => (
                  <TextInput
                    style={
                      styles.passwordInput
                    }
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Mot de passe de l’entreprise"
                    placeholderTextColor={
                      colors.textMuted
                    }
                    secureTextEntry={
                      !showPassword
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isBusy}
                    onSubmitEditing={
                      handleSubmit(
                        submitPassword
                      )
                    }
                  />
                )}
              />

              <Pressable
                onPress={() =>
                  setShowPassword(
                    (current) =>
                      !current
                  )
                }
                disabled={isBusy}
                hitSlop={8}
              >
                <Text
                  style={
                    styles.passwordAction
                  }
                >
                  {showPassword
                    ? "Masquer"
                    : "Afficher"}
                </Text>
              </Pressable>
            </View>

            {errors.password ? (
              <Text
                style={styles.fieldError}
              >
                {errors.password.message}
              </Text>
            ) : null}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              pressed &&
                styles.buttonPressed,
              isBusy &&
                styles.buttonDisabled,
            ]}
            onPress={handleSubmit(
              submitPassword
            )}
            disabled={isBusy}
          >
            {isSubmitting ? (
              <ActivityIndicator
                color={
                  colors.textOnPrimary
                }
              />
            ) : (
              <Text
                style={
                  styles.submitButtonText
                }
              >
                Déverrouiller l’espace
              </Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.signOutButton,
              pressed &&
                styles.buttonPressed,
            ]}
            onPress={handleSignOut}
            disabled={isBusy}
          >
            {isSigningOut ? (
              <ActivityIndicator
                color={colors.primary}
              />
            ) : (
              <Text
                style={
                  styles.signOutButtonText
                }
              >
                Utiliser un autre compte
              </Text>
            )}
          </Pressable>

          <Text style={styles.securityText}>
            Cette session entreprise ne sera
            pas conservée après la fermeture
            complète de l’application.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 36,
  },

  card: {
    width: "100%",
    maxWidth: 470,
    paddingHorizontal: 28,
    paddingVertical: 30,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,

    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 5,
  },

  logo: {
    alignSelf: "center",
    width: "100%",
    height: 125,
    marginBottom: 12,
  },

  lockBadge: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    width: 62,
    height: 62,
    marginBottom: 16,
    borderRadius: 31,
    backgroundColor:
      colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.secondary,
  },

  lockSymbol: {
    color: colors.primaryDark,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 1,
  },

  title: {
    color: colors.primaryDark,
    fontSize: 27,
    fontWeight: "700",
    textAlign: "center",
  },

  subtitle: {
    marginTop: 9,
    marginBottom: 20,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },

  accountBox: {
    marginBottom: 18,
    padding: 13,
    borderRadius: 12,
    backgroundColor:
      colors.surfaceMuted,
  },

  accountLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },

  accountEmail: {
    marginTop: 3,
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },

  errorBox: {
    marginBottom: 18,
    padding: 13,
    borderRadius: 12,
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.danger,
  },

  errorText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },

  field: {
    gap: 7,
  },

  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },

  passwordContainer: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor:
      colors.inputBackground,
  },

  passwordInput: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 15,
    color: colors.text,
    fontSize: 16,
    outlineStyle: "none",
  },

  passwordAction: {
    paddingHorizontal: 14,
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },

  inputError: {
    borderColor: colors.danger,
  },

  fieldError: {
    color: colors.danger,
    fontSize: 13,
  },

  submitButton: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },

  submitButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: "700",
  },

  signOutButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },

  signOutButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "700",
  },

  securityText: {
    marginTop: 20,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },

  buttonPressed: {
    opacity: 0.86,
  },

  buttonDisabled: {
    opacity: 0.65,
  },
});
