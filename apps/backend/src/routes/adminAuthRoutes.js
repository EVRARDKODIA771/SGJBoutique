import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

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

import {
  getUserDisplayLabel,
  getUserEmail,
  notifySafely,
} from "../services/notificationService.js";

const router = Router();

const companyPasswordSchema = z.object({
  password: z
    .string()
    .min(
      1,
      "Company password is required"
    ),

  deviceLabel: z
    .string()
    .trim()
    .max(100)
    .optional(),
});

const newCompanyPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(
      12,
      "Company password must contain at least 12 characters"
    ),
});

const biometricCredentialSchema =
  z.object({
    credentialId: z
      .string()
      .uuid(),

    token: z
      .string()
      .min(40)
      .max(200),

    deviceLabel: z
      .string()
      .trim()
      .max(100)
      .optional(),
  });

function hashBiometricToken(token) {
  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

function biometricTokenMatches(
  storedHash,
  suppliedToken
) {
  const expected = Buffer.from(
    storedHash,
    "hex"
  );

  const supplied = Buffer.from(
    hashBiometricToken(
      suppliedToken
    ),
    "hex"
  );

  return (
    expected.length ===
      supplied.length &&
    timingSafeEqual(
      expected,
      supplied
    )
  );
}

const managedAdminRoles = [
  "admin",
  "manager",
  "stock_agent",
  "viewer",
];

const membershipListQuerySchema =
  z.object({
    search: z
      .string()
      .trim()
      .max(150)
      .optional(),

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
      .default(20),
  });

async function getManagedMemberships({
  statuses,
  search,
  page,
  limit,
}) {
  const {
    data: memberships,
    error: membershipsError,
  } = await supabaseAdmin
    .from("admin_memberships")
    .select(
      [
        "user_id",
        "role",
        "status",
        "requested_at",
        "approved_at",
        "approved_by",
        "suspended_at",
        "revoked_at",
      ].join(",")
    )
    .in("status", statuses)
    .order("requested_at", {
      ascending: false,
    });

  if (membershipsError) {
    throw membershipsError;
  }

  const safeMemberships =
    memberships ?? [];

  if (safeMemberships.length === 0) {
    return {
      users: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  const userIds = safeMemberships.map(
    (membership) =>
      membership.user_id
  );

  const [
    profilesResult,
    staffProfilesResult,
    authUsers,
  ] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select(
        "id, full_name, phone, avatar_url"
      )
      .in("id", userIds),

    supabaseAdmin
      .from("staff_profiles")
      .select(
        "user_id, display_name, staff_code, sku_prefix, is_active"
      )
      .in("user_id", userIds),

    Promise.all(
      userIds.map(async (userId) => {
        const {
          data,
          error,
        } =
          await supabaseAdmin.auth.admin
            .getUserById(userId);

        if (error) {
          console.error(
            "Administrative user lookup error:",
            userId,
            error
          );

          return null;
        }

        return data?.user ?? null;
      })
    ),
  ]);

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  if (staffProfilesResult.error) {
    throw staffProfilesResult.error;
  }

  const profilesById = new Map(
    (profilesResult.data ?? []).map(
      (profile) => [
        profile.id,
        profile,
      ]
    )
  );

  const staffProfilesById = new Map(
    (
      staffProfilesResult.data ?? []
    ).map((profile) => [
      profile.user_id,
      profile,
    ])
  );

  const authUsersById = new Map(
    authUsers
      .filter(Boolean)
      .map((user) => [
        user.id,
        user,
      ])
  );

  let enrichedUsers =
    safeMemberships.map(
      (membership) => {
        const profile =
          profilesById.get(
            membership.user_id
          ) ?? null;

        const staffProfile =
          staffProfilesById.get(
            membership.user_id
          ) ?? null;

        const authUser =
          authUsersById.get(
            membership.user_id
          ) ?? null;

        return {
          ...membership,
          email:
            authUser?.email ?? null,
          lastSignInAt:
            authUser?.last_sign_in_at ??
            null,
          fullName:
            profile?.full_name ??
            null,
          phone:
            profile?.phone ?? null,
          avatarUrl:
            profile?.avatar_url ??
            null,
          displayName:
            staffProfile?.display_name ??
            null,
          staffCode:
            staffProfile?.staff_code ??
            null,
          skuPrefix:
            staffProfile?.sku_prefix ??
            null,
          isStaffActive:
            staffProfile?.is_active ??
            false,
        };
      }
    );

  if (search) {
    const normalizedSearch =
      search.toLocaleLowerCase(
        "fr"
      );

    enrichedUsers =
      enrichedUsers.filter((user) =>
        [
          user.email,
          user.fullName,
          user.displayName,
          user.staffCode,
          user.skuPrefix,
          user.role,
          user.status,
          user.user_id,
        ].some((value) =>
          String(value ?? "")
            .toLocaleLowerCase("fr")
            .includes(normalizedSearch)
        )
      );
  }

  const total = enrichedUsers.length;
  const start = (page - 1) * limit;
  const paginatedUsers =
    enrichedUsers.slice(
      start,
      start + limit
    );

  return {
    users: paginatedUsers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(
        total / limit
      ),
    },
  };
}

