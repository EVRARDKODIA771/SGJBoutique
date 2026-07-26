import {
  supabaseAdmin,
} from "../lib/supabaseAdmin.js";

const EXPO_PUSH_URL =
  "https://exp.host/--/api/v2/push/send";

const MAX_EXPO_BATCH_SIZE = 100;

function splitIntoBatches(
  values,
  batchSize
) {
  const batches = [];

  for (
    let index = 0;
    index < values.length;
    index += batchSize
  ) {
    batches.push(
      values.slice(
        index,
        index + batchSize
      )
    );
  }

  return batches;
}

export async function getUserDisplayLabel(
  userId,
  {
    preferEmail = false,
  } = {}
) {
  if (!userId) {
    return "Un utilisateur";
  }

  const [
    staffResult,
    profileResult,
    authResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("staff_profiles")
      .select(
        "display_name, staff_code"
      )
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),

    supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle(),

    supabaseAdmin.auth.admin
      .getUserById(userId),
  ]);

  const email =
    authResult.data?.user?.email ??
    null;

  if (preferEmail && email) {
    return email;
  }

  return (
    staffResult.data?.staff_code ||
    staffResult.data?.display_name ||
    profileResult.data?.full_name ||
    email ||
    "Un utilisateur"
  );
}

export async function getUserEmail(
  userId
) {
  if (!userId) {
    return null;
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin.auth.admin
      .getUserById(userId);

  if (error) {
    throw error;
  }

  return data?.user?.email ?? null;
}

async function getApprovedRecipientIds(
  excludedUserIds
) {
  const excluded = new Set(
    excludedUserIds.filter(Boolean)
  );

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("admin_memberships")
    .select("user_id")
    .eq("status", "approved");

  if (error) {
    throw error;
  }

  return [
    ...new Set(
      (data ?? [])
        .map(
          (membership) =>
            membership.user_id
        )
        .filter(
          (userId) =>
            userId &&
            !excluded.has(userId)
        )
    ),
  ];
}

async function markDeliveryResult(
  delivery,
  ticket
) {
  const isSuccessful =
    ticket?.status === "ok";

  const errorCode =
    ticket?.details?.error ?? null;

  const invalidToken =
    [
      "DeviceNotRegistered",
      "InvalidCredentials",
    ].includes(errorCode);

  const {
    error,
  } = await supabaseAdmin
    .from("push_deliveries")
    .update({
      status: isSuccessful
        ? "sent"
        : invalidToken
          ? "invalid_token"
          : "failed",
      expo_ticket_id:
        ticket?.id ?? null,
      error_code: errorCode,
      error_message:
        ticket?.message ?? null,
      attempt_count:
        delivery.attempt_count + 1,
      last_attempt_at:
        new Date().toISOString(),
      sent_at: isSuccessful
        ? new Date().toISOString()
        : null,
    })
    .eq("id", delivery.id);

  if (error) {
    console.error(
      "Push delivery update error:",
      error
    );
  }

  if (invalidToken) {
    const {
      error: deviceError,
    } = await supabaseAdmin
      .from("push_devices")
      .update({
        is_active: false,
      })
      .eq(
        "id",
        delivery.push_device_id
      );

    if (deviceError) {
      console.error(
        "Invalid push device deactivation error:",
        deviceError
      );
    }
  }
}

async function sendPendingDeliveries(
  notification,
  deliveries
) {
  const batches = splitIntoBatches(
    deliveries,
    MAX_EXPO_BATCH_SIZE
  );

  for (const batch of batches) {
    const messages = batch.map(
      (delivery) => ({
        to:
          delivery.device
            .expo_push_token,
        sound: "default",
        channelId: "jde-parfum",
        title: notification.title,
        body: notification.body,
        priority: "high",
        data: {
          notificationId:
            notification.id,
          eventType:
            notification.event_type,
          route: notification.route,
          ...notification.data,
        },
      })
    );

    try {
      const response = await fetch(
        EXPO_PUSH_URL,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-Encoding":
              "gzip, deflate",
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(messages),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Expo push service returned ${response.status}`
        );
      }

      const result =
        await response.json();

      const tickets =
        Array.isArray(result.data)
          ? result.data
          : [];

      await Promise.all(
        batch.map(
          (delivery, index) =>
            markDeliveryResult(
              delivery,
              tickets[index] ?? {
                status: "error",
                message:
                  "Expo ticket missing",
              }
            )
        )
      );
    } catch (error) {
      console.error(
        "Expo push sending error:",
        error
      );

      await Promise.all(
        batch.map((delivery) =>
          markDeliveryResult(
            delivery,
            {
              status: "error",
              message: error.message,
            }
          )
        )
      );
    }
  }
}

export async function sendBusinessNotification({
  eventType,
  title,
  body,
  route,
  actorUserId = null,
  subjectUserId = null,
  productId = null,
  data = {},
  excludeUserIds = [],
}) {
  const recipientIds =
    await getApprovedRecipientIds(
      excludeUserIds
    );

  if (recipientIds.length === 0) {
    return {
      notification: null,
      recipientCount: 0,
      deviceCount: 0,
    };
  }

  const {
    data: notification,
    error: notificationError,
  } = await supabaseAdmin
    .from("notifications")
    .insert({
      event_type: eventType,
      title,
      body,
      route,
      actor_user_id:
        actorUserId,
      subject_user_id:
        subjectUserId,
      product_id: productId,
      data,
    })
    .select("*")
    .single();

  if (notificationError) {
    throw notificationError;
  }

  const recipients =
    recipientIds.map((userId) => ({
      notification_id:
        notification.id,
      user_id: userId,
    }));

  const {
    error: recipientError,
  } = await supabaseAdmin
    .from("notification_recipients")
    .insert(recipients);

  if (recipientError) {
    await supabaseAdmin
      .from("notifications")
      .delete()
      .eq("id", notification.id);

    throw recipientError;
  }

  const {
    data: devices,
    error: devicesError,
  } = await supabaseAdmin
    .from("push_devices")
    .select(
      "id, user_id, expo_push_token"
    )
    .in("user_id", recipientIds)
    .eq("is_active", true);

  if (devicesError) {
    throw devicesError;
  }

  if (!devices?.length) {
    return {
      notification,
      recipientCount:
        recipientIds.length,
      deviceCount: 0,
    };
  }

  const {
    data: createdDeliveries,
    error: deliveriesError,
  } = await supabaseAdmin
    .from("push_deliveries")
    .insert(
      devices.map((device) => ({
        notification_id:
          notification.id,
        user_id: device.user_id,
        push_device_id: device.id,
      }))
    )
    .select(
      "id, push_device_id, attempt_count"
    );

  if (deliveriesError) {
    throw deliveriesError;
  }

  const devicesById = new Map(
    devices.map((device) => [
      device.id,
      device,
    ])
  );

  const deliveries =
    (createdDeliveries ?? []).map(
      (delivery) => ({
        ...delivery,
        device:
          devicesById.get(
            delivery.push_device_id
          ),
      })
    );

  await sendPendingDeliveries(
    notification,
    deliveries
  );

  return {
    notification,
    recipientCount:
      recipientIds.length,
    deviceCount: devices.length,
  };
}

export async function notifySafely(
  notification
) {
  try {
    return await sendBusinessNotification(
      notification
    );
  } catch (error) {
    console.error(
      "Business notification error:",
      notification.eventType,
      error
    );

    return null;
  }
}
