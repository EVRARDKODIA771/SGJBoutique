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
        await getManagedMemberships({
          statuses: [
            "approved",
            "suspended",
          ],
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