async function getAllRegisteredUsers({
  search,
  page,
  limit,
}) {
  const {
    data: authResult,
    error: authError,
  } =
    await supabaseAdmin.auth.admin
      .listUsers({
        page: 1,
        perPage: 1000,
      });

  if (authError) {
    throw authError;
  }

  const authUsers =
    authResult?.users ?? [];

  if (authUsers.length === 0) {
    return {
      users: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  const userIds = authUsers.map(
    (user) => user.id
  );

  const [
    membershipsResult,
    profilesResult,
    staffProfilesResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("admin_memberships")
      .select(
        "user_id, role, status, requested_at, approved_at, approved_by, suspended_at, revoked_at"
      )
      .in("user_id", userIds),
    supabaseAdmin
      .from("profiles")
      .select(
        "id, full_name, phone, avatar_url"
      )
      .in("id", userIds),
    supabaseAdmin
      .from("staff_profiles")
      .select(
        "user_id, display_name, staff_code, sku_prefix, is_active"
      )
      .in("user_id", userIds),
  ]);

  if (membershipsResult.error) {
    throw membershipsResult.error;
  }

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  if (staffProfilesResult.error) {
    throw staffProfilesResult.error;
  }

  const membershipsById = new Map(
    (membershipsResult.data ?? []).map(
      (membership) => [
        membership.user_id,
        membership,
      ]
    )
  );

  const profilesById = new Map(
    (profilesResult.data ?? []).map(
      (profile) => [
        profile.id,
        profile,
      ]
    )
  );

  const staffProfilesById = new Map(
    (staffProfilesResult.data ?? []).map(
      (profile) => [
        profile.user_id,
        profile,
      ]
    )
  );

  let users = authUsers.map(
    (authUser) => {
      const membership =
        membershipsById.get(
          authUser.id
        ) ?? null;

      const profile =
        profilesById.get(
          authUser.id
        ) ?? null;

      const staffProfile =
        staffProfilesById.get(
          authUser.id
        ) ?? null;

      return {
        ...(membership ?? {}),
        user_id: authUser.id,
        email:
          authUser.email ?? null,
        emailConfirmedAt:
          authUser.email_confirmed_at ??
          null,
        createdAt:
          authUser.created_at ?? null,
        lastSignInAt:
          authUser.last_sign_in_at ??
          null,
        status:
          membership?.status ??
          "registered",
        role:
          membership?.role ??
          "viewer",
        fullName:
          profile?.full_name ??
          authUser.user_metadata
            ?.full_name ??
          null,
        phone:
          profile?.phone ?? null,
        avatarUrl:
          profile?.avatar_url ??
          null,
        displayName:
          staffProfile?.display_name ??
          null,
        staffCode:
          staffProfile?.staff_code ??
          null,
        skuPrefix:
          staffProfile?.sku_prefix ??
          null,
        isStaffActive:
          staffProfile?.is_active ??
          false,
      };
    }
  );

  if (search) {
    const normalizedSearch =
      search.toLocaleLowerCase("fr");

    users = users.filter((user) =>
      [
        user.email,
        user.fullName,
        user.displayName,
        user.staffCode,
        user.skuPrefix,
        user.role,
        user.status,
        user.user_id,
      ].some((value) =>
        String(value ?? "")
          .toLocaleLowerCase("fr")
          .includes(normalizedSearch)
      )
    );
  }

  users.sort(
    (first, second) =>
      new Date(
        second.createdAt ?? 0
      ) -
      new Date(
        first.createdAt ?? 0
      )
  );

  const total = users.length;
  const start = (page - 1) * limit;

  return {
    users: users.slice(
      start,
      start + limit
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages:
        Math.ceil(total / limit),
    },
  };
}

/**
 * POST /api/admin/auth/access/request
 *
 * Enregistre une demande d’accès pour un
 * utilisateur qui ne possède pas encore
 * d’adhésion administrative.
 */
router.post(
    [
    "/access/request",
    "/access-request",
  ],
  authenticateUser,
  async (request, response) => {
    try {
      const {
        data: existingMembership,
        error:
          existingMembershipError,
      } = await supabaseAdmin
        .from("admin_memberships")
        .select("user_id, status")
        .eq(
          "user_id",
          request.auth.user.id
        )
        .maybeSingle();

      if (existingMembershipError) {
        throw existingMembershipError;
      }

      /*
       * Cette fonction doit utiliser le client
       * Supabase de l’utilisateur, car la
       * fonction SQL dépend de auth.uid().
       */
      const {
        data,
        error,
      } = await request.auth.supabase.rpc(
        "request_admin_access"
      );

      if (error) {
        throw error;
      }

      /*
       * On récupère ensuite l’adhésion complète.
       * Le client administrateur contourne les
       * éventuelles restrictions RLS, mais la
       * requête reste limitée à l’utilisateur
       * actuellement authentifié.
       */
      const {
        data: membership,
        error: membershipError,
      } = await supabaseAdmin
        .from("admin_memberships")
        .select(
          "user_id, role, status, requested_at, approved_at"
        )
        .eq(
          "user_id",
          request.auth.user.id
        )
        .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      if (
        !existingMembership &&
        membership?.status === "pending"
      ) {
        const requesterEmail =
          await getUserEmail(
            request.auth.user.id
          );

        const displayEmail =
          requesterEmail ??
          "Un nouvel utilisateur";

        await notifySafely({
          eventType:
            "access_requested",
          title:
            "Nouvelle demande d’accès",
          body:
            `${displayEmail} s’est connecté. ` +
            "Si la connexion est légitime, veuillez autoriser l’accès.",
          route:
            "/administration/access-requests",
          actorUserId:
            request.auth.user.id,
          subjectUserId:
            request.auth.user.id,
          data: {
            requestedUserId:
              request.auth.user.id,
            displayEmail:
              requesterEmail,
          },
          excludeUserIds: [
            request.auth.user.id,
          ],
        });
      }

      return response.status(200).json({
        success: true,
        status: data,
        membership:
          membership ?? null,
      });
    } catch (error) {
      console.error(
        "Administrative access request error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to request administrative access",
      });
    }
  }
);

