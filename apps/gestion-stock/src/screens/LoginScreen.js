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

import { signIn } from
  "../services/authService.js";

import { colors } from
  "../theme/colors.js";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(
      1,
      "L’adresse e-mail est obligatoire"
    )
    .email(
      "L’adresse e-mail est invalide"
    ),

  password: z
    .string()
    .min(
      1,
      "Le mot de passe est obligatoire"
    ),
});

export default function LoginScreen({
  onAuthenticated,
}) {
  const [showPassword, setShowPassword] =
    useState(false);

  const [requestError, setRequestError] =
    useState("");

  const {
    control,
    handleSubmit,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function submitLogin(values) {
    setRequestError("");

    try {
      const result = await signIn(
        values.email,
        values.password
      );

      onAuthenticated?.(result);
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      const message =
        error?.message?.toLowerCase();

      if (
        message?.includes(
          "invalid login credentials"
        )
      ) {
        setRequestError(
          "Adresse e-mail ou mot de passe incorrect."
        );

        return;
      }

      if (
        message?.includes(
          "email not confirmed"
        )
      ) {
        setRequestError(
          "Votre adresse e-mail n’est pas encore confirmée."
        );

        return;
      }

      setRequestError(
        "Connexion impossible. Vérifiez votre connexion Internet puis réessayez."
      );
    }
  }

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

          <View style={styles.heading}>
            <Text style={styles.title}>
              Gestion de stock
            </Text>

            <Text style={styles.subtitle}>
              Connectez-vous à votre espace
              administratif sécurisé.
            </Text>
          </View>

          {requestError ? (
            <View style={styles.errorBox}>
              <Text
                style={styles.errorBoxText}
              >
                {requestError}
              </Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>
                Adresse e-mail
              </Text>

              <Controller
                control={control}
                name="email"
                render={({
                  field: {
                    onChange,
                    onBlur,
                    value,
                  },
                }) => (
                  <TextInput
                    style={[
                      styles.input,
                      errors.email &&
                        styles.inputError,
                    ]}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="nom@exemple.com"
                    placeholderTextColor={
                      colors.textMuted
                    }
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    editable={!isSubmitting}
                  />
                )}
              />

              {errors.email ? (
                <Text
                  style={
                    styles.fieldError
                  }
                >
                  {errors.email.message}
                </Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                Mot de passe
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
                      placeholder="Votre mot de passe"
                      placeholderTextColor={
                        colors.textMuted
                      }
                      secureTextEntry={
                        !showPassword
                      }
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="password"
                      editable={
                        !isSubmitting
                      }
                      onSubmitEditing={
                        handleSubmit(
                          submitLogin
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
                  disabled={isSubmitting}
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
                  style={
                    styles.fieldError
                  }
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
                isSubmitting &&
                  styles.buttonDisabled,
              ]}
              onPress={handleSubmit(
                submitLogin
              )}
              disabled={isSubmitting}
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
                  Se connecter
                </Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.securityText}>
            Accès réservé aux membres
            autorisés de JDE.
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
    height: 190,
    marginBottom: 8,
  },

  heading: {
    alignItems: "center",
    marginBottom: 26,
  },

  title: {
    color: colors.primaryDark,
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },

  subtitle: {
    maxWidth: 340,
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },

  errorBox: {
    marginBottom: 18,
    padding: 13,
    borderRadius: 12,
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.danger,
  },

  errorBoxText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },

  form: {
    gap: 18,
  },

  field: {
    gap: 7,
  },

  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },

  input: {
    minHeight: 52,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor:
      colors.inputBackground,
    color: colors.text,
    fontSize: 16,
    outlineStyle: "none",
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
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },

  submitButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: "700",
  },

  buttonPressed: {
    opacity: 0.88,
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  securityText: {
    marginTop: 22,
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
  },
});
