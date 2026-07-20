import {
  Router,
} from "express";

import {
  z,
} from "zod";

import {
  authenticateUser,
} from "../middleware/authenticateUser.js";

const router = Router();

const companyPasswordSchema = z.object({
  password: z
    .string()
    .min(1, "Company password is required"),

  deviceLabel: z
    .string()
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

// Demander l'accès à l'administration
router.post(
  "/access/request",
  authenticateUser,
  async (request, response) => {
    try {
      const {
        data,
        error,
      } = await request.auth.supabase.rpc(
        "request_admin_access"
      );

      if (error) {
        throw error;
      }

      return response.status(200).json({
        success: true,
        status: data,
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

// Consulter son propre statut administratif
router.get(
  "/access/status",
  authenticateUser,
  async (request, response) => {
    try {
      const {
        data,
        error,
      } = await request.auth.supabase
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
        membership: data,
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

// Configurer le premier mot de passe entreprise
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
            validation.error.issues[0].message,
        });
      }

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

// Vérifier le mot de passe entreprise
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
            validation.error.issues[0].message,
        });
      }

      const {
        password,
        deviceLabel,
      } = validation.data;

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

// Fermer toutes ses sessions entreprise
router.post(
  "/company-password/logout",
  authenticateUser,
  async (request, response) => {
    try {
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