/**
 * GET /api/admin/auth/access/status
 *
 * Retourne le statut administratif du
 * compte actuellement authentifié.
 *
 * Le compte owner déjà approuvé recevra
 * directement son rôle et son statut.
 */
router.get(
 [
    "/access/status",
    "/access-status",
  ],
  authenticateUser,
  async (request, response) => {
    try {
      /*
       * On utilise le client administrateur pour
       * éviter qu’une politique RLS incorrecte
       * masque l’adhésion existante.
       *
       * La recherche est limitée à l’UUID extrait
       * du JWT validé par authenticateUser.
       */
      const {
        data: membership,
        error,
      } = await supabaseAdmin
        .from("admin_memberships")
        .select(
          "user_id, role, status, requested_at, approved_at"
        )
        .eq(
          "user_id",
          request.auth.user.id
        )
        .maybeSingle();

      if (error) {
        throw error;
      }

      return response.status(200).json({
        success: true,
        membership:
          membership ?? null,
      });
    } catch (error) {
      console.error(
        "Administrative status error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to retrieve administrative status",
      });
    }
  }
);

/**
 * GET /api/admin/auth/access-requests
 *
 * Retourne les demandes d’accès en attente.
 * Route réservée au propriétaire.
 */
router.get(
  "/access-requests",
  authenticateUser,
  requireApprovedAdmin(["owner"]),
  requireCompanySession,
  async (request, response) => {
    try {
      const validation =
        membershipListQuerySchema.safeParse(
          request.query
        );

      if (!validation.success) {
        return response.status(400).json({
          success: false,
          error:
            "Invalid access requests query parameters",
          details:
            validation.error.flatten(),
        });
      }

      const {
        search,
        page,
        limit,
      } = validation.data;

      const result =
        await getManagedMemberships({
          statuses: ["pending"],
          search,
          page,
          limit,
        });

      return response.status(200).json({
        success: true,
        requests: result.users,
        pagination:
          result.pagination,
      });
    } catch (error) {
      console.error(
        "Access requests listing error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to retrieve access requests",
      });
    }
  }
);

