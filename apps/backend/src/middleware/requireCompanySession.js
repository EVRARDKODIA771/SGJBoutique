import {
  supabaseAdmin,
} from "../lib/supabaseAdmin.js";

export async function requireCompanySession(
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

    const companySessionId =
      request.headers[
        "x-company-session-id"
      ];

    if (
      !companySessionId ||
      typeof companySessionId !== "string"
    ) {
      return response.status(401).json({
        success: false,
        error:
          "Company password verification is required",
        companyPasswordRequired: true,
      });
    }

    const {
      data: companySession,
      error,
    } = await supabaseAdmin
      .from("company_access_sessions")
      .select(
        "id, user_id, device_label, created_at, expires_at, revoked_at"
      )
      .eq("id", companySessionId)
      .eq(
        "user_id",
        request.auth.user.id
      )
      .is("revoked_at", null)
      .gt(
        "expires_at",
        new Date().toISOString()
      )
      .maybeSingle();

    if (error) {
      console.error(
        "Company session verification error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to verify company session",
      });
    }

    if (!companySession) {
      return response.status(401).json({
        success: false,
        error:
          "Company session is invalid or expired",
        companyPasswordRequired: true,
      });
    }

    request.companySession =
      companySession;

    return next();
  } catch (error) {
    console.error(
      "Company session middleware error:",
      error
    );

    return response.status(500).json({
      success: false,
      error:
        "Unable to verify company access",
    });
  }
}
