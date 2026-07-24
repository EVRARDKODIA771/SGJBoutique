import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  getAccessRequests,
  getAuthorizedUsers,
  manageAdminUser,
} from "../services/authService.js";

import {
  useAuthStore,
} from "../store/authStore.js";

import { colors } from
  "../theme/colors.js";

const roles = [
  {
    value: "admin",
    label: "Administrateur",
  },
  {
    value: "manager",
    label: "Responsable",
  },
  {
    value: "stock_agent",
    label: "Gestionnaire du stock",
  },
  {
    value: "viewer",
    label: "Consultation uniquement",
  },
];

const roleLabels = Object.fromEntries(
  roles.map((role) => [
    role.value,
    role.label,
  ])
);

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
}

function createApprovalDraft(user) {
  const suggestedName =
    user.displayName ||
    user.fullName ||
    "";

  const suggestedCode =
    user.staffCode ||
    suggestedName
      .trim()
      .split(/\s+/)[0]
      ?.normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase() ||
    "";

  return {
    role:
      user.role === "viewer"
        ? "stock_agent"
        : user.role,
    displayName: suggestedName,
    staffCode: suggestedCode,
    skuPrefix:
      user.skuPrefix ||
      suggestedCode,
  };
}

export default function AdministrationUsersScreen({
  view,
  onBack,
}) {
  const isRequests =
    view === "requests";

  const currentUserId =
    useAuthStore(
      (state) =>
        state.session?.user?.id
    );

  const [users, setUsers] =
    useState([]);

  const [drafts, setDrafts] =
    useState({});

  const [searchInput, setSearchInput] =
    useState("");

  const [activeSearch, setActiveSearch] =
    useState("");

  const [page, setPage] = useState(1);

  const [pagination, setPagination] =
    useState({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });

  const [isLoading, setIsLoading] =
    useState(true);

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [
    processingUserId,
    setProcessingUserId,
  ] = useState(null);

  const [errorMessage, setErrorMessage] =
    useState("");

  const loadUsers = useCallback(
    async () => {
      setErrorMessage("");

      try {
        const loader = isRequests
          ? getAccessRequests
          : getAuthorizedUsers;

        const result = await loader({
          search:
            activeSearch || undefined,
          page,
          limit: 20,
        });

        const loadedUsers = isRequests
          ? result.requests ?? []
          : result.users ?? [];

        setUsers(loadedUsers);
        setPagination(
          result.pagination ?? {
            page,
            limit: 20,
            total: 0,
            totalPages: 0,
          }
        );

        if (isRequests) {
          setDrafts((current) => {
            const next = {
              ...current,
            };

            for (const user of
              loadedUsers) {
              if (!next[user.user_id]) {
                next[user.user_id] =
                  createApprovalDraft(
                    user
                  );
              }
            }

            return next;
          });
        }
      } catch (error) {
        console.error(
          "Administration users loading error:",
          error
        );

        setErrorMessage(
          error?.message ||
            "Impossible de charger les utilisateurs."
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [
      activeSearch,
      isRequests,
      page,
    ]
  );

  useEffect(() => {
    setIsLoading(true);
    loadUsers();
  }, [loadUsers]);

  function updateDraft(
    userId,
    field,
    value
  ) {
    setDrafts((current) => ({
      ...current,
      [userId]: {
        ...current[userId],
        [field]: value,
      },
    }));
  }

  function submitSearch() {
    setPage(1);
    setActiveSearch(
      searchInput.trim()
    );
  }

  function clearSearch() {
    setSearchInput("");
    setActiveSearch("");
    setPage(1);
  }

  function refreshUsers() {
    setIsRefreshing(true);
    loadUsers();
  }

  async function approveRequest(user) {
    const draft =
      drafts[user.user_id] ??
      createApprovalDraft(user);

    if (!draft.displayName.trim()) {
      Alert.alert(
        "Nom requis",
        "Saisissez le nom de la personne."
      );
      return;
    }

    if (!draft.staffCode.trim()) {
      Alert.alert(
        "Code métier requis",
        "Saisissez le code métier, par exemple DORCAS."
      );
      return;
    }

    if (!draft.skuPrefix.trim()) {
      Alert.alert(
        "Préfixe SKU requis",
        "Saisissez le préfixe utilisé pour les SKU."
      );
      return;
    }

    setProcessingUserId(
      user.user_id
    );

    try {
      await manageAdminUser(
        user.user_id,
        {
          action: "approve",
          role: draft.role,
          displayName:
            draft.displayName.trim(),
          staffCode:
            draft.staffCode
              .trim()
              .toUpperCase(),
          skuPrefix:
            draft.skuPrefix
              .trim()
              .toUpperCase(),
        }
      );

      await loadUsers();

      Alert.alert(
        "Accès autorisé",
        "L’utilisateur peut maintenant accéder à la gestion."
      );
    } catch (error) {
      Alert.alert(
        "Approbation impossible",
        error?.message ||
          "Une erreur est survenue."
      );
    } finally {
      setProcessingUserId(null);
    }
  }

  function confirmAction(
    user,
    action
  ) {
    const labels = {
      suspend: {
        title:
          "Suspendre cet utilisateur ?",
        message:
          "Son accès et ses sessions d’entreprise seront désactivés.",
        button: "Suspendre",
      },
      revoke: {
        title:
          isRequests
            ? "Refuser cette demande ?"
            : "Révoquer cet utilisateur ?",
        message:
          "L’utilisateur n’aura plus accès à la gestion.",
        button:
          isRequests
            ? "Refuser"
            : "Révoquer",
      },
      approve: {
        title:
          "Réactiver cet utilisateur ?",
        message:
          "Son accès administratif sera de nouveau autorisé.",
        button: "Réactiver",
      },
    };

    const copy = labels[action];

    Alert.alert(
      copy.title,
      copy.message,
      [
        {
          text: "Annuler",
          style: "cancel",
        },
        {
          text: copy.button,
          style:
            action === "approve"
              ? "default"
              : "destructive",
          onPress: () =>
            executeAction(
              user,
              action
            ),
        },
      ]
    );
  }

  async function executeAction(
    user,
    action
  ) {
    setProcessingUserId(
      user.user_id
    );

    try {
      const payload = {
        action,
        role:
          user.role === "owner"
            ? "admin"
            : user.role,
      };

      if (action === "approve") {
        payload.displayName =
          user.displayName ||
          user.fullName;
        payload.staffCode =
          user.staffCode;
        payload.skuPrefix =
          user.skuPrefix;
      }

      await manageAdminUser(
        user.user_id,
        payload
      );

      await loadUsers();
    } catch (error) {
      Alert.alert(
        "Action impossible",
        error?.message ||
          "Une erreur est survenue."
      );
    } finally {
      setProcessingUserId(null);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.scrollContent
      }
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refreshUsers}
          tintColor={brandBlue}
        />
      }
    >
      <View style={styles.container}>
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          onPress={onBack}
        >
          <Text
            style={styles.backButtonText}
          >
            ‹ Retour
          </Text>
        </Pressable>

        <View style={styles.headingRow}>
          <View style={styles.heading}>
            <Text style={styles.eyebrow}>
              ADMINISTRATION
            </Text>

            <Text style={styles.title}>
              {isRequests
                ? "Demandes d’accès"
                : "Utilisateurs autorisés"}
            </Text>

            <Text style={styles.subtitle}>
              {isRequests
                ? "Vérifiez chaque demande, choisissez le rôle et configurez l’identité métier de la personne."
                : "Consultez et gérez les personnes autorisées à utiliser l’application."}
            </Text>
          </View>

          <View style={styles.totalCard}>
            <Text
              style={styles.totalLabel}
            >
              {isRequests
                ? "Demandes en attente"
                : "Utilisateurs"}
            </Text>

            <Text
              style={styles.totalValue}
            >
              {pagination.total}
            </Text>
          </View>
        </View>

        <View style={styles.searchCard}>
          <TextInput
            style={styles.searchInput}
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmitEditing={submitSearch}
            placeholder="Rechercher un nom, un e-mail, un code ou un UUID…"
            placeholderTextColor={
              colors.textMuted
            }
            returnKeyType="search"
            autoCorrect={false}
          />

          {searchInput ||
          activeSearch ? (
            <Pressable
              style={styles.clearButton}
              onPress={clearSearch}
            >
              <Text
                style={
                  styles.clearButtonText
                }
              >
                Effacer
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            style={styles.searchButton}
            onPress={submitSearch}
          >
            <Text
              style={
                styles.searchButtonText
              }
            >
              Rechercher
            </Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator
              size="large"
              color={brandBlue}
            />

            <Text
              style={styles.stateText}
            >
              Chargement…
            </Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.stateBox}>
            <Text
              style={styles.errorText}
            >
              {errorMessage}
            </Text>

            <Pressable
              style={styles.searchButton}
              onPress={loadUsers}
            >
              <Text
                style={
                  styles.searchButtonText
                }
              >
                Réessayer
              </Text>
            </Pressable>
          </View>
        ) : users.length === 0 ? (
          <View style={styles.stateBox}>
            <Text
              style={styles.emptyTitle}
            >
              {isRequests
                ? "Aucune demande en attente"
                : "Aucun utilisateur trouvé"}
            </Text>

            <Text
              style={styles.stateText}
            >
              {activeSearch
                ? "Essayez un autre mot-clé."
                : isRequests
                  ? "Les nouvelles demandes apparaîtront ici."
                  : "Les utilisateurs approuvés apparaîtront ici."}
            </Text>
          </View>
        ) : (
          <View style={styles.userList}>
            {users.map((user) => {
              const draft =
                drafts[user.user_id] ??
                createApprovalDraft(user);

              const isProcessing =
                processingUserId ===
                user.user_id;

              const isCurrentOwner =
                user.user_id ===
                currentUserId;

              return (
                <View
                  key={user.user_id}
                  style={styles.userCard}
                >
                  <View
                    style={
                      styles.userHeader
                    }
                  >
                    <View
                      style={
                        styles.userIdentity
                      }
                    >
                      <Text
                        style={
                          styles.userName
                        }
                      >
                        {user.displayName ||
                          user.fullName ||
                          "Nom non renseigné"}
                      </Text>

                      <Text
                        style={
                          styles.userEmail
                        }
                      >
                        {user.email ||
                          "E-mail indisponible"}
                      </Text>

                      <Text
                        style={
                          styles.userUuid
                        }
                      >
                        UUID :{" "}
                        {user.user_id}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        user.status ===
                        "approved"
                          ? styles.approvedBadge
                          : user.status ===
                              "suspended"
                            ? styles.suspendedBadge
                            : styles.pendingBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          user.status ===
                          "approved"
                            ? styles.approvedText
                            : user.status ===
                                "suspended"
                              ? styles.suspendedText
                              : styles.pendingText,
                        ]}
                      >
                        {user.status ===
                        "approved"
                          ? "Autorisé"
                          : user.status ===
                              "suspended"
                            ? "Suspendu"
                            : "En attente"}
                      </Text>
                    </View>
                  </View>

                  {isRequests ? (
                    <View
                      style={
                        styles.formSection
                      }
                    >
                      <Text
                        style={
                          styles.sectionLabel
                        }
                      >
                        Rôle dans l’application
                      </Text>

                      <View
                        style={
                          styles.roleOptions
                        }
                      >
                        {roles.map(
                          (role) => (
                            <Pressable
                              key={
                                role.value
                              }
                              style={[
                                styles.roleOption,
                                draft.role ===
                                  role.value &&
                                  styles.roleOptionSelected,
                              ]}
                              onPress={() =>
                                updateDraft(
                                  user.user_id,
                                  "role",
                                  role.value
                                )
                              }
                            >
                              <Text
                                style={[
                                  styles.roleOptionText,
                                  draft.role ===
                                    role.value &&
                                    styles.roleOptionTextSelected,
                                ]}
                              >
                                {role.label}
                              </Text>
                            </Pressable>
                          )
                        )}
                      </View>

                      <View
                        style={
                          styles.fieldsRow
                        }
                      >
                        <View
                          style={
                            styles.field
                          }
                        >
                          <Text
                            style={
                              styles.fieldLabel
                            }
                          >
                            Nom affiché
                          </Text>

                          <TextInput
                            style={
                              styles.fieldInput
                            }
                            value={
                              draft.displayName
                            }
                            onChangeText={(
                              value
                            ) =>
                              updateDraft(
                                user.user_id,
                                "displayName",
                                value
                              )
                            }
                            placeholder="Ex. Dorcas"
                            placeholderTextColor={
                              colors.textMuted
                            }
                          />
                        </View>

                        <View
                          style={
                            styles.field
                          }
                        >
                          <Text
                            style={
                              styles.fieldLabel
                            }
                          >
                            Code métier
                          </Text>

                          <TextInput
                            style={
                              styles.fieldInput
                            }
                            value={
                              draft.staffCode
                            }
                            onChangeText={(
                              value
                            ) =>
                              updateDraft(
                                user.user_id,
                                "staffCode",
                                value.toUpperCase()
                              )
                            }
                            placeholder="Ex. DORCAS"
                            placeholderTextColor={
                              colors.textMuted
                            }
                            autoCapitalize="characters"
                            autoCorrect={false}
                          />
                        </View>

                        <View
                          style={
                            styles.field
                          }
                        >
                          <Text
                            style={
                              styles.fieldLabel
                            }
                          >
                            Préfixe SKU
                          </Text>

                          <TextInput
                            style={
                              styles.fieldInput
                            }
                            value={
                              draft.skuPrefix
                            }
                            onChangeText={(
                              value
                            ) =>
                              updateDraft(
                                user.user_id,
                                "skuPrefix",
                                value.toUpperCase()
                              )
                            }
                            placeholder="Ex. DORCAS"
                            placeholderTextColor={
                              colors.textMuted
                            }
                            autoCapitalize="characters"
                            autoCorrect={false}
                          />
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View
                      style={
                        styles.detailsGrid
                      }
                    >
                      <View
                        style={
                          styles.detailItem
                        }
                      >
                        <Text
                          style={
                            styles.detailLabel
                          }
                        >
                          Rôle
                        </Text>
                        <Text
                          style={
                            styles.detailValue
                          }
                        >
                          {user.role ===
                          "owner"
                            ? "Propriétaire"
                            : roleLabels[
                                user.role
                              ] ||
                              user.role}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.detailItem
                        }
                      >
                        <Text
                          style={
                            styles.detailLabel
                          }
                        >
                          Code métier
                        </Text>
                        <Text
                          style={
                            styles.detailValue
                          }
                        >
                          {user.staffCode ||
                            "—"}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.detailItem
                        }
                      >
                        <Text
                          style={
                            styles.detailLabel
                          }
                        >
                          Préfixe SKU
                        </Text>
                        <Text
                          style={
                            styles.detailValue
                          }
                        >
                          {user.skuPrefix ||
                            "—"}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.detailItem
                        }
                      >
                        <Text
                          style={
                            styles.detailLabel
                          }
                        >
                          Autorisé le
                        </Text>
                        <Text
                          style={
                            styles.detailValue
                          }
                        >
                          {formatDate(
                            user.approved_at
                          )}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View
                    style={styles.actionsRow}
                  >
                    {isRequests ? (
                      <>
                        <Pressable
                          disabled={isProcessing}
                          style={[
                            styles.primaryButton,
                            isProcessing &&
                              styles.disabled,
                          ]}
                          onPress={() =>
                            approveRequest(
                              user
                            )
                          }
                        >
                          <Text
                            style={
                              styles.primaryButtonText
                            }
                          >
                            {isProcessing
                              ? "Traitement…"
                              : "Approuver l’accès"}
                          </Text>
                        </Pressable>

                        <Pressable
                          disabled={isProcessing}
                          style={[
                            styles.dangerButton,
                            isProcessing &&
                              styles.disabled,
                          ]}
                          onPress={() =>
                            confirmAction(
                              user,
                              "revoke"
                            )
                          }
                        >
                          <Text
                            style={
                              styles.dangerButtonText
                            }
                          >
                            Refuser
                          </Text>
                        </Pressable>
                      </>
                    ) : isCurrentOwner ? (
                      <Text
                        style={
                          styles.ownerNote
                        }
                      >
                        Compte propriétaire principal
                      </Text>
                    ) : user.status ===
                      "suspended" ? (
                      <>
                        <Pressable
                          disabled={isProcessing}
                          style={[
                            styles.primaryButton,
                            isProcessing &&
                              styles.disabled,
                          ]}
                          onPress={() =>
                            confirmAction(
                              user,
                              "approve"
                            )
                          }
                        >
                          <Text
                            style={
                              styles.primaryButtonText
                            }
                          >
                            Réactiver
                          </Text>
                        </Pressable>

                        <Pressable
                          disabled={isProcessing}
                          style={[
                            styles.dangerButton,
                            isProcessing &&
                              styles.disabled,
                          ]}
                          onPress={() =>
                            confirmAction(
                              user,
                              "revoke"
                            )
                          }
                        >
                          <Text
                            style={
                              styles.dangerButtonText
                            }
                          >
                            Révoquer
                          </Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <Pressable
                          disabled={isProcessing}
                          style={[
                            styles.secondaryButton,
                            isProcessing &&
                              styles.disabled,
                          ]}
                          onPress={() =>
                            confirmAction(
                              user,
                              "suspend"
                            )
                          }
                        >
                          <Text
                            style={
                              styles.secondaryButtonText
                            }
                          >
                            Suspendre
                          </Text>
                        </Pressable>

                        <Pressable
                          disabled={isProcessing}
                          style={[
                            styles.dangerButton,
                            isProcessing &&
                              styles.disabled,
                          ]}
                          onPress={() =>
                            confirmAction(
                              user,
                              "revoke"
                            )
                          }
                        >
                          <Text
                            style={
                              styles.dangerButtonText
                            }
                          >
                            Révoquer
                          </Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {!isLoading &&
        !errorMessage &&
        pagination.totalPages > 1 ? (
          <View style={styles.pagination}>
            <Pressable
              disabled={page <= 1}
              style={[
                styles.pageButton,
                page <= 1 &&
                  styles.disabled,
              ]}
              onPress={() =>
                setPage((value) =>
                  Math.max(1, value - 1)
                )
              }
            >
              <Text
                style={styles.pageButtonText}
              >
                Précédent
              </Text>
            </Pressable>

            <Text style={styles.pageText}>
              Page {pagination.page} sur{" "}
              {pagination.totalPages}
            </Text>

            <Pressable
              disabled={
                page >=
                pagination.totalPages
              }
              style={[
                styles.pageButton,
                page >=
                  pagination.totalPages &&
                  styles.disabled,
              ]}
              onPress={() =>
                setPage((value) =>
                  value + 1
                )
              }
            >
              <Text
                style={styles.pageButtonText}
              >
                Suivant
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const brandBlue =
  colors.brandBlue ?? "#1E6682";

const brandBlueDark =
  colors.brandBlueDark ?? "#154C61";

const brandBlueLight =
  colors.brandBlueLight ?? "#E7F1F5";

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    width: "100%",
    maxWidth: 1300,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    marginBottom: 18,
  },
  backButtonText: {
    color: brandBlueDark,
    fontSize: 15,
    fontWeight: "700",
  },
  headingRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 18,
    marginBottom: 22,
  },
  heading: {
    flex: 1,
    minWidth: 280,
    justifyContent: "center",
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 7,
  },
  title: {
    color: brandBlueDark,
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    maxWidth: 760,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  totalCard: {
    minWidth: 190,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 6,
    borderLeftColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  totalLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  totalValue: {
    color: brandBlueDark,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 5,
  },
  searchCard: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
  },
  searchInput: {
    flex: 1,
    minWidth: 250,
    minHeight: 46,
    color: colors.text,
    backgroundColor:
      colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    outlineStyle: "none",
  },
  clearButton: {
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 17,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor:
      colors.surfaceMuted,
  },
  clearButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  searchButton: {
    minHeight: 46,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: brandBlue,
  },
  searchButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  stateBox: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 30,
  },
  stateText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    color: brandBlueDark,
    fontSize: 18,
    fontWeight: "800",
  },
  userList: {
    gap: 16,
  },
  userCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 5,
    borderLeftColor: brandBlue,
    borderRadius: 16,
    padding: 20,
  },
  userHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 18,
  },
  userIdentity: {
    flex: 1,
    minWidth: 240,
  },
  userName: {
    color: brandBlueDark,
    fontSize: 19,
    fontWeight: "800",
  },
  userEmail: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  userUuid: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  approvedBadge: {
    backgroundColor:
      colors.successLight,
  },
  suspendedBadge: {
    backgroundColor:
      colors.dangerLight,
  },
  pendingBadge: {
    backgroundColor:
      colors.warningLight,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  approvedText: {
    color: colors.success,
  },
  suspendedText: {
    color: colors.danger,
  },
  pendingText: {
    color: colors.warning,
  },
  formSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 10,
  },
  roleOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  roleOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor:
      colors.surfaceMuted,
  },
  roleOptionSelected: {
    borderColor: brandBlue,
    backgroundColor: brandBlueLight,
  },
  roleOptionText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  roleOptionTextSelected: {
    color: brandBlueDark,
  },
  fieldsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  field: {
    flex: 1,
    minWidth: 210,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  fieldInput: {
    minHeight: 44,
    color: colors.text,
    backgroundColor:
      colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    paddingHorizontal: 12,
    fontSize: 14,
    outlineStyle: "none",
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
  },
  detailItem: {
    flex: 1,
    minWidth: 180,
    backgroundColor:
      colors.surfaceMuted,
    borderRadius: 10,
    padding: 12,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detailValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 5,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
  },
  primaryButton: {
    backgroundColor: brandBlue,
    borderRadius: 9,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor:
      colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 9,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  secondaryButtonText: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: "800",
  },
  dangerButton: {
    backgroundColor:
      colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 9,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  dangerButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "800",
  },
  ownerNote: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  pagination: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    marginTop: 20,
  },
  pageButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: brandBlue,
    borderRadius: 9,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  pageButtonText: {
    color: brandBlueDark,
    fontSize: 14,
    fontWeight: "800",
  },
  pageText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.4,
  },
});