/**
 * GET /api/admin/auth/authorized-users
 *
 * Retourne les utilisateurs approuvés
 * ou temporairement suspendus.
 */
router.get(
  "/authorized-users",
  authenticateUser,
  requireApprovedAdmin(),
  requireCompanySession,
  async (request, response) => {
    try {
      const validation =
        membershipListQuerySchema.safeParse(
          request.query
        );

      if (!validation.success) {
        return response.status(400).json({
          success: false,
          error:
            "Invalid authorized users query parameters",
          details:
            validation.error.flatten(),
        });
      }

      const {
        search,
        page,
        limit,
      } = validation.data;

      const result =
        await getAllRegisteredUsers({
          search,
          page,
          limit,
        });

      return response.status(200).json({
        success: true,
        users: result.users,
        pagination:
          result.pagination,
      });
    } catch (error) {
      console.error(
        "Authorized users listing error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to retrieve authorized users",
      });
    }
  }
);

router.patch(
  "/me/staff-profile",
  authenticateUser,
  requireApprovedAdmin(),
  requireCompanySession,
  async (request, response) => {
    try {
      const validation = z
        .object({
          staffCode: z
            .string()
            .trim()
            .min(2)
            .max(30)
            .regex(
              /^[A-Za-z0-9_-]+$/
            ),
          skuPrefix: z
            .string()
            .trim()
            .min(2)
            .max(30)
            .regex(
              /^[A-Za-z0-9_-]+$/
            ),
        })
        .safeParse(request.body);

      if (!validation.success) {
        return response.status(400).json({
          success: false,
          error:
            "Code métier ou préfixe SKU invalide",
          details:
            validation.error.flatten(),
        });
      }

      const userId =
        request.auth.user.id;

      const {
        data: currentProfile,
        error: currentProfileError,
      } = await supabaseAdmin
        .from("staff_profiles")
        .select(
          "display_name, is_active"
        )
        .eq("user_id", userId)
        .maybeSingle();

      if (currentProfileError) {
        throw currentProfileError;
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("staff_profiles")
        .upsert(
          {
            user_id: userId,
            display_name:
              currentProfile
                ?.display_name ??
              request.auth.user
                .user_metadata
                ?.full_name ??
              request.auth.user.email,
            staff_code:
              validation.data.staffCode
                .toUpperCase(),
            sku_prefix:
              validation.data.skuPrefix
                .toUpperCase(),
            is_active:
              currentProfile
                ?.is_active ??
              true,
          },
          {
            onConflict: "user_id",
          }
        )
        .select(
          "user_id, display_name, staff_code, sku_prefix, is_active"
        )
        .single();

      if (error) {
        if (
          error.code === "23505"
        ) {
          return response
            .status(409)
            .json({
              success: false,
              error:
                "Ce code métier ou ce préfixe SKU est déjà utilisé.",
            });
        }

        throw error;
      }

      return response.status(200).json({
        success: true,
        profile: data,
      });
    } catch (error) {
      console.error(
        "Personal staff profile update error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Impossible de modifier votre identité métier.",
      });
    }
  }
);

