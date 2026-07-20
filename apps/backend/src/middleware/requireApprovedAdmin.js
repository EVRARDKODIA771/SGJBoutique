import {
  supabaseAdmin,
} from "../lib/supabaseAdmin.js";

export function requireApprovedAdmin(
  allowedRoles = []
) {
  return async function (
    request,
    response,
    next
  ) {
    try {
      if (!request.auth?.user) {
        return response.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const userId = request.auth.user.id;

      const {
        data: membership,
        error,
      } = await supabaseAdmin
        .from("admin_memberships")
        .select(
          "user_id, role, status, approved_at"
        )
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error(
          "Administrative membership error:",
          error
        );

        return response.status(500).json({
          success: false,
          error:
            "Unable to verify administrative access",
        });
      }

      if (!membership) {
        return response.status(403).json({
          success: false,
          error:
            "Administrative access has not been requested",
          status: "not_registered",
        });
      }

      if (membership.status !== "approved") {
        return response.status(403).json({
          success: false,
          error:
            "Administrative access is not approved",
          status: membership.status,
        });
      }

      if (
        allowedRoles.length > 0 &&
        !allowedRoles.includes(
          membership.role
        )
      ) {
        return response.status(403).json({
          success: false,
          error:
            "Your administrative role does not allow this operation",
        });
      }

      request.admin = membership;

      return next();
    } catch (error) {
      console.error(
        "Administrative authorization error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to verify administrative authorization",
      });
    }
  };
}
