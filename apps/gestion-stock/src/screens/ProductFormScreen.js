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
  Controller,
  useForm,
} from "react-hook-form";

import { zodResolver } from
  "@hookform/resolvers/zod";

import { z } from "zod";

import {
  createProduct,
  getCategories,
} from "../services/stockService.js";

import { colors } from
  "../theme/colors.js";

const integerText = z
  .string()
  .trim()
  .min(1, "Ce champ est obligatoire")
  .regex(
    /^\d+$/,
    "Saisissez un nombre entier positif"
  );

const optionalPositiveInteger = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" ||
      (/^\d+$/.test(value) &&
        Number(value) > 0),
    "Saisissez un nombre entier supérieur à zéro"
  );

const optionalRating = z
  .string()
  .trim()
  .refine(
    (value) => {
      if (value === "") {
        return true;
      }

      const rating = Number(value);

      return (
        Number.isFinite(rating) &&
        rating >= 0 &&
        rating <= 5
      );
    },
    "La note doit être comprise entre 0 et 5"
  );

const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(
      1,
      "Le nom du parfum est obligatoire"
    )
    .max(150),

  brand: z
    .string()
    .trim()
    .max(100),

  categoryId: z
    .string()
    .uuid()
    .nullable(),

  description: z
    .string()
    .trim()
    .max(2000),

  internalComment: z
    .string()
    .trim()
    .max(2000),

  purchasePrice: integerText,
  salePrice: integerText,
  initialQuantity: integerText,
  lowStockThreshold: integerText,
  volumeMl: optionalPositiveInteger,
  adminRating: optionalRating,
});

function FormInput({
  control,
  name,
  label,
  error,
  placeholder,
  keyboardType = "default",
  multiline = false,
}) {
  return (
    <View
      style={[
        styles.field,
        multiline &&
          styles.fullWidthField,
      ]}
    >
      <Text style={styles.label}>
        {label}
      </Text>

      <Controller
        control={control}
        name={name}
        render={({
          field: {
            onChange,
            onBlur,
            value,
          },
        }) => (
          <TextInput
            style={[
              styles.input,
              multiline &&
                styles.multilineInput,
              error &&
                styles.inputError,
            ]}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            placeholderTextColor={
              colors.textMuted
            }
            keyboardType={keyboardType}
            multiline={multiline}
            textAlignVertical={
              multiline ? "top" : "center"
            }
            autoCorrect={false}
          />
        )}
      />

      {error ? (
        <Text style={styles.fieldError}>
          {error.message}
        </Text>
      ) : null}
    </View>
  );
}