router.post(
  "/login-notification",
  authenticateUser,
  async (request, response) => {
    try {
      const email =
        request.auth.user.email ??
        (await getUserEmail(
          request.auth.user.id
        )) ??
        "Un utilisateur";

      await notifySafely({
        eventType:
          "login_attempted",
        title:
          "Tentative de connexion",
        body:
          `${email} a tenté de se connecter sur la plateforme`,
        route:
          "/administration/authorized-users",
        actorUserId:
          request.auth.user.id,
        subjectUserId:
          request.auth.user.id,
        data: {
          email,
          userId:
            request.auth.user.id,
        },
      });

      return response.status(200).json({
        success: true,
      });
    } catch (error) {
      console.error(
        "Login notification error:",
        error
      );

      return response.status(200).json({
        success: true,
      });
    }
  }
);

/**
 * POST /api/admin/auth/users/:userId/action
 *
 * Approuve, suspend ou révoque un utilisateur.
 * L’approbation configure aussi son identité métier.
 */
router.post(
  "/users/:userId/action",
  authenticateUser,
  requireApprovedAdmin(["owner"]),
  requireCompanySession,
  async (request, response) => {
    try {
      const parametersSchema = z.object({
        userId: z
          .string()
          .uuid("Invalid user ID"),
      });

      const bodySchema = z
        .object({
          action: z.enum([
            "approve",
            "suspend",
            "revoke",
          ]),

          role: z
            .enum(managedAdminRoles)
            .default("stock_agent"),

          displayName: z
            .string()
            .trim()
            .min(1)
            .max(100)
            .nullable()
            .optional(),

          staffCode: z
            .string()
            .trim()
            .min(2)
            .max(30)
            .regex(
              /^[A-Za-z0-9_-]+$/,
              "Invalid staff code"
            )
            .nullable()
            .optional(),

          skuPrefix: z
            .string()
            .trim()
            .min(2)
            .max(30)
            .regex(
              /^[A-Za-z0-9_-]+$/,
              "Invalid SKU prefix"
            )
            .nullable()
            .optional(),
        })
        .superRefine(
          (value, context) => {
            if (
              value.action !==
              "approve"
            ) {
              return;
            }

            if (!value.displayName) {
              context.addIssue({
                code:
                  z.ZodIssueCode.custom,
                path: ["displayName"],
                message:
                  "Display name is required",
              });
            }

            if (!value.staffCode) {
              context.addIssue({
                code:
                  z.ZodIssueCode.custom,
                path: ["staffCode"],
                message:
                  "Staff code is required",
              });
            }

            if (!value.skuPrefix) {
              context.addIssue({
                code:
                  z.ZodIssueCode.custom,
                path: ["skuPrefix"],
                message:
                  "SKU prefix is required",
              });
            }
          }
        );

      const parametersValidation =
        parametersSchema.safeParse(
          request.params
        );

      const bodyValidation =
        bodySchema.safeParse(
          request.body
        );

      if (
        !parametersValidation.success ||
        !bodyValidation.success
      ) {
        return response.status(400).json({
          success: false,
          error:
            "Invalid administrative action",
          details: {
            parameters:
              parametersValidation.success
                ? null
                : parametersValidation.error
                    .flatten(),
            body:
              bodyValidation.success
                ? null
                : bodyValidation.error
                    .flatten(),
          },
        });
      }

      const { userId } =
        parametersValidation.data;

      const {
        action,
        role,
        displayName,
        staffCode,
        skuPrefix,
      } = bodyValidation.data;

      const {
        data,
        error,
      } = await request.auth.supabase.rpc(
        "manage_admin_user",
        {
          target_user_id: userId,
          requested_action: action,
          assigned_role: role,
          staff_display_name:
            displayName ?? null,
          assigned_staff_code:
            staffCode
              ? staffCode.toUpperCase()
              : null,
          assigned_sku_prefix:
            skuPrefix
              ? skuPrefix.toUpperCase()
              : null,
        }
      );

      if (error) {
        console.error(
          "Administrative user action RPC error:",
          error
        );

        if (
          error.message?.includes(
            "Owner access required"
          )
        ) {
          return response
            .status(403)
            .json({
              success: false,
              error:
                "Owner access required",
            });
        }

        if (
          error.message?.includes(
            "not found"
          )
        ) {
          return response
            .status(404)
            .json({
              success: false,
              error:
                "Administrative membership not found",
            });
        }

        if (
          error.message?.includes(
            "already used"
          )
        ) {
          return response
            .status(409)
            .json({
              success: false,
              error:
                "Staff code or SKU prefix already used",
            });
        }

        return response.status(400).json({
          success: false,
          error: error.message,
        });
      }

      if (action === "approve") {
        const authorizedEmail =
          await getUserEmail(userId);

        const displayEmail =
          authorizedEmail ??
          displayName ??
          "Un utilisateur";

        await notifySafely({
          eventType:
            "admin_authorized",
          title:
            "Utilisateur autorisé",
          body:
            `${displayEmail} a été autorisé à accéder à l’entreprise`,
          route:
            "/administration/authorized-users",
          actorUserId:
            request.auth.user.id,
          subjectUserId: userId,
          data: {
            authorizedUserId:
              userId,
            displayEmail:
              authorizedEmail,
            displayName:
              displayName ?? null,
            staffCode:
              staffCode
                ? staffCode.toUpperCase()
                : null,
          },
          excludeUserIds: [userId],
        });
      }

      return response.status(200).json({
        success: true,
        result: data,
      });
    } catch (error) {
      console.error(
        "Administrative user action error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to manage administrative user",
      });
    }
  }
);

