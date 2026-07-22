import { useState } from "react";

import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  getAdminAccessStatus,
  requestAdminAccess,
  signOut,
} from "../services/authService.js";

import { colors } from
  "../theme/colors.js";

export default function AccessStatusScreen({
  membership,
  onStatusChanged,
  onSignedOut,
}) {
  const [isLoading, setIsLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const status =
    membership?.status ?? "none";

  async function refreshStatus() {
    setIsLoading(true);
    setMessage("");

    try {
      const result =
        await getAdminAccessStatus();

      onStatusChanged?.(
        result.membership
      );
    } catch (error) {
      console.error(
        "Status refresh error:",
        error
      );

      setMessage(
        "Impossible d’actualiser votre statut."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function submitRequest() {
    setIsLoading(true);
    setMessage("");

    try {
      await requestAdminAccess();

      const result =
        await getAdminAccessStatus();

      onStatusChanged?.(
        result.membership
      );

      setMessage(
        "Votre demande d’accès a été envoyée."
      );
    } catch (error) {
      console.error(
        "Access request error:",
        error
      );

      setMessage(
        "Impossible d’envoyer la demande d’accès."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignOut() {
    setIsLoading(true);

    try {
      await signOut();
      onSignedOut?.();
    } catch (error) {
      console.error(
        "Sign out error:",
        error
      );

      setMessage(
        "Impossible de fermer la session."
      );

      setIsLoading(false);
    }
  }

  const content = {
    none: {
      title: "Accès administratif requis",
      description:
        "Votre compte est connecté, mais aucune demande d’accès à la gestion du stock n’a encore été enregistrée.",
      action: "Demander l’accès",
      actionHandler: submitRequest,
      color: colors.info,
      background: colors.infoLight,
    },

    pending: {
      title: "Demande en attente",
      description:
        "Votre demande a bien été enregistrée. Un propriétaire ou un administrateur doit encore l’approuver.",
      action: "Actualiser le statut",
      actionHandler: refreshStatus,
      color: colors.warning,
      background: colors.warningLight,
    },

    rejected: {
      title: "Accès refusé",
      description:
        "Votre demande d’accès administratif n’a pas été approuvée. Contactez un propriétaire de JDE pour plus d’informations.",
      action: "Actualiser le statut",
      actionHandler: refreshStatus,
      color: colors.danger,
      background: colors.dangerLight,
    },
  }[status] ?? {
    title: "Accès indisponible",
    description:
      "Le statut de votre accès administratif n’est pas reconnu.",
    action: "Actualiser le statut",
    actionHandler: refreshStatus,
    color: colors.warning,
    background: colors.warningLight,
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.scrollContent
      }
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

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                content.background,
              borderColor:
                content.color,
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  content.color,
              },
            ]}
          />

          <Text
            style={[
              styles.statusBadgeText,
              {
                color: content.color,
              },
            ]}
          >
            {status === "pending"
              ? "EN ATTENTE"
              : status === "rejected"
                ? "REFUSÉ"
                : "NON CONFIGURÉ"}
          </Text>
        </View>

        <Text style={styles.title}>
          {content.title}
        </Text>

        <Text style={styles.description}>
          {content.description}
        </Text>

        {membership?.role ? (
          <View style={styles.detailBox}>
            <Text
              style={styles.detailLabel}
            >
              Rôle demandé
            </Text>

            <Text
              style={styles.detailValue}
            >
              {membership.role}
            </Text>
          </View>
        ) : null}

        {message ? (
          <View style={styles.messageBox}>
            <Text
              style={styles.messageText}
            >
              {message}
            </Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor:
                content.color,
            },
            pressed &&
              styles.buttonPressed,
            isLoading &&
              styles.buttonDisabled,
          ]}
          onPress={content.actionHandler}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator
              color={colors.white}
            />
          ) : (
            <Text
              style={
                styles.primaryButtonText
              }
            >
              {content.action}
            </Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed &&
              styles.buttonPressed,
          ]}
          onPress={handleSignOut}
          disabled={isLoading}
        >
          <Text
            style={
              styles.secondaryButtonText
            }
          >
            Se déconnecter
          </Text>
        </Pressable>
      </View>
    </ScrollView>
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
    height: 145,
    marginBottom: 18,
  },

  statusBadge: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  statusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.7,
  },

  title: {
    marginTop: 20,
    color: colors.primaryDark,
    fontSize: 27,
    fontWeight: "700",
    textAlign: "center",
  },

  description: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
  },

  detailBox: {
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    backgroundColor:
      colors.surfaceMuted,
  },

  detailLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },

  detailValue: {
    marginTop: 3,
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    textTransform: "capitalize",
  },

  messageBox: {
    marginTop: 18,
    padding: 13,
    borderRadius: 12,
    backgroundColor: colors.infoLight,
  },

  messageText: {
    color: colors.info,
    fontSize: 14,
    lineHeight: 20,
  },

  primaryButton: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    borderRadius: 12,
  },

  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
  },

  secondaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },

  secondaryButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "700",
  },

  buttonPressed: {
    opacity: 0.86,
  },

  buttonDisabled: {
    opacity: 0.65,
  },
});
