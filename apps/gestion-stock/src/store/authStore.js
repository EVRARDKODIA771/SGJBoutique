import { create } from "zustand";

export const useAuthStore = create(
  (set) => ({
    /*
     * Session personnelle Supabase.
     */
    session: null,
    user: null,

    /*
     * Informations administratives.
     */
    adminMembership: null,

    /*
     * Session créée après validation
     * du mot de passe entreprise.
     *
     * Elle reste uniquement en mémoire
     * et n’est pas enregistrée dans les
     * variables d’environnement.
     */
    companySessionId: null,

    isInitializing: true,

    setSession(session) {
      set({
        session,
        user: session?.user ?? null,
      });
    },

    setAdminMembership(
      adminMembership
    ) {
      set({
        adminMembership,
      });
    },

    setCompanySessionId(
      companySessionId
    ) {
      set({
        companySessionId,
      });
    },

    setIsInitializing(
      isInitializing
    ) {
      set({
        isInitializing,
      });
    },

    clearCompanySession() {
      set({
        companySessionId: null,
      });
    },

    resetAuthentication() {
      set({
        session: null,
        user: null,
        adminMembership: null,
        companySessionId: null,
        isInitializing: false,
      });
    },
  })
);