/**
 * POST /api/admin/auth/company-password/setup
 *
 * Configure le premier mot de passe
 * supplémentaire de l’entreprise.
 */
router.post(
  "/company-password/setup",
  authenticateUser,
  async (request, response) => {
    try {
      const validation =
        newCompanyPasswordSchema.safeParse(
          request.body
        );

      if (!validation.success) {
        return response.status(400).json({
          success: false,
          error:
            validation.error.issues[0]
              .message,
        });
      }

      /*
       * La fonction SQL utilise auth.uid().
       * Le client de l’utilisateur est donc
       * nécessaire.
       */
      const {
        error,
      } = await request.auth.supabase.rpc(
        "set_company_password",
        {
          new_password:
            validation.data.newPassword,
        }
      );

      if (error) {
        console.error(
          "Company password setup RPC error:",
          error
        );

        return response.status(403).json({
          success: false,
          error: error.message,
        });
      }

      const {
        error: biometricError,
      } = await supabaseAdmin
        .from(
          "company_biometric_credentials"
        )
        .update({
          revoked_at:
            new Date().toISOString(),
        })
        .is("revoked_at", null);

      if (biometricError) {
        throw biometricError;
      }

      return response.status(200).json({
        success: true,
        message:
          "Company password configured successfully",
      });
    } catch (error) {
      console.error(
        "Company password setup error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to configure company password",
      });
    }
  }
);

/**
 * POST /api/admin/auth/company-password/verify
 *
 * Vérifie le mot de passe supplémentaire
 * de l’entreprise et crée une session.
 */
