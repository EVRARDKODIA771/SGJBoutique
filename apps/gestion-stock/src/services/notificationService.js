import {
  Platform,
} from "react-native";

import Constants from
  "expo-constants";

import * as Device from
  "expo-device";

import * as Notifications from
  "expo-notifications";

import {
  apiRequest,
} from "../lib/api.js";

const CHANNEL_ID = "jde-parfum";

let notificationHandlerConfigured =
  false;

function configureNotificationHandler() {
  if (
    notificationHandlerConfigured ||
    Platform.OS === "web"
  ) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  notificationHandlerConfigured =
    true;
}

function getProjectId() {
  return (
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas
      ?.projectId ??
    null
  );
}

async function configureAndroidChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications
    .setNotificationChannelAsync(
      CHANNEL_ID,
      {
        name: "Notifications JDE Parfum",
        description:
          "Ventes, stock et accès administratifs",
        importance:
          Notifications
            .AndroidImportance.MAX,
        vibrationPattern: [
          0,
          250,
          180,
          250,
        ],
        lightColor: "#6F4E37",
        sound: "default",
        lockscreenVisibility:
          Notifications
            .AndroidNotificationVisibility
            .PUBLIC,
      }
    );
}

export async function registerDeviceForPushNotifications() {
  if (
    Platform.OS === "web" ||
    !Device.isDevice
  ) {
    return null;
  }

  configureNotificationHandler();

  await configureAndroidChannel();

  const currentPermissions =
    await Notifications
      .getPermissionsAsync();

  let permissionStatus =
    currentPermissions.status;

  if (
    permissionStatus !== "granted"
  ) {
    const requestedPermissions =
      await Notifications
        .requestPermissionsAsync();

    permissionStatus =
      requestedPermissions.status;
  }

  if (
    permissionStatus !== "granted"
  ) {
    console.warn(
      "Notification permission was not granted"
    );

    return null;
  }

  const projectId = getProjectId();

  if (!projectId) {
    console.warn(
      "EAS projectId is missing. Run eas init before building the APK."
    );

    return null;
  }

  const tokenResult =
    await Notifications
      .getExpoPushTokenAsync({
        projectId,
      });

  const expoPushToken =
    tokenResult.data;

  await apiRequest(
    "/api/admin/notifications/devices",
    {
      method: "POST",
      body: {
        expoPushToken,
        platform: Platform.OS,
        deviceName:
          Device.deviceName ?? null,
        appVersion:
          Constants.expoConfig
            ?.version ?? null,
      },
    }
  );

  return expoPushToken;
}

export async function markNotificationRead(
  notificationId
) {
  if (!notificationId) {
    return;
  }

  try {
    await apiRequest(
      `/api/admin/notifications/${notificationId}/read`,
      {
        method: "PATCH",
      }
    );
  } catch (error) {
    console.warn(
      "Unable to mark notification as read:",
      error
    );
  }
}

function openNotificationResponse(
  response,
  navigate
) {
  const data =
    response?.notification?.request
      ?.content?.data ?? {};

  const route =
    typeof data.route === "string" &&
    data.route.startsWith("/")
      ? data.route
      : "/dashboard";

  navigate({
    route,
    notificationId:
      typeof data.notificationId ===
      "string"
        ? data.notificationId
        : null,
  });

  Notifications
    .clearLastNotificationResponseAsync()
    .catch(() => {});
}

export function listenForNotificationNavigation(
  navigate
) {
  if (Platform.OS === "web") {
    return () => {};
  }

  configureNotificationHandler();

  const responseSubscription =
    Notifications
      .addNotificationResponseReceivedListener(
        (response) => {
          openNotificationResponse(
            response,
            navigate
          );
        }
      );

  Notifications
    .getLastNotificationResponseAsync()
    .then((response) => {
      if (response) {
        openNotificationResponse(
          response,
          navigate
        );
      }
    })
    .catch((error) => {
      console.warn(
        "Initial notification response error:",
        error
      );
    });

  return () => {
    responseSubscription.remove();
  };
}
