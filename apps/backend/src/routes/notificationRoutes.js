import {
  Router,
} from "express";

import {
  z,
} from "zod";

import {
  supabaseAdmin,
} from "../lib/supabaseAdmin.js";

import {
  authenticateUser,
} from "../middleware/authenticateUser.js";

import {
  requireApprovedAdmin,
} from "../middleware/requireApprovedAdmin.js";

import {
  requireCompanySession,
} from "../middleware/requireCompanySession.js";

import { env } from "../config/env.js";

const router = Router();

router.use(
  authenticateUser,
  requireApprovedAdmin(),
  requireCompanySession
);

router.get("/web-push/public-key", (request, response) => {
  if (!env.VAPID_PUBLIC_KEY) {
    return response.status(503).json({
      success: false,
      error: "Web Push is not configured",
    });
  }

  return response.status(200).json({
    success: true,
    publicKey: env.VAPID_PUBLIC_KEY,
  });
});

router.post("/web-push/subscriptions", async (request, response) => {
  try {
    const validation = z.object({
      endpoint: z.string().url().max(2000),
      expirationTime: z.number().nullable().optional(),
      keys: z.object({
        p256dh: z.string().min(1).max(500),
        auth: z.string().min(1).max(500),
      }),
      userAgent: z.string().max(500).nullable().optional(),
    }).safeParse(request.body);

    if (!validation.success) {
      return response.status(400).json({
        success: false,
        error: "Invalid Web Push subscription",
      });
    }

    const subscription = validation.data;
    const { data, error } = await supabaseAdmin
      .from("web_push_subscriptions")
      .upsert({
        user_id: request.auth.user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        expiration_time: subscription.expirationTime
          ? new Date(subscription.expirationTime).toISOString()
          : null,
        user_agent: subscription.userAgent ?? null,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: "endpoint" })
      .select("id, last_seen_at")
      .single();

    if (error) throw error;

    return response.status(200).json({ success: true, subscription: data });
  } catch (error) {
    console.error("Web Push subscription error:", error);
    return response.status(500).json({
      success: false,
      error: "Unable to register this browser",
    });
  }
});

router.post(
  "/devices",
  async (request, response) => {
    try {
      const schema = z.object({
        expoPushToken: z
          .string()
          .trim()
          .min(1)
          .max(300),

        platform: z.enum([
          "android",
          "ios",
        ]),

        deviceName: z
          .string()
          .trim()
          .max(150)
          .nullable()
          .optional(),

        appVersion: z
          .string()
          .trim()
          .max(50)
          .nullable()
          .optional(),
      });

      const validation =
        schema.safeParse(
          request.body
        );

      if (!validation.success) {
        return response.status(400).json({
          success: false,
          error:
            "Invalid push device data",
          details:
            validation.error.flatten(),
        });
      }

      const device = validation.data;

      const {
        data,
        error,
      } = await request.auth.supabase.rpc(
        "register_my_push_device",
        {
          supplied_expo_push_token:
            device.expoPushToken,
          supplied_platform:
            device.platform,
          supplied_device_name:
            device.deviceName ?? null,
          supplied_app_version:
            device.appVersion ?? null,
        }
      );

      if (error) {
        throw error;
      }

      return response.status(200).json({
        success: true,
        device: data,
      });
    } catch (error) {
      console.error(
        "Push device registration error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to register this device",
      });
    }
  }
);

router.delete(
  "/devices",
  async (request, response) => {
    try {
      const schema = z.object({
        expoPushToken: z
          .string()
          .trim()
          .min(1)
          .max(300),
      });

      const validation =
        schema.safeParse(
          request.body
        );

      if (!validation.success) {
        return response.status(400).json({
          success: false,
          error:
            "Invalid Expo push token",
        });
      }

      const {
        data,
        error,
      } = await request.auth.supabase.rpc(
        "unregister_my_push_device",
        {
          supplied_expo_push_token:
            validation.data
              .expoPushToken,
        }
      );

      if (error) {
        throw error;
      }

      return response.status(200).json({
        success: true,
        removed: data,
      });
    } catch (error) {
      console.error(
        "Push device removal error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to unregister this device",
      });
    }
  }
);

router.get(
  "/",
  async (request, response) => {
    try {
      const schema = z.object({
        page: z.coerce
          .number()
          .int()
          .min(1)
          .default(1),

        limit: z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(30),
      });

      const validation =
        schema.safeParse(
          request.query
        );

      if (!validation.success) {
        return response.status(400).json({
          success: false,
          error:
            "Invalid notification query parameters",
        });
      }

      const {
        page,
        limit,
      } = validation.data;

      const start =
        (page - 1) * limit;

      const end =
        start + limit - 1;

      const {
        data,
        error,
        count,
      } = await supabaseAdmin
        .from(
          "notification_recipients"
        )
        .select(
          `
            read_at,
            opened_at,
            created_at,
            notification:notifications (
              id,
              event_type,
              title,
              body,
              route,
              data,
              created_at
            )
          `,
          {
            count: "exact",
          }
        )
        .eq(
          "user_id",
          request.auth.user.id
        )
        .order("created_at", {
          ascending: false,
        })
        .range(start, end);

      if (error) {
        throw error;
      }

      return response.status(200).json({
        success: true,
        notifications:
          (data ?? []).map(
            (recipient) => ({
              ...recipient.notification,
              readAt:
                recipient.read_at,
              openedAt:
                recipient.opened_at,
            })
          ),
        pagination: {
          page,
          limit,
          total: count ?? 0,
          totalPages: Math.ceil(
            (count ?? 0) / limit
          ),
        },
      });
    } catch (error) {
      console.error(
        "Notifications listing error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to retrieve notifications",
      });
    }
  }
);

router.patch(
  "/:notificationId/read",
  async (request, response) => {
    try {
      const validation = z
        .object({
          notificationId: z
            .string()
            .uuid(),
        })
        .safeParse(request.params);

      if (!validation.success) {
        return response.status(400).json({
          success: false,
          error:
            "Invalid notification ID",
        });
      }

      const {
        data,
        error,
      } = await request.auth.supabase.rpc(
        "mark_my_notification_read",
        {
          target_notification_id:
            validation.data
              .notificationId,
        }
      );

      if (error) {
        throw error;
      }

      return response.status(200).json({
        success: true,
        updated: data,
      });
    } catch (error) {
      console.error(
        "Notification reading error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to mark notification as read",
      });
    }
  }
);

export default router;