router.post(
  "/company-password/verify",
  authenticateUser,
  async (request, response) => {
    try {
      const validation =
        companyPasswordSchema.safeParse(
          request.body
        );

      if (!validation.success) {
        return response.status(400).json({
          success: false,
          error:
            validation.error.issues[0]
              .message,
        });
      }

      const {
        password,
        deviceLabel,
      } = validation.data;

      /*
       * Cette fonction dépend de auth.uid().
       * Elle doit recevoir le JWT de
       * l’utilisateur authentifié.
       */
      const {
        data,
        error,
      } = await request.auth.supabase.rpc(
        "verify_company_password",
        {
          supplied_password: password,

          supplied_device_label:
            deviceLabel || null,
        }
      );

      if (error) {
        throw error;
      }

      if (!data?.granted) {
        return response.status(403).json({
          success: false,
          ...data,
        });
      }

      const actorLabel =
        await getUserDisplayLabel(
          request.auth.user.id
        );

      await notifySafely({
        eventType:
          "company_session_opened",
        title: "Utilisateur connecté",
        body:
          `${actorLabel} vient de se connecter à la plateforme`,
        route: "/dashboard",
        actorUserId:
          request.auth.user.id,
        data: {
          actorLabel,
          authenticationMethod:
            "company_password",
        },
        excludeUserIds: [
          request.auth.user.id,
        ],
      });

      return response.status(200).json({
        success: true,
        ...data,
      });
    } catch (error) {
      console.error(
        "Company password verification error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to verify company password",
      });
    }
  }
);

/**
 * POST /api/admin/auth/biometric/enroll
 *
 * Crée un secret d'appareil seulement après
 * une session entreprise déjà validée par le
 * mot de passe.
 */
router.post(
  "/biometric/enroll",
  authenticateUser,
  requireApprovedAdmin(),
  requireCompanySession,
  async (request, response) => {
    try {
      const validation = z
        .object({
          deviceLabel: z
            .string()
            .trim()
            .max(100)
            .optional(),
        })
        .safeParse(request.body);

      if (!validation.success) {
        return response.status(400).json({
          success: false,
          error:
            "Invalid biometric device data",
        });
      }

      const token =
        randomBytes(32).toString(
          "base64url"
        );

      const tokenHash =
        hashBiometricToken(token);

      const deviceLabel =
        validation.data.deviceLabel ??
        null;

      /*
       * Une nouvelle activation remplace les
       * anciennes autorisations de ce même
       * utilisateur sur ce libellé d'appareil.
       */
      if (deviceLabel) {
        await supabaseAdmin
          .from(
            "company_biometric_credentials"
          )
          .update({
            revoked_at:
              new Date().toISOString(),
          })
          .eq(
            "user_id",
            request.auth.user.id
          )
          .eq(
            "device_label",
            deviceLabel
          )
          .is("revoked_at", null);
      }

      const {
        data: credential,
        error,
      } = await supabaseAdmin
        .from(
          "company_biometric_credentials"
        )
        .insert({
          user_id:
            request.auth.user.id,
          token_hash: tokenHash,
          device_label:
            deviceLabel,
        })
        .select("id, created_at")
        .single();

      if (error) {
        throw error;
      }

      return response.status(201).json({
        success: true,
        credentialId: credential.id,
        token,
        createdAt:
          credential.created_at,
      });
    } catch (error) {
      console.error(
        "Biometric enrollment error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to activate biometric access",
      });
    }
  }
);

/**
 * POST /api/admin/auth/biometric/verify
 *
 * Vérifie le secret déverrouillé localement
 * par l'empreinte ou la reconnaissance faciale,
 * puis crée une session entreprise courte.
 */
