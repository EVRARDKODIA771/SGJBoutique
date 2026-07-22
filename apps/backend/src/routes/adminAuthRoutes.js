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
