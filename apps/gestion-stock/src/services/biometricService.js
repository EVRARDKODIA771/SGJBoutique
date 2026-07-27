import {
  Platform,
} from "react-native";

import * as Device from
  "expo-device";

import * as LocalAuthentication from
  "expo-local-authentication";

import * as SecureStore from
  "expo-secure-store";

import {
  apiRequest,
} from "../lib/api.js";

import {
  useAuthStore,
} from "../store/authStore.js";

const CREDENTIAL_PREFIX =
  "jde-biometric-credential";

const MARKER_PREFIX =
  "jde-biometric-enabled";

const IGNORED_PREFIX =
  "jde-biometric-ignored";

function buildKey(prefix, userId) {
  return `${prefix}-${userId}`;
}

function getDeviceLabel() {
  return [
    "jde-parfum",
    Platform.OS,
    Device.modelName ??
      Device.deviceName ??
      "appareil",
  ].join("-");
}

export async function getBiometricCapabilities() {
  if (Platform.OS === "web") {
    return {
      available: false,
      label: "Biométrie",
      types: [],
    };
  }

  const [
    hasHardware,
    isEnrolled,
    types,
  ] = await Promise.all([
    LocalAuthentication
      .hasHardwareAsync(),
    LocalAuthentication
      .isEnrolledAsync(),
    LocalAuthentication
      .supportedAuthenticationTypesAsync(),
  ]);

  const hasFace = types.includes(
    LocalAuthentication
      .AuthenticationType
      .FACIAL_RECOGNITION
  );

  const hasFingerprint =
    types.includes(
      LocalAuthentication
        .AuthenticationType
        .FINGERPRINT
    );

  const label =
    hasFace && hasFingerprint
      ? "empreinte ou reconnaissance faciale"
      : hasFace
        ? "reconnaissance faciale"
        : hasFingerprint
          ? "empreinte digitale"
          : "biométrie";

  return {
    available:
      hasHardware &&
      isEnrolled &&
      types.length > 0,
    label,
    types,
  };
}

export async function hasBiometricCredential(
  userId
) {
  if (!userId || Platform.OS === "web") {
    return false;
  }

  const marker =
    await SecureStore.getItemAsync(
      buildKey(
        MARKER_PREFIX,
        userId
      )
    );

  return marker === "enabled";
}

export async function shouldOfferBiometricEnrollment(
  userId
) {
  if (
    !userId ||
    Platform.OS === "web"
  ) {
    return false;
  }

  const [
    capabilities,
    hasCredential,
    ignored,
  ] = await Promise.all([
    getBiometricCapabilities(),
    hasBiometricCredential(userId),
    SecureStore.getItemAsync(
      buildKey(
        IGNORED_PREFIX,
        userId
      )
    ),
  ]);

  return (
    capabilities.available &&
    !hasCredential &&
    ignored !== "ignored"
  );
}

export async function authenticateLocally(
  label
) {
  if (Platform.OS === "web") {
    return false;
  }

  const result =
    await LocalAuthentication
      .authenticateAsync({
        promptMessage:
          "Accès à JDE Parfum",
        promptSubtitle:
          `Confirmez avec votre ${label}`,
        promptDescription:
          "Votre mot de passe entreprise ne sera pas enregistré.",
        cancelLabel: "Annuler",
        fallbackLabel: "",
        disableDeviceFallback: true,
        biometricsSecurityLevel:
          "weak",
      });

  return result.success;
}

export async function enrollBiometricAccess(
  userId
) {
  if (Platform.OS === "web") {
    throw new Error(
      "La biométrie est disponible uniquement dans l’application mobile."
    );
  }

  const capabilities =
    await getBiometricCapabilities();

  if (!capabilities.available) {
    throw new Error(
      "Aucune empreinte ou reconnaissance faciale n’est configurée sur ce téléphone."
    );
  }

  const authenticated =
    await authenticateLocally(
      capabilities.label
    );

  if (!authenticated) {
    throw new Error(
      "La vérification biométrique a été annulée ou refusée."
    );
  }

  const result = await apiRequest(
    "/api/admin/auth/biometric/enroll",
    {
      method: "POST",
      body: {
        deviceLabel:
          getDeviceLabel(),
      },
    }
  );

  await SecureStore.setItemAsync(
    buildKey(
      CREDENTIAL_PREFIX,
      userId
    ),
    JSON.stringify({
      credentialId:
        result.credentialId,
      token: result.token,
    })
  );

  await SecureStore.setItemAsync(
    buildKey(
      MARKER_PREFIX,
      userId
    ),
    "enabled"
  );

  await SecureStore.deleteItemAsync(
    buildKey(
      IGNORED_PREFIX,
      userId
    )
  );

  return capabilities;
}

export async function ignoreBiometricEnrollment(
  userId
) {
  if (
    !userId ||
    Platform.OS === "web"
  ) {
    return;
  }

  await SecureStore.setItemAsync(
    buildKey(
      IGNORED_PREFIX,
      userId
    ),
    "ignored"
  );
}

export async function unlockWithBiometrics(
  userId
) {
  if (Platform.OS === "web") {
    throw new Error(
      "La biométrie est disponible uniquement dans l’application mobile."
    );
  }

  const capabilities =
    await getBiometricCapabilities();

  if (!capabilities.available) {
    throw new Error(
      "La biométrie n’est plus disponible sur ce téléphone."
    );
  }

  const authenticated =
    await authenticateLocally(
      capabilities.label
    );

  if (!authenticated) {
    throw new Error(
      "La vérification biométrique a été annulée ou refusée."
    );
  }

  const storedCredential =
    await SecureStore.getItemAsync(
      buildKey(
        CREDENTIAL_PREFIX,
        userId
      )
    );

  if (!storedCredential) {
    await clearLocalBiometricAccess(
      userId
    );

    throw new Error(
      "L’autorisation biométrique locale est introuvable."
    );
  }

  let credential;

  try {
    credential =
      JSON.parse(storedCredential);
  } catch {
    await clearLocalBiometricAccess(
      userId
    );

    throw new Error(
      "L’autorisation biométrique locale est invalide."
    );
  }

  try {
    const result = await apiRequest(
      "/api/admin/auth/biometric/verify",
      {
        method: "POST",
        requiresCompanySession:
          false,
        body: {
          ...credential,
          deviceLabel:
            getDeviceLabel(),
        },
      }
    );

    if (!result.session_id) {
      throw new Error(
        "La session entreprise n’a pas été créée."
      );
    }

    useAuthStore
      .getState()
      .setCompanySessionId(
        result.session_id
      );

    return result;
  } catch (error) {
    if (
      error?.status === 403 ||
      error?.details
        ?.biometricCredentialRevoked
    ) {
      await clearLocalBiometricAccess(
        userId
      );
    }

    throw error;
  }
}

export async function clearLocalBiometricAccess(
  userId
) {
  if (!userId || Platform.OS === "web") {
    return;
  }

  await Promise.all([
    SecureStore.deleteItemAsync(
      buildKey(
        CREDENTIAL_PREFIX,
        userId
      )
    ),
    SecureStore.deleteItemAsync(
      buildKey(
        MARKER_PREFIX,
        userId
      )
    ),
    SecureStore.deleteItemAsync(
      buildKey(
        IGNORED_PREFIX,
        userId
      )
    ),
  ]);
}