router.post(
  "/biometric/verify",
  authenticateUser,
  async (request, response) => {
    try {
      const validation =
        biometricCredentialSchema
          .safeParse(request.body);

      if (!validation.success) {
        return response.status(400).json({
          success: false,
          error:
            "Invalid biometric credential",
        });
      }

      const {
        credentialId,
        token,
        deviceLabel,
      } = validation.data;

      const {
        data: membership,
        error: membershipError,
      } = await supabaseAdmin
        .from("admin_memberships")
        .select("status")
        .eq(
          "user_id",
          request.auth.user.id
        )
        .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      if (
        membership?.status !==
        "approved"
      ) {
        return response.status(403).json({
          success: false,
          error:
            "Administrative access is no longer approved",
          biometricCredentialRevoked:
            true,
        });
      }

      const {
        data: credential,
        error: credentialError,
      } = await supabaseAdmin
        .from(
          "company_biometric_credentials"
        )
        .select(
          "id, token_hash, device_label"
        )
        .eq("id", credentialId)
        .eq(
          "user_id",
          request.auth.user.id
        )
        .is("revoked_at", null)
        .maybeSingle();

      if (credentialError) {
        throw credentialError;
      }

      if (
        !credential ||
        !biometricTokenMatches(
          credential.token_hash,
          token
        )
      ) {
        return response.status(403).json({
          success: false,
          error:
            "Biometric access is invalid or revoked",
          biometricCredentialRevoked:
            true,
        });
      }

      const {
        data: securityConfig,
        error: securityError,
      } = await supabaseAdmin
        .from("company_security")
        .select(
          "session_duration_minutes"
        )
        .eq("id", true)
        .single();

      if (securityError) {
        throw securityError;
      }

      const expiresAt = new Date(
        Date.now() +
          securityConfig
            .session_duration_minutes *
            60 *
            1000
      ).toISOString();

      const {
        data: companySession,
        error: sessionError,
      } = await supabaseAdmin
        .from(
          "company_access_sessions"
        )
        .insert({
          user_id:
            request.auth.user.id,
          device_label:
            deviceLabel ??
            credential.device_label ??
            null,
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (sessionError) {
        throw sessionError;
      }

      await supabaseAdmin
        .from(
          "company_biometric_credentials"
        )
        .update({
          last_used_at:
            new Date().toISOString(),
        })
        .eq("id", credential.id);

      const actorLabel =
        await getUserDisplayLabel(
          request.auth.user.id
        );

      await notifySafely({
        eventType:
          "company_session_opened",
        title: "Utilisateur connecté",
        body:
          `${actorLabel} vient de se connecter à la plateforme`,
        route: "/dashboard",
        actorUserId:
          request.auth.user.id,
        data: {
          actorLabel,
          authenticationMethod:
            "biometric",
        },
        excludeUserIds: [
          request.auth.user.id,
        ],
      });

      return response.status(200).json({
        success: true,
        granted: true,
        session_id:
          companySession.id,
        expires_at: expiresAt,
      });
    } catch (error) {
      console.error(
        "Biometric verification error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to verify biometric access",
      });
    }
  }
);

/**
 * POST /api/admin/auth/company-password/logout
 *
 * Ferme toutes les sessions d’entreprise
 * appartenant à l’utilisateur connecté.
 */
router.post(
  "/company-password/logout",
  authenticateUser,
  async (request, response) => {
    try {
      /*
       * La fonction SQL dépend de auth.uid().
       */
      const {
        error,
      } = await request.auth.supabase.rpc(
        "revoke_my_company_sessions"
      );

      if (error) {
        throw error;
      }

      const {
        error: biometricError,
      } = await supabaseAdmin
        .from(
          "company_biometric_credentials"
        )
        .update({
          revoked_at:
            new Date().toISOString(),
        })
        .eq(
          "user_id",
          request.auth.user.id
        )
        .is("revoked_at", null);

      if (biometricError) {
        throw biometricError;
      }

      return response.status(200).json({
        success: true,
        message:
          "Company sessions revoked successfully",
      });
    } catch (error) {
      console.error(
        "Company logout error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to close company sessions",
      });
    }
  }
);

export default router;
