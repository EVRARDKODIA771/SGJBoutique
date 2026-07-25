import { env } from "../config/env.js";
import { useAuthStore } from
  "../store/authStore.js";
import { supabase } from "./supabase.js";

export class ApiError extends Error {
  constructor(
    message,
    status,
    details = null
  ) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

/*
 * Nettoie complètement une session devenue
 * invalide ou impossible à renouveler.
 *
 * Zustand est vidé immédiatement afin que les
 * gardes Expo Router redirigent vers /login.
 * La déconnexion Supabase locale empêche
 * l’ancienne session d’être restaurée après
 * une actualisation de la page.
 */
async function clearExpiredAuthentication() {
  useAuthStore
    .getState()
    .resetAuthentication();

  try {
    await supabase.auth.signOut({
      scope: "local",
    });
  } catch (error) {
    console.warn(
      "Expired session cleanup error:",
      error
    );
  }
}

async function getAccessToken() {
  const {
    data,
    error,
  } = await supabase.auth.getSession();

  if (error) {
    await clearExpiredAuthentication();

    throw new ApiError(
      "Unable to retrieve authentication session",
      401
    );
  }

  const accessToken =
    data.session?.access_token;

  if (!accessToken) {
    await clearExpiredAuthentication();

    throw new ApiError(
      "Authentication required",
      401
    );
  }

  return accessToken;
}

async function executeRequest(
  path,
  options,
  accessToken
) {
  const {
    method = "GET",
    body,
    headers = {},
    requiresCompanySession = true,
  } = options;

  const {
    companySessionId,
  } = useAuthStore.getState();

  if (
    requiresCompanySession &&
    !companySessionId
  ) {
    throw new ApiError(
      "Company authentication required",
      401
    );
  }

  const requestHeaders = {
    Accept: "application/json",
    Authorization:
      `Bearer ${accessToken}`,
    ...headers,
  };

  if (requiresCompanySession) {
    requestHeaders[
      "X-Company-Session-ID"
    ] = companySessionId;
  }

  const isFormData =
    typeof FormData !== "undefined" &&
    body instanceof FormData;

  let requestBody = body;

  if (
    body !== undefined &&
    body !== null &&
    !isFormData
  ) {
    requestHeaders["Content-Type"] =
      requestHeaders["Content-Type"] ??
      "application/json";

    requestBody =
      typeof body === "string"
        ? body
        : JSON.stringify(body);
  }

  const response = await fetch(
    `${env.apiUrl}${path}`,
    {
      method,
      headers: requestHeaders,
      body: requestBody,
    }
  );

  let result = null;

  if (response.status !== 204) {
    const responseText =
      await response.text();

    if (responseText) {
      try {
        result = JSON.parse(
          responseText
        );
      } catch {
        result = {
          error: responseText,
        };
      }
    }
  }

  return {
    response,
    result,
  };
}

export async function apiRequest(
  path,
  options = {}
) {
  let accessToken =
    await getAccessToken();

  let {
    response,
    result,
  } = await executeRequest(
    path,
    options,
    accessToken
  );

  /*
   * Si le JWT vient d’expirer, Supabase
   * le renouvelle une seule fois puis
   * la requête est relancée.
   */
  if (response.status === 401) {
    const {
      data,
      error,
    } = await supabase.auth
      .refreshSession();

    if (
      !error &&
      data.session?.access_token
    ) {
      accessToken =
        data.session.access_token;

      useAuthStore
        .getState()
        .setSession(data.session);

      ({
        response,
        result,
      } = await executeRequest(
        path,
        options,
        accessToken
      ));
    }

    /*
     * Le renouvellement a échoué ou le nouveau
     * JWT est lui aussi refusé par le backend.
     * L’utilisateur doit recommencer depuis
     * la page de connexion.
     */
    if (
      error ||
      !data.session?.access_token ||
      response.status === 401
    ) {
      await clearExpiredAuthentication();

      throw new ApiError(
        result?.error ??
          "Authentication session expired",
        401,
        result?.details ?? null
      );
    }
  }

  if (!response.ok) {
    throw new ApiError(
      result?.error ??
        "Unable to complete request",
      response.status,
      result?.details ?? null
    );
  }

  return result;
}
