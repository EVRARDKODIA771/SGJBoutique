import { useState } from "react";

import {
  ActivityIndicator,
  Alert,
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
  signUp,
} from "../services/authService.js";

import { colors } from
  "../theme/colors.js";

const signupSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(
        2,
        "Votre nom est obligatoire"
      )
      .max(100),
    email: z
      .string()
      .trim()
      .email(
        "L’adresse e-mail est invalide"
      ),
    password: z
      .string()
      .min(
        8,
        "Utilisez au moins 8 caractères"
      ),
    confirmation: z.string(),
  })
  .refine(
    (values) =>
      values.password ===
      values.confirmation,
    {
      path: ["confirmation"],
      message:
        "Les mots de passe ne correspondent pas",
    }
  );

export default function SignupScreen({
  onBack,
  onRegistered,
}) {
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
    resolver:
      zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmation: "",
    },
  });

  async function submit(values) {
    setRequestError("");

    try {
      const result = await signUp({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
      });

      if (!result.session) {
        Alert.alert(
          "Compte créé",
          "Consultez votre boîte e-mail pour confirmer votre inscription, puis connectez-vous."
        );
      }

      onRegistered?.({
        hasSession:
          Boolean(result.session),
      });
    } catch (error) {
      const message =
        error?.message ?? "";

      setRequestError(
        message
          .toLowerCase()
          .includes(
            "already registered"
          )
          ? "Cette adresse e-mail possède déjà un compte."
          : message ||
              "Inscription impossible."
      );
    }
  }

  const fields = [
    {
      name: "fullName",
      label: "Nom complet",
      placeholder:
        "Votre nom et prénom",
      autoComplete: "name",
    },
    {
      name: "email",
      label: "Adresse e-mail",
      placeholder:
        "nom@exemple.com",
      autoComplete: "email",
      keyboardType:
        "email-address",
      autoCapitalize: "none",
    },
    {
      name: "password",
      label: "Créer un mot de passe",
      placeholder:
        "Au moins 8 caractères",
      secureTextEntry: true,
      autoComplete: "new-password",
      autoCapitalize: "none",
    },
    {
      name: "confirmation",
      label:
        "Confirmer le mot de passe",
      placeholder:
        "Répétez le mot de passe",
      secureTextEntry: true,
      autoComplete: "new-password",
      autoCapitalize: "none",
    },
  ];

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
          styles.content
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
          />

          <Text style={styles.title}>
            Créer un compte
          </Text>

          <Text style={styles.subtitle}>
            Votre nom servira à proposer
            votre code métier et votre
            préfixe SKU.
          </Text>

          {requestError ? (
            <Text
              style={styles.errorBox}
            >
              {requestError}
            </Text>
          ) : null}

          {fields.map((field) => (
            <View
              key={field.name}
              style={styles.field}
            >
              <Text style={styles.label}>
                {field.label}
              </Text>

              <Controller
                control={control}
                name={field.name}
                render={({
                  field: {
                    value,
                    onChange,
                    onBlur,
                  },
                }) => (
                  <TextInput
                    style={[
                      styles.input,
                      errors[field.name] &&
                        styles.inputError,
                    ]}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder={
                      field.placeholder
                    }
                    placeholderTextColor={
                      colors.textMuted
                    }
                    keyboardType={
                      field.keyboardType
                    }
                    autoCapitalize={
                      field.autoCapitalize ??
                      "words"
                    }
                    autoComplete={
                      field.autoComplete
                    }
                    secureTextEntry={
                      field.secureTextEntry
                    }
                    editable={
                      !isSubmitting
                    }
                  />
                )}
              />

              {errors[field.name] ? (
                <Text
                  style={
                    styles.fieldError
                  }
                >
                  {
                    errors[field.name]
                      .message
                  }
                </Text>
              ) : null}
            </View>
          ))}

          <Pressable
            style={styles.primaryButton}
            disabled={isSubmitting}
            onPress={handleSubmit(submit)}
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
                  styles.primaryButtonText
                }
              >
                S’inscrire
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.backButton}
            onPress={onBack}
            disabled={isSubmitting}
          >
            <Text
              style={styles.backButtonText}
            >
              J’ai déjà un compte
            </Text>
          </Pressable>
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
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 470,
    padding: 28,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  logo: {
    alignSelf: "center",
    width: "100%",
    height: 130,
  },
  title: {
    color: colors.primaryDark,
    fontSize: 27,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 22,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  field: {
    marginBottom: 15,
  },
  label: {
    marginBottom: 6,
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    color: colors.text,
    backgroundColor:
      colors.inputBackground,
    outlineStyle: "none",
  },
  inputError: {
    borderColor: colors.danger,
  },
  fieldError: {
    marginTop: 5,
    color: colors.danger,
    fontSize: 12,
  },
  errorBox: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
    color: colors.danger,
    backgroundColor:
      colors.dangerLight,
  },
  primaryButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    borderRadius: 11,
    backgroundColor:
      colors.primary,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  backButton: {
    alignSelf: "center",
    marginTop: 14,
    padding: 8,
  },
  backButtonText: {
    color: colors.primary,
    fontWeight: "800",
  },
});