export default function ProductFormScreen({
  onBack,
  onCreated,
}) {
  const [categories, setCategories] =
    useState([]);

  const [
    isLoadingCategories,
    setIsLoadingCategories,
  ] = useState(true);

  const [requestError, setRequestError] =
    useState("");

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      brand: "",
      categoryId: null,
      description: "",
      internalComment: "",
      purchasePrice: "",
      salePrice: "",
      initialQuantity: "0",
      lowStockThreshold: "5",
      volumeMl: "",
      adminRating: "",
    },
  });

  const selectedCategoryId =
    watch("categoryId");

  useEffect(() => {
    async function loadCategories() {
      try {
        const result =
          await getCategories({
            isActive: true,
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
          "Impossible de charger les catégories."
        );
      } finally {
        setIsLoadingCategories(
          false
        );
      }
    }

    loadCategories();
  }, []);

  async function submitProduct(values) {
    setRequestError("");

    try {
      const result =
        await createProduct({
          name: values.name.trim(),

          brand:
            values.brand.trim() ||
            null,

          categoryId:
            values.categoryId,

          description:
            values.description.trim() ||
            null,

          internalComment:
            values.internalComment
              .trim() || null,

          purchasePrice: Number(
            values.purchasePrice
          ),

          salePrice: Number(
            values.salePrice
          ),

          initialQuantity: Number(
            values.initialQuantity
          ),

          lowStockThreshold: Number(
            values.lowStockThreshold
          ),

          volumeMl:
            values.volumeMl === ""
              ? null
              : Number(
                  values.volumeMl
                ),

          adminRating:
            values.adminRating === ""
              ? null
              : Number(
                  values.adminRating
                ),
        });

      onCreated?.(result.product);
    } catch (error) {
      console.error(
        "Product creation error:",
        error
      );

      if (
        error?.message?.includes(
          "category"
        )
      ) {
        setRequestError(
          "La catégorie sélectionnée n’existe plus."
        );

        return;
      }

      setRequestError(
        error?.message ||
          "Impossible de créer le parfum."
      );
    }
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
            disabled={isSubmitting}
          >
            <Text
              style={
                styles.backButtonText
              }
            >
              ‹ Retour aux parfums
            </Text>
          </Pressable>
        </View>

        <View style={styles.heading}>
          <Text style={styles.eyebrow}>
            CATALOGUE JDE
          </Text>

          <Text style={styles.title}>
            Nouveau parfum
          </Text>

          <Text style={styles.subtitle}>
            Enregistrez les informations
            commerciales et le stock
            initial du parfum.
          </Text>
        </View>

        {requestError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {requestError}
            </Text>
          </View>
        ) : null}

        <View style={styles.formCard}>
          <Text
            style={styles.sectionTitle}
          >
            Informations principales
          </Text>

          <View style={styles.formGrid}>
            <FormInput
              control={control}
              name="name"
              label="Nom du parfum *"
              placeholder="Exemple : Sauvage"
              error={errors.name}
            />

            <FormInput
              control={control}
              name="brand"
              label="Marque"
              placeholder="Exemple : Dior"
              error={errors.brand}
            />
          </View>

          <View style={styles.categoryArea}>
            <Text style={styles.label}>
              Catégorie
            </Text>

            {isLoadingCategories ? (
              <ActivityIndicator
                color={colors.primary}
              />
            ) : (
              <View
                style={
                  styles.categoryList
                }
              >
                <Pressable
                  style={[
                    styles.categoryChip,
                    selectedCategoryId ===
                      null &&
                      styles.categoryChipSelected,
                  ]}
                  onPress={() =>
                    setValue(
                      "categoryId",
                      null,
                      {
                        shouldValidate:
                          true,
                      }
                    )
                  }
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      selectedCategoryId ===
                        null &&
                        styles.categoryChipTextSelected,
                    ]}
                  >
                    Sans catégorie
                  </Text>
                </Pressable>

                {categories.map(
                  (category) => {
                    const isSelected =
                      selectedCategoryId ===
                      category.id;

                    return (
                      <Pressable
                        key={category.id}
                        style={[
                          styles.categoryChip,
                          isSelected &&
                            styles.categoryChipSelected,
                        ]}
                        onPress={() =>
                          setValue(
                            "categoryId",
                            category.id,
                            {
                              shouldValidate:
                                true,
                            }
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            isSelected &&
                              styles.categoryChipTextSelected,
                          ]}
                        >
                          {category.name}
                        </Text>
                      </Pressable>
                    );
                  }
                )}
              </View>
            )}
          </View>

          <View style={styles.divider} />

          <Text
            style={styles.sectionTitle}
          >
            Prix et stock
          </Text>

          <View style={styles.formGrid}>
            <FormInput
              control={control}
              name="purchasePrice"
              label="Prix d’achat (FCFA) *"
              placeholder="350000"
              keyboardType="numeric"
              error={
                errors.purchasePrice
              }
            />

            <FormInput
              control={control}
              name="salePrice"
              label="Prix de vente (FCFA) *"
              placeholder="500000"
              keyboardType="numeric"
              error={errors.salePrice}
            />

            <FormInput
              control={control}
              name="initialQuantity"
              label="Stock initial *"
              placeholder="0"
              keyboardType="numeric"
              error={
                errors.initialQuantity
              }
            />

            <FormInput
              control={control}
              name="lowStockThreshold"
              label="Seuil de stock faible *"
              placeholder="5"
              keyboardType="numeric"
              error={
                errors.lowStockThreshold
              }
            />

            <FormInput
              control={control}
              name="volumeMl"
              label="Volume (ml)"
              placeholder="100"
              keyboardType="numeric"
              error={errors.volumeMl}
            />

            <FormInput
              control={control}
              name="adminRating"
              label="Note administrative / 5"
              placeholder="4.5"
              keyboardType="decimal-pad"
              error={errors.adminRating}
            />
          </View>

          <View style={styles.divider} />

          <Text
            style={styles.sectionTitle}
          >
            Descriptions
          </Text>

          <View style={styles.formGrid}>
            <FormInput
              control={control}
              name="description"
              label="Description publique"
              placeholder="Description visible dans le catalogue…"
              multiline
              error={errors.description}
            />

            <FormInput
              control={control}
              name="internalComment"
              label="Commentaire interne"
              placeholder="Informations réservées à l’administration…"
              multiline
              error={
                errors.internalComment
              }
            />
          </View>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.pressed,
              ]}
              onPress={onBack}
              disabled={isSubmitting}
            >
              <Text
                style={
                  styles.cancelButtonText
                }
              >
                Annuler
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.pressed,
                isSubmitting &&
                  styles.disabledButton,
              ]}
              onPress={handleSubmit(
                submitProduct
              )}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
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
                  Enregistrer le parfum
                </Text>
              )}
            </Pressable>
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
    maxWidth: 1050,
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
  },

  formCard: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  sectionTitle: {
    marginBottom: 17,
    color: colors.primaryDark,
    fontSize: 20,
    fontWeight: "800",
  },

  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 17,
  },

  field: {
    flexGrow: 1,
    flexBasis: 300,
    gap: 7,
  },

  fullWidthField: {
    flexBasis: "100%",
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
    color: colors.danger,
    fontSize: 12,
  },

  categoryArea: {
    marginTop: 18,
    gap: 10,
  },

  categoryList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },

  categoryChip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  categoryChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },

  categoryChipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },

  categoryChipTextSelected: {
    color: colors.textOnPrimary,
  },

  divider: {
    height: 1,
    marginVertical: 27,
    backgroundColor: colors.border,
  },

  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 11,
    marginTop: 29,
  },

  cancelButton: {
    minHeight: 51,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 21,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.primary,
  },

  cancelButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },

  submitButton: {
    minHeight: 51,
    minWidth: 190,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 21,
    borderRadius: 11,
    backgroundColor: colors.primary,
  },

  submitButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  errorBox: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },

  errorText: {
    color: colors.danger,
    fontSize: 14,
  },

  disabledButton: {
    opacity: 0.65,
  },

  pressed: {
    opacity: 0.83,
  },
});
