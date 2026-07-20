import {
  supabaseAdmin,
  createUserSupabaseClient,
} from "../lib/supabaseAdmin.js";

export async function authenticateUser(
  request,
  response,
  next
) {
  try {
    const authorization =
      request.headers.authorization;

    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {
      return response.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const accessToken = authorization
      .slice(7)
      .trim();

    if (!accessToken) {
      return response.status(401).json({
        success: false,
        error: "Invalid authentication token",
      });
    }

    const {
      data,
      error,
    } = await supabaseAdmin.auth.getUser(
      accessToken
    );

    if (error || !data.user) {
      return response.status(401).json({
        success: false,
        error:
          "Authentication token is invalid or expired",
      });
    }

    request.auth = {
      user: data.user,
      accessToken,
      supabase:
        createUserSupabaseClient(
          accessToken
        ),
    };

    return next();
  } catch (error) {
    console.error(
      "Authentication middleware error:",
      error
    );

    return response.status(500).json({
      success: false,
      error:
        "Unable to verify authentication",
    });
  }
}
