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
  createCategory,
  getCategories,
  updateCategory,
} from "../services/stockService.js";

import { colors } from
  "../theme/colors.js";

export default function CategoriesScreen({
  onBack,
}) {
  const [categories, setCategories] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [name, setName] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [
    editingCategory,
    setEditingCategory,
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

  async function loadCategories({
    searchValue = search,
    showLoader = true,
  } = {}) {
    if (showLoader) {
      setIsLoading(true);
    }

    setRequestError("");

    try {
      const result =
        await getCategories({
          search:
            searchValue.trim() ||
            undefined,

          page: 1,
          limit: 100,
        });

      setCategories(
        result.categories ?? []
      );
    } catch (error) {
      console.error(
        "Categories loading error:",
        error
      );

      setRequestError(
        error?.message ||
          "Impossible de charger les catégories."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCategories({
      searchValue: "",
    });
  }, []);

  function clearForm() {
    setName("");
    setDescription("");
    setEditingCategory(null);
    setFormError("");
  }

  function editCategory(category) {
    setEditingCategory(category);
    setName(category.name ?? "");
    setDescription(
      category.description ?? ""
    );

    setFormError("");
    setRequestError("");
    setSuccessMessage("");
  }

  async function saveCategory() {
    setFormError("");
    setRequestError("");
    setSuccessMessage("");

    const cleanedName = name.trim();

    if (!cleanedName) {
      setFormError(
        "Le nom de la catégorie est obligatoire."
      );

      return;
    }

    if (cleanedName.length > 100) {
      setFormError(
        "Le nom ne peut pas dépasser 100 caractères."
      );

      return;
    }

    if (
      description.trim().length >
      1000
    ) {
      setFormError(
        "La description ne peut pas dépasser 1000 caractères."
      );

      return;
    }

    setIsSaving(true);

    try {
      if (editingCategory) {
        await updateCategory(
          editingCategory.id,
          {
            name: cleanedName,

            description:
              description.trim() ||
              null,
          }
        );

        setSuccessMessage(
          "La catégorie a été mise à jour."
        );
      } else {
        await createCategory({
          name: cleanedName,

          description:
            description.trim() ||
            null,
        });

        setSuccessMessage(
          "La catégorie a été créée."
        );
      }

      clearForm();

      await loadCategories({
        showLoader: false,
      });
    } catch (error) {
      console.error(
        "Category save error:",
        error
      );

      const errorMessage =
        error?.message ?? "";

      if (
        errorMessage
          .toLowerCase()
          .includes("already") ||
        errorMessage
          .toLowerCase()
          .includes("duplicate") ||
        errorMessage.includes("23505")
      ) {
        setFormError(
          "Une catégorie portant ce nom existe déjà."
        );

        return;
      }

      setRequestError(
        errorMessage ||
          "Impossible d’enregistrer la catégorie."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function changeCategoryStatus(
    category
  ) {
    setChangingStatusId(
      category.id
    );

    setRequestError("");
    setSuccessMessage("");

    try {
      await updateCategory(
        category.id,
        {
          isActive:
            !category.is_active,
        }
      );

      await loadCategories({
        showLoader: false,
      });

      setSuccessMessage(
        category.is_active
          ? "La catégorie a été désactivée."
          : "La catégorie a été réactivée."
      );

      if (
        editingCategory?.id ===
        category.id
      ) {
        clearForm();
      }
    } catch (error) {
      console.error(
        "Category status error:",
        error
      );

      setRequestError(
        error?.message ||
          "Impossible de modifier le statut de la catégorie."
      );
    } finally {
      setChangingStatusId(null);
    }
  }

  function submitSearch() {
    loadCategories({
      searchValue: search,
    });
  }

  function clearSearch() {
    setSearch("");

    loadCategories({
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
            CATALOGUE JDE
          </Text>

          <Text style={styles.title}>
            Gestion des catégories
          </Text>

          <Text style={styles.subtitle}>
            Organisez les parfums par
            catégorie et désactivez celles
            qui ne sont plus utilisées.
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
              {editingCategory
                ? "Modifier la catégorie"
                : "Nouvelle catégorie"}
            </Text>

            <Text
              style={
                styles.sectionDescription
              }
            >
              Le nom sera proposé dans les
              formulaires de création et de
              modification des parfums.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>
                Nom de la catégorie *
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
                placeholder="Exemple : Parfums pour femme"
                placeholderTextColor={
                  colors.textMuted
                }
                maxLength={100}
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                Description
              </Text>

              <TextInput
                style={[
                  styles.input,
                  styles.multilineInput,
                ]}
                value={description}
                onChangeText={
                  setDescription
                }
                placeholder="Description facultative…"
                placeholderTextColor={
                  colors.textMuted
                }
                multiline
                maxLength={1000}
                textAlignVertical="top"
              />

              <Text
                style={styles.characterCount}
              >
                {description.length}/1000
              </Text>
            </View>

            {formError ? (
              <Text
                style={styles.fieldError}
              >
                {formError}
              </Text>
            ) : null}

            <View style={styles.actions}>
              {editingCategory ? (
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
                onPress={saveCategory}
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
                    {editingCategory
                      ? "Enregistrer les modifications"
                      : "Créer la catégorie"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.listCard}>
            <Text
              style={styles.sectionTitle}
            >
              Catégories enregistrées
            </Text>

            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={
                  submitSearch
                }
                placeholder="Rechercher une catégorie…"
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
                  catégories…
                </Text>
              </View>
            ) : categories.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text
                  style={styles.emptyTitle}
                >
                  Aucune catégorie
                </Text>

                <Text
                  style={styles.emptyText}
                >
                  Créez une catégorie ou
                  modifiez votre recherche.
                </Text>
              </View>
            ) : (
              <View
                style={styles.categoryList}
              >
                {categories.map(
                  (category) => {
                    const isChanging =
                      changingStatusId ===
                      category.id;

                    return (
                      <View
                        key={category.id}
                        style={
                          styles.categoryCard
                        }
                      >
                        <View
                          style={
                            styles.categoryHeader
                          }
                        >
                          <View
                            style={
                              styles.categoryIdentity
                            }
                          >
                            <Text
                              style={
                                styles.categoryName
                              }
                            >
                              {category.name}
                            </Text>

                            <Text
                              style={
                                category.is_active
                                  ? styles.activeStatus
                                  : styles.inactiveStatus
                              }
                            >
                              {category.is_active
                                ? "Active"
                                : "Inactive"}
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={
                            styles.categoryDescription
                          }
                        >
                          {category.description ||
                            "Aucune description"}
                        </Text>

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
                              editCategory(
                                category
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
                              category.is_active
                                ? styles.deactivateButton
                                : styles.activateButton,
                            ]}
                            onPress={() =>
                              changeCategoryStatus(
                                category
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
                                  category.is_active
                                    ? colors.danger
                                    : "#34734A"
                                }
                              />
                            ) : (
                              <Text
                                style={[
                                  styles.statusButtonText,
                                  category.is_active
                                    ? styles.deactivateText
                                    : styles.activateText,
                                ]}
                              >
                                {category.is_active
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
    flexBasis: 360,
    maxWidth: 450,
    padding: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  listCard: {
    flexGrow: 1,
    flexBasis: 500,
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
    marginBottom: 18,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
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
    minHeight: 115,
    paddingTop: 13,
    paddingBottom: 13,
  },

  inputError: {
    borderColor: colors.danger,
  },

  fieldError: {
    marginTop: 10,
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
    minWidth: 170,
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

  categoryList: {
    gap: 11,
  },

  categoryCard: {
    padding: 16,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:
      colors.inputBackground,
  },

  categoryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  categoryIdentity: {
    gap: 4,
  },

  categoryName: {
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

  categoryDescription: {
    marginTop: 11,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },

  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 15,
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
