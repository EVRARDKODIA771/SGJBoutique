import {
  Platform,
} from "react-native";

import {
  apiRequest,
} from "../lib/api.js";

import {
  supabase,
} from "../lib/supabase.js";

import {
  useAuthStore,
} from "../store/authStore.js";

export async function initializeAuth() {
  const authStore =
    useAuthStore.getState();

  try {
    const {
      data,
      error,
    } = await supabase.auth
      .getSession();

    if (error) {
      throw error;
    }

    const session =
      data.session ?? null;

    authStore.setSession(session);

    if (!session) {
      authStore.setAdminMembership(
        null
      );

      return {
        session: null,
        membership: null,
      };
    }

    const statusResult =
      await getAdminAccessStatus();

    return {
      session,
      membership:
        statusResult.membership,
    };
  } finally {
    useAuthStore
      .getState()
      .setIsInitializing(false);
  }
}

export async function signIn(
  email,
  password
) {
  const {
    data,
    error,
  } = await supabase.auth
    .signInWithPassword({
      email: email.trim(),
      password,
    });

  if (error) {
    throw error;
  }

  useAuthStore
    .getState()
    .setSession(data.session);

  const statusResult =
    await getAdminAccessStatus();

  return {
    session: data.session,
    user: data.user,
    membership:
      statusResult.membership,
  };
}

/*
 * Récupération du statut administratif.
 *
 * Ces routes peu profondes restent utilisées
 * afin de conserver la compatibilité avec
 * l’organisation actuelle du backend Vercel.
 */
export async function getAdminAccessStatus() {
  const result = await apiRequest(
    "/api/admin/products/access-status",
    {
      requiresCompanySession: false,
    }
  );

  useAuthStore
    .getState()
    .setAdminMembership(
      result.membership ?? null
    );

  return result;
}

/*
 * Enregistrement d’une demande d’accès.
 */
export async function requestAdminAccess() {
  const result = await apiRequest(
    "/api/admin/products/access-request",
    {
      method: "POST",
      requiresCompanySession: false,
    }
  );

  await getAdminAccessStatus();

  return result;
}

/*
 * Construit les paramètres utilisés par les
 * deux pages d’administration.
 */
function buildAdminQuery({
  search,
  page = 1,
  limit = 20,
} = {}) {
  const parameters =
    new URLSearchParams();

  if (search?.trim()) {
    parameters.set(
      "search",
      search.trim()
    );
  }

  parameters.set(
    "page",
    String(page)
  );

  parameters.set(
    "limit",
    String(limit)
  );

  return `?${parameters.toString()}`;
}

/*
 * Liste des demandes d’accès en attente.
 */
export function getAccessRequests({
  search,
  page = 1,
  limit = 20,
} = {}) {
  const query = buildAdminQuery({
    search,
    page,
    limit,
  });

  return apiRequest(
    `/api/admin/auth/access-requests${query}`
  );
}

/*
 * Liste des utilisateurs déjà autorisés.
 */
export function getAuthorizedUsers({
  search,
  page = 1,
  limit = 20,
} = {}) {
  const query = buildAdminQuery({
    search,
    page,
    limit,
  });

  return apiRequest(
    `/api/admin/auth/authorized-users${query}`
  );
}

/*
 * Approuve, suspend, réactive ou révoque
 * l’accès administratif d’un utilisateur.
 */
export function manageAdminUser(
  userId,
  {
    action,
    role,
    displayName,
    staffCode,
    skuPrefix,
  }
) {
  return apiRequest(
    `/api/admin/auth/users/${userId}/action`,
    {
      method: "POST",

      body: {
        action,
        role,
        displayName,
        staffCode,
        skuPrefix,
      },
    }
  );
}

export async function verifyCompanyPassword(
  password
) {
  const result = await apiRequest(
    "/api/admin/auth/company-password/verify",
    {
      method: "POST",
      requiresCompanySession: false,

      body: {
        password,

        deviceLabel:
          `gestion-stock-${Platform.OS}`,
      },
    }
  );

  const companySessionId =
    result.session_id;

  if (!companySessionId) {
    throw new Error(
      "Company session was not created"
    );
  }

  useAuthStore
    .getState()
    .setCompanySessionId(
      companySessionId
    );

  return result;
}

export async function logoutCompanySession() {
  try {
    await apiRequest(
      "/api/admin/auth/company-password/logout",
      {
        method: "POST",
        requiresCompanySession: false,
      }
    );
  } finally {
    useAuthStore
      .getState()
      .clearCompanySession();
  }
}

export async function signOut() {
  try {
    await logoutCompanySession();
  } catch (error) {
    console.warn(
      "Company logout error:",
      error
    );
  }

  const {
    error,
  } = await supabase.auth.signOut();

  useAuthStore
    .getState()
    .resetAuthentication();

  if (error) {
    throw error;
  }
}
