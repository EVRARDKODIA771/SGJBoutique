import {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  createSupplier,
  getSuppliers,
  updateSupplier,
} from "../services/stockService.js";

import { colors } from
  "../theme/colors.js";

function validateEmail(email) {
  if (!email.trim()) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email.trim()
  );
}

export default function SuppliersScreen({
  onBack,
}) {
  const [suppliers, setSuppliers] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [name, setName] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [address, setAddress] =
    useState("");

  const [comment, setComment] =
    useState("");

  const [
    editingSupplier,
    setEditingSupplier,
  ] = useState(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [
    changingStatusId,
    setChangingStatusId,
  ] = useState(null);

  const [requestError, setRequestError] =
    useState("");

  const [formError, setFormError] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  async function loadSuppliers({
    searchValue = search,
    showLoader = true,
  } = {}) {
    if (showLoader) {
      setIsLoading(true);
    }

    setRequestError("");

    try {
      const result =
        await getSuppliers({
          search:
            searchValue.trim() ||
            undefined,

          page: 1,
          limit: 100,
        });

      setSuppliers(
        result.suppliers ?? []
      );
    } catch (error) {
      console.error(
        "Suppliers loading error:",
        error
      );

      setRequestError(
        error?.message ||
          "Impossible de charger les fournisseurs."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSuppliers({
      searchValue: "",
    });
  }, []);

  function clearForm() {
    setName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setComment("");
    setEditingSupplier(null);
    setFormError("");
  }

  function editSupplier(supplier) {
    setEditingSupplier(supplier);

    setName(
      supplier.name ?? ""
    );

    setPhone(
      supplier.phone ?? ""
    );

    setEmail(
      supplier.email ?? ""
    );

    setAddress(
      supplier.address ?? ""
    );

    setComment(
      supplier.comment ?? ""
    );

    setFormError("");
    setRequestError("");
    setSuccessMessage("");
  }

  function validateForm() {
    if (!name.trim()) {
      return "Le nom du fournisseur est obligatoire.";
    }

    if (name.trim().length > 150) {
      return "Le nom ne peut pas dépasser 150 caractères.";
    }

    if (phone.trim().length > 50) {
      return "Le téléphone ne peut pas dépasser 50 caractères.";
    }

    if (
      email.trim().length > 254
    ) {
      return "L’adresse e-mail ne peut pas dépasser 254 caractères.";
    }

    if (!validateEmail(email)) {
      return "L’adresse e-mail n’est pas valide.";
    }

    if (
      address.trim().length > 500
    ) {
      return "L’adresse ne peut pas dépasser 500 caractères.";
    }

    if (
      comment.trim().length > 2000
    ) {
      return "Le commentaire ne peut pas dépasser 2000 caractères.";
    }

    return "";
  }

  async function saveSupplier() {
    setFormError("");
    setRequestError("");
    setSuccessMessage("");

    const validationError =
      validateForm();

    if (validationError) {
      setFormError(
        validationError
      );

      return;
    }

    const supplierData = {
      name: name.trim(),

      phone:
        phone.trim() || null,

      email:
        email.trim() || null,

      address:
        address.trim() || null,

      comment:
        comment.trim() || null,
    };

    setIsSaving(true);

    try {
      if (editingSupplier) {
        await updateSupplier(
          editingSupplier.id,
          supplierData
        );

        setSuccessMessage(
          "Le fournisseur a été mis à jour."
        );
      } else {
        await createSupplier(
          supplierData
        );

        setSuccessMessage(
          "Le fournisseur a été créé."
        );
      }

      clearForm();

      await loadSuppliers({
        showLoader: false,
      });
    } catch (error) {
      console.error(
        "Supplier save error:",
        error
      );

      setRequestError(
        error?.message ||
          "Impossible d’enregistrer le fournisseur."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function changeSupplierStatus(
    supplier
  ) {
    setChangingStatusId(
      supplier.id
    );

    setRequestError("");
    setSuccessMessage("");

    try {
      await updateSupplier(
        supplier.id,
        {
          isActive:
            !supplier.is_active,
        }
      );

      await loadSuppliers({
        showLoader: false,
      });

      setSuccessMessage(
        supplier.is_active
          ? "Le fournisseur a été désactivé."
          : "Le fournisseur a été réactivé."
      );

      if (
        editingSupplier?.id ===
        supplier.id
      ) {
        clearForm();
      }
    } catch (error) {
      console.error(
        "Supplier status error:",
        error
      );

      setRequestError(
        error?.message ||
          "Impossible de modifier le statut du fournisseur."
      );
    } finally {
      setChangingStatusId(null);
    }
  }

  function submitSearch() {
    loadSuppliers({
      searchValue: search,
    });
  }

  function clearSearch() {
    setSearch("");

    loadSuppliers({
      searchValue: "",
    });
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.scrollContent
      }
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            onPress={onBack}
          >
            <Text
              style={
                styles.backButtonText
              }
            >
              ‹ Retour au tableau de bord
            </Text>
          </Pressable>
        </View>

        <View style={styles.heading}>
          <Text style={styles.eyebrow}>
            FOURNISSEURS JDE
          </Text>

          <Text style={styles.title}>
            Gestion des fournisseurs
          </Text>

          <Text style={styles.subtitle}>
            Enregistrez les coordonnées
            des fournisseurs et gérez leur
            disponibilité.
          </Text>
        </View>

        {requestError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {requestError}
            </Text>
          </View>
        ) : null}

        {successMessage ? (
          <View style={styles.successBox}>
            <Text
              style={styles.successText}
            >
              {successMessage}
            </Text>
          </View>
        ) : null}

        <View style={styles.layout}>
          <View style={styles.formCard}>
            <Text
              style={styles.sectionTitle}
            >
              {editingSupplier
                ? "Modifier le fournisseur"
                : "Nouveau fournisseur"}
            </Text>

            <Text
              style={
                styles.sectionDescription
              }
            >
              Seul le nom est obligatoire.
              Les autres informations
              peuvent être ajoutées plus
              tard.
            </Text>

            <View style={styles.formGrid}>
              <View style={styles.field}>
                <Text style={styles.label}>
                  Nom du fournisseur *
                </Text>

                <TextInput
                  style={[
                    styles.input,
                    formError &&
                      !name.trim() &&
                      styles.inputError,
                  ]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Exemple : Fournisseur Abidjan"
                  placeholderTextColor={
                    colors.textMuted
                  }
                  maxLength={150}
                  autoCorrect={false}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>
                  Téléphone
                </Text>

                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+225 07 00 00 00 00"
                  placeholderTextColor={
                    colors.textMuted
                  }
                  keyboardType="phone-pad"
                  maxLength={50}
                  autoCorrect={false}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>
                  Adresse e-mail
                </Text>

                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="fournisseur@example.com"
                  placeholderTextColor={
                    colors.textMuted
                  }
                  keyboardType="email-address"
                  autoCapitalize="none"
                  maxLength={254}
                  autoCorrect={false}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>
                  Adresse
                </Text>

                <TextInput
                  style={[
                    styles.input,
                    styles.multilineInput,
                  ]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Ville, quartier et adresse…"
                  placeholderTextColor={
                    colors.textMuted
                  }
                  multiline
                  maxLength={500}
                  textAlignVertical="top"
                />

                <Text
                  style={
                    styles.characterCount
                  }
                >
                  {address.length}/500
                </Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>
                  Commentaire interne
                </Text>

                <TextInput
                  style={[
                    styles.input,
                    styles.commentInput,
                  ]}
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Informations complémentaires…"
                  placeholderTextColor={
                    colors.textMuted
                  }
                  multiline
                  maxLength={2000}
                  textAlignVertical="top"
                />

                <Text
                  style={
                    styles.characterCount
                  }
                >
                  {comment.length}/2000
                </Text>
              </View>
            </View>

            {formError ? (
              <Text
                style={styles.fieldError}
              >
                {formError}
              </Text>
            ) : null}

            <View style={styles.actions}>
              {editingSupplier ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.cancelButton,
                    pressed &&
                      styles.pressed,
                  ]}
                  onPress={clearForm}
                  disabled={isSaving}
                >
                  <Text
                    style={
                      styles.cancelButtonText
                    }
                  >
                    Annuler
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed &&
                    styles.pressed,
                  isSaving &&
                    styles.disabledButton,
                ]}
                onPress={saveSupplier}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator
                    color={
                      colors.textOnPrimary
                    }
                  />
                ) : (
                  <Text
                    style={
                      styles.submitButtonText
                    }
                  >
                    {editingSupplier
                      ? "Enregistrer les modifications"
                      : "Créer le fournisseur"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.listCard}>
            <Text
              style={styles.sectionTitle}
            >
              Fournisseurs enregistrés
            </Text>

            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={
                  submitSearch
                }
                placeholder="Rechercher un fournisseur…"
                placeholderTextColor={
                  colors.textMuted
                }
                returnKeyType="search"
              />

              <Pressable
                style={({ pressed }) => [
                  styles.searchButton,
                  pressed &&
                    styles.pressed,
                ]}
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

              {search ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.clearButton,
                    pressed &&
                      styles.pressed,
                  ]}
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
            </View>

            {isLoading ? (
              <View
                style={styles.loadingBox}
              >
                <ActivityIndicator
                  size="large"
                  color={colors.primary}
                />

                <Text
                  style={styles.loadingText}
                >
                  Chargement des
                  fournisseurs…
                </Text>
              </View>
            ) : suppliers.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text
                  style={styles.emptyTitle}
                >
                  Aucun fournisseur
                </Text>

                <Text
                  style={styles.emptyText}
                >
                  Créez un fournisseur ou
                  modifiez votre recherche.
                </Text>
              </View>
            ) : (
              <View
                style={styles.supplierList}
              >
                {suppliers.map(
                  (supplier) => {
                    const isChanging =
                      changingStatusId ===
                      supplier.id;

                    return (
                      <View
                        key={supplier.id}
                        style={
                          styles.supplierCard
                        }
                      >
                        <View
                          style={
                            styles.supplierHeader
                          }
                        >
                          <View
                            style={
                              styles.supplierIdentity
                            }
                          >
                            <Text
                              style={
                                styles.supplierName
                              }
                            >
                              {supplier.name}
                            </Text>

                            <Text
                              style={
                                supplier.is_active
                                  ? styles.activeStatus
                                  : styles.inactiveStatus
                              }
                            >
                              {supplier.is_active
                                ? "Actif"
                                : "Inactif"}
                            </Text>
                          </View>
                        </View>

                        <View
                          style={
                            styles.contactGrid
                          }
                        >
                          <View
                            style={
                              styles.contactItem
                            }
                          >
                            <Text
                              style={
                                styles.contactLabel
                              }
                            >
                              Téléphone
                            </Text>

                            <Text
                              style={
                                styles.contactValue
                              }
                            >
                              {supplier.phone ||
                                "Non renseigné"}
                            </Text>
                          </View>

                          <View
                            style={
                              styles.contactItem
                            }
                          >
                            <Text
                              style={
                                styles.contactLabel
                              }
                            >
                              E-mail
                            </Text>

                            <Text
                              style={
                                styles.contactValue
                              }
                            >
                              {supplier.email ||
                                "Non renseigné"}
                            </Text>
                          </View>

                          <View
                            style={
                              styles.contactItem
                            }
                          >
                            <Text
                              style={
                                styles.contactLabel
                              }
                            >
                              Adresse
                            </Text>

                            <Text
                              style={
                                styles.contactValue
                              }
                            >
                              {supplier.address ||
                                "Non renseignée"}
                            </Text>
                          </View>
                        </View>

                        {supplier.comment ? (
                          <View
                            style={
                              styles.commentBox
                            }
                          >
                            <Text
                              style={
                                styles.contactLabel
                              }
                            >
                              Commentaire
                            </Text>

                            <Text
                              style={
                                styles.commentText
                              }
                            >
                              {supplier.comment}
                            </Text>
                          </View>
                        ) : null}

                        <View
                          style={
                            styles.cardActions
                          }
                        >
                          <Pressable
                            style={
                              styles.editButton
                            }
                            onPress={() =>
                              editSupplier(
                                supplier
                              )
                            }
                            disabled={
                              isChanging
                            }
                          >
                            <Text
                              style={
                                styles.editButtonText
                              }
                            >
                              Modifier
                            </Text>
                          </Pressable>

                          <Pressable
                            style={[
                              styles.statusButton,
                              supplier.is_active
                                ? styles.deactivateButton
                                : styles.activateButton,
                            ]}
                            onPress={() =>
                              changeSupplierStatus(
                                supplier
                              )
                            }
                            disabled={
                              isChanging
                            }
                          >
                            {isChanging ? (
                              <ActivityIndicator
                                size="small"
                                color={
                                  supplier.is_active
                                    ? colors.danger
                                    : "#34734A"
                                }
                              />
                            ) : (
                              <Text
                                style={[
                                  styles.statusButtonText,
                                  supplier.is_active
                                    ? styles.deactivateText
                                    : styles.activateText,
                                ]}
                              >
                                {supplier.is_active
                                  ? "Désactiver"
                                  : "Réactiver"}
                              </Text>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    );
                  }
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scrollContent: {
    paddingBottom: 45,
  },

  container: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 20,
  },

  topBar: {
    minHeight: 76,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  backButton: {
    alignSelf: "flex-start",
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  backButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },

  heading: {
    paddingTop: 31,
    paddingBottom: 23,
  },

  eyebrow: {
    color: colors.secondaryDark,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.3,
  },

  title: {
    marginTop: 6,
    color: colors.primaryDark,
    fontSize: 34,
    fontWeight: "800",
  },

  subtitle: {
    marginTop: 7,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },

  layout: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 20,
  },

  formCard: {
    flexGrow: 1,
    flexBasis: 380,
    maxWidth: 470,
    padding: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  listCard: {
    flexGrow: 1,
    flexBasis: 520,
    padding: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  sectionTitle: {
    color: colors.primaryDark,
    fontSize: 20,
    fontWeight: "800",
  },

  sectionDescription: {
    marginTop: 6,
    marginBottom: 5,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },

  formGrid: {
    gap: 2,
  },

  field: {
    gap: 7,
    marginTop: 15,
  },

  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },

  input: {
    minHeight: 51,
    paddingHorizontal: 14,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:
      colors.inputBackground,
    color: colors.text,
    fontSize: 15,
    outlineStyle: "none",
  },

  multilineInput: {
    minHeight: 92,
    paddingTop: 13,
    paddingBottom: 13,
  },

  commentInput: {
    minHeight: 110,
    paddingTop: 13,
    paddingBottom: 13,
  },

  inputError: {
    borderColor: colors.danger,
  },

  fieldError: {
    marginTop: 12,
    color: colors.danger,
    fontSize: 12,
  },

  characterCount: {
    alignSelf: "flex-end",
    color: colors.textMuted,
    fontSize: 11,
  },

  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 22,
  },

  cancelButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 17,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },

  cancelButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },

  submitButton: {
    minHeight: 48,
    minWidth: 175,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 17,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },

  submitButtonText: {
    color: colors.textOnPrimary,
    fontSize: 13,
    fontWeight: "800",
  },

  searchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 18,
    marginBottom: 18,
  },

  searchInput: {
    flexGrow: 1,
    flexBasis: 220,
    minHeight: 46,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:
      colors.inputBackground,
    color: colors.text,
    outlineStyle: "none",
  },

  searchButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },

  searchButtonText: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: "800",
  },

  clearButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },

  clearButtonText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },

  loadingBox: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 13,
  },

  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },

  supplierList: {
    gap: 11,
  },

  supplierCard: {
    padding: 16,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:
      colors.inputBackground,
  },

  supplierHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  supplierIdentity: {
    gap: 4,
  },

  supplierName: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: "800",
  },

  activeStatus: {
    color: "#34734A",
    fontSize: 11,
    fontWeight: "800",
  },

  inactiveStatus: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "800",
  },

  contactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 14,
  },

  contactItem: {
    flexGrow: 1,
    flexBasis: 170,
  },

  contactLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  contactValue: {
    marginTop: 4,
    color: colors.text,
    fontSize: 13,
  },

  commentBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor:
      colors.secondaryLight,
  },

  commentText: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },

  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 16,
  },

  editButton: {
    minHeight: 39,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 9,
    backgroundColor: colors.primary,
  },

  editButtonText: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: "800",
  },

  statusButton: {
    minHeight: 39,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 9,
    borderWidth: 1,
  },

  deactivateButton: {
    borderColor: colors.danger,
  },

  activateButton: {
    borderColor: "#34734A",
  },

  statusButtonText: {
    fontSize: 12,
    fontWeight: "800",
  },

  deactivateText: {
    color: colors.danger,
  },

  activateText: {
    color: "#34734A",
  },

  emptyBox: {
    alignItems: "center",
    padding: 25,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:
      colors.inputBackground,
  },

  emptyTitle: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "800",
  },

  emptyText: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },

  errorBox: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor:
      colors.dangerLight,
  },

  errorText: {
    color: colors.danger,
    fontSize: 14,
  },

  successBox: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#6B9A78",
    backgroundColor: "#EEF7F0",
  },

  successText: {
    color: "#34734A",
    fontSize: 14,
    fontWeight: "700",
  },

  disabledButton: {
    opacity: 0.58,
  },

  pressed: {
    opacity: 0.83,
  },
});
