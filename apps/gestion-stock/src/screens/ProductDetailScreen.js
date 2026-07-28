import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import {
  deleteProduct,
  getCategories,
  getProduct,
  getProductSuppliers,
} from "../services/stockService.js";

import { colors } from
  "../theme/colors.js";

function formatCurrency(value) {
  return (
    new Intl.NumberFormat(
      "fr-FR"
    ).format(value ?? 0) + " FCFA"
  );
}

function formatDate(value) {
  if (!value) {
    return "Non renseignée";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(new Date(value));
}

function SummaryCell({
  label,
  value,
  highlight = false,
  tone = "default",
}) {
  return (
    <View style={styles.summaryCell}>
      <Text
        style={styles.summaryLabel}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.summaryValue,
          highlight &&
            styles.summaryValueHighlight,
          tone === "success" &&
            styles.summaryValueSuccess,
          tone === "warning" &&
            styles.summaryValueWarning,
          tone === "danger" &&
            styles.summaryValueDanger,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function SummaryRow({
  left,
  right,
  compact,
  alternate = false,
}) {
  return (
    <View
      style={[
        styles.summaryRow,
        alternate &&
          styles.summaryRowAlternate,
        compact &&
          styles.summaryRowCompact,
      ]}
    >
      <SummaryCell {...left} />

      {right ? (
        <>
          <View
            style={[
              styles.summaryDivider,
              compact &&
                styles.summaryDividerCompact,
            ]}
          />

          <SummaryCell {...right} />
        </>
      ) : null}
    </View>
  );
}

export default function ProductDetailScreen({
  productId,
  initialProduct,
  onBack,
  onEdit,
  onSuppliers,
  onProductChanged,
  onDeleted,
}) {
  const { width } =
    useWindowDimensions();

  const isCompact =
    width < 720;

  const [product, setProduct] =
    useState(initialProduct ?? null);

  const [category, setCategory] =
    useState(null);

  const [suppliers, setSuppliers] =
    useState([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [
    showDeleteConfirmation,
    setShowDeleteConfirmation,
  ] = useState(false);

  const [isDeleting, setIsDeleting] =
    useState(false);

  const resolvedProductId =
    productId ?? initialProduct?.id;

  const loadProduct = useCallback(
    async () => {
      if (!resolvedProductId) {
        setErrorMessage(
          "Identifiant du parfum manquant."
        );

        setIsLoading(false);
        setIsRefreshing(false);

        return;
      }

      setErrorMessage("");

      try {
        const [
          productResult,
          categoriesResult,
          suppliersResult,
        ] = await Promise.all([
          getProduct(
            resolvedProductId
          ),

          getCategories({
            page: 1,
            limit: 100,
          }),

          getProductSuppliers(
            resolvedProductId
          ),
        ]);

        const loadedProduct =
          productResult.product;

        setProduct(loadedProduct);

        setSuppliers(
          suppliersResult.suppliers ??
            []
        );

        const selectedCategory =
          (
            categoriesResult.categories ??
            []
          ).find(
            (item) =>
              item.id ===
              loadedProduct.category_id
          ) ?? null;

        setCategory(selectedCategory);

        onProductChanged?.(
          loadedProduct
        );
      } catch (error) {
        console.error(
          "Product detail loading error:",
          error
        );

        setErrorMessage(
          error?.message ||
            "Impossible de charger la fiche du parfum."
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [
      onProductChanged,
      resolvedProductId,
    ]
  );

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  const stockQuantity =
    product?.stock_quantity ?? 0;

  const lowStockThreshold =
    product?.low_stock_threshold ?? 0;

  const unitMargin =
    (product?.sale_price ?? 0) -
    (product?.purchase_price ?? 0);

  const stockStatus =
    stockQuantity <= 0
      ? {
          label: "Rupture de stock",
          tone: "danger",
        }
      : stockQuantity <=
          lowStockThreshold
        ? {
            label: "Stock faible",
            tone: "warning",
          }
        : {
            label: "Disponible",
            tone: "success",
          };

  function refreshProduct() {
    setIsRefreshing(true);
    loadProduct();
  }

  async function confirmDeletion() {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage("");

    try {
      await deleteProduct(
        resolvedProductId
      );

      setShowDeleteConfirmation(false);
      onDeleted?.(product);
    } catch (error) {
      console.error(
        "Product deletion error:",
        error
      );

      setShowDeleteConfirmation(false);
      setErrorMessage(
        error?.message ||
          "Impossible de supprimer ce parfum."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading && !product) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />

        <Text style={styles.loadingText}>
          Chargement de la fiche…
        </Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.errorTitle}>
          Parfum indisponible
        </Text>

        <Text style={styles.loadingText}>
          {errorMessage}
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={onBack}
        >
          <Text
            style={
              styles.primaryButtonText
            }
          >
            Retour aux parfums
          </Text>
        </Pressable>
      </View>
    );
  }

  const images =
    product.images ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.scrollContent
      }
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refreshProduct}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
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
              ‹ Retour aux parfums
            </Text>
          </Pressable>

          <View style={styles.topActions}>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed &&
                  styles.pressed,
              ]}
              onPress={() =>
                onEdit?.(product)
              }
            >
              <Text
                style={
                  styles.secondaryButtonText
                }
              >
                ✎ Modifier
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.deleteButton,
                pressed &&
                  styles.pressed,
              ]}
              onPress={() =>
                setShowDeleteConfirmation(
                  true
                )
              }
            >
              <Text
                style={
                  styles.deleteButtonText
                }
              >
                Supprimer ce parfum
              </Text>
            </Pressable>
          </View>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>

            <Pressable
              onPress={loadProduct}
            >
              <Text
                style={styles.retryText}
              >
                Réessayer
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <View style={styles.imageArea}>
            {images.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.imageList
                }
              >
                {images.map((image) => (
                  <Image
                    key={image.id}
                    source={{
                      uri:
                        image.public_url,
                    }}
                    style={
                      styles.productImage
                    }
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            ) : (
              <View
                style={
                  styles.imagePlaceholder
                }
              >
                <Text
                  style={
                    styles.imagePlaceholderLetter
                  }
                >
                  {product.name
                    ?.charAt(0)
                    ?.toUpperCase() ??
                    "P"}
                </Text>

                <Text
                  style={
                    styles.imagePlaceholderText
                  }
                >
                  Aucune photo
                </Text>
              </View>
            )}
          </View>

          <View style={styles.heroContent}>
            <Text style={styles.brand}>
              {product.brand ||
                "Marque non renseignée"}
            </Text>

            <Text style={styles.title}>
              {product.name}
            </Text>

            <Text style={styles.sku}>
              {product.sku}
            </Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryHeading}>
              <Text
                style={styles.summaryTitle}
              >
                Tableau récapitulatif
              </Text>

              <Text
                style={styles.summarySubtitle}
              >
                Toutes les caractéristiques
                essentielles de ce parfum.
              </Text>
            </View>

            <View
              style={[
                styles.stockStatusBadge,
                stockStatus.tone ===
                  "success" &&
                  styles.stockStatusSuccess,
                stockStatus.tone ===
                  "warning" &&
                  styles.stockStatusWarning,
                stockStatus.tone ===
                  "danger" &&
                  styles.stockStatusDanger,
              ]}
            >
              <Text
                style={[
                  styles.stockStatusText,
                  stockStatus.tone ===
                    "success" &&
                    styles.summaryValueSuccess,
                  stockStatus.tone ===
                    "warning" &&
                    styles.summaryValueWarning,
                  stockStatus.tone ===
                    "danger" &&
                    styles.summaryValueDanger,
                ]}
              >
                {stockStatus.label}
              </Text>
            </View>
          </View>

          <View style={styles.summaryTable}>
            <SummaryRow
              compact={isCompact}
              left={{
                label: "Nom du parfum",
                value: product.name,
                highlight: true,
              }}
              right={{
                label: "Marque",
                value:
                  product.brand ||
                  "Non renseignée",
              }}
            />

            <SummaryRow
              compact={isCompact}
              alternate
              left={{
                label: "Code SKU",
                value:
                  product.sku ||
                  "Non renseigné",
              }}
              right={{
                label: "Catégorie",
                value:
                  category?.name ||
                  "Sans catégorie",
              }}
            />

            <SummaryRow
              compact={isCompact}
              left={{
                label: "Prix d’achat",
                value: formatCurrency(
                  product.purchase_price
                ),
              }}
              right={{
                label: "Prix de vente",
                value: formatCurrency(
                  product.sale_price
                ),
                highlight: true,
              }}
            />

            <SummaryRow
              compact={isCompact}
              alternate
              left={{
                label: "Marge unitaire",
                value:
                  formatCurrency(
                    unitMargin
                  ),
                tone:
                  unitMargin >= 0
                    ? "success"
                    : "danger",
              }}
              right={{
                label:
                  "Quantité disponible",
                value: `${stockQuantity} unité${
                  stockQuantity > 1
                    ? "s"
                    : ""
                }`,
                highlight: true,
              }}
            />

            <SummaryRow
              compact={isCompact}
              left={{
                label: "État du stock",
                value: stockStatus.label,
                tone: stockStatus.tone,
              }}
              right={{
                label:
                  "Seuil de stock faible",
                value: `${lowStockThreshold} unité${
                  lowStockThreshold > 1
                    ? "s"
                    : ""
                }`,
              }}
            />

            <SummaryRow
              compact={isCompact}
              alternate
              left={{
                label: "Volume",
                value: product.volume_ml
                  ? `${product.volume_ml} ml`
                  : "Non renseigné",
              }}
              right={{
                label: "Note interne",
                value:
                  product.admin_rating !==
                    null &&
                  product.admin_rating !==
                    undefined
                    ? `${product.admin_rating} / 5`
                    : "Non renseignée",
              }}
            />

            <SummaryRow
              compact={isCompact}
              left={{
                label: "Créé le",
                value: formatDate(
                  product.created_at
                ),
              }}
              right={{
                label:
                  "Dernière modification",
                value: formatDate(
                  product.updated_at
                ),
              }}
            />
          </View>

          {product.public_description ? (
            <View
              style={styles.descriptionRow}
            >
              <Text
                style={styles.summaryLabel}
              >
                Description
              </Text>

              <Text
                style={
                  styles.descriptionValue
                }
              >
                {
                  product.public_description
                }
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text
                style={styles.cardTitle}
              >
                Fournisseurs
              </Text>

              <Text
                style={
                  styles.sectionSubtitle
                }
              >
                {suppliers.length} fournisseur
                {suppliers.length > 1
                  ? "s"
                  : ""}{" "}
                associé
                {suppliers.length > 1
                  ? "s"
                  : ""}
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed &&
                  styles.pressed,
              ]}
              onPress={() =>
                onSuppliers?.(product)
              }
            >
              <Text
                style={
                  styles.secondaryButtonText
                }
              >
                Gérer
              </Text>
            </Pressable>
          </View>

          {suppliers.length === 0 ? (
            <Text style={styles.emptyText}>
              Aucun fournisseur associé.
            </Text>
          ) : (
            <View style={styles.simpleList}>
              {suppliers.map(
                (association) => (
                  <View
                    key={
                      association.supplier_id
                    }
                    style={
                      styles.simpleListItem
                    }
                  >
                    <View>
                      <Text
                        style={
                          styles.simpleListTitle
                        }
                      >
                        {association.supplier
                          ?.name ??
                          "Fournisseur"}
                      </Text>

                      <Text
                        style={
                          styles.simpleListSubtitle
                        }
                      >
                        {association.supplier_reference ||
                          "Aucune référence"}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.simpleListValue
                      }
                    >
                      {association.last_purchase_price !==
                      null
                        ? formatCurrency(
                            association.last_purchase_price
                          )
                        : "Prix non renseigné"}
                    </Text>
                  </View>
                )
              )}
            </View>
          )}
        </View>

      </View>

      <Modal
        visible={showDeleteConfirmation}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isDeleting) {
            setShowDeleteConfirmation(
              false
            );
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Supprimer ce parfum ?
            </Text>

            <Text
              style={styles.modalDescription}
            >
              « {product.name} » sera
              définitivement supprimé avec
              ses images, son historique de
              stock et ses associations aux
              fournisseurs.
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelButton}
                disabled={isDeleting}
                onPress={() =>
                  setShowDeleteConfirmation(
                    false
                  )
                }
              >
                <Text
                  style={
                    styles.modalCancelText
                  }
                >
                  Annuler
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modalDeleteButton,
                  isDeleting &&
                    styles.disabledButton,
                ]}
                disabled={isDeleting}
                onPress={confirmDeletion}
              >
                {isDeleting ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.white}
                  />
                ) : (
                  <Text
                    style={
                      styles.modalDeleteText
                    }
                  >
                    Supprimer définitivement
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    maxWidth: 1150,
    alignSelf: "center",
    paddingHorizontal: 20,
  },

  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
    padding: 20,
    backgroundColor: colors.background,
  },

  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
  },

  errorTitle: {
    color: colors.danger,
    fontSize: 23,
    fontWeight: "800",
  },

  topBar: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  topActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },

  backButton: {
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

  primaryButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 17,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },

  primaryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  secondaryButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 17,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },

  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },

  deleteButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 17,
    borderRadius: 10,
    backgroundColor: colors.danger,
  },

  deleteButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },

  errorBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },

  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 14,
  },

  retryText: {
    color: colors.danger,
    fontWeight: "800",
  },

  heroCard: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 25,
    marginTop: 27,
    padding: 24,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  imageArea: {
    flexGrow: 1,
    flexBasis: 340,
  },

  imageList: {
    gap: 12,
  },

  productImage: {
    width: 330,
    height: 330,
    borderRadius: 17,
    backgroundColor:
      colors.surfaceMuted,
  },

  imagePlaceholder: {
    minHeight: 330,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor:
      colors.primaryLight,
  },

  imagePlaceholderLetter: {
    color: colors.primary,
    fontSize: 88,
    fontWeight: "900",
  },

  imagePlaceholderText: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 13,
  },

  heroContent: {
    flexGrow: 1,
    flexBasis: 340,
    justifyContent: "center",
  },

  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },

  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },

  brand: {
    marginTop: 20,
    color: colors.secondaryDark,
    fontSize: 14,
    fontWeight: "700",
  },

  title: {
    marginTop: 5,
    color: colors.primaryDark,
    fontSize: 37,
    fontWeight: "900",
  },

  sku: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },

  rating: {
    marginTop: 14,
    color: colors.gold,
    fontSize: 17,
    fontWeight: "800",
  },

  description: {
    marginTop: 18,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
  },

  summaryCard: {
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },

  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor:
      colors.primaryLight,
  },

  summaryHeading: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 190,
  },

  summaryTitle: {
    color: colors.primaryDark,
    fontSize: 21,
    fontWeight: "900",
  },

  summarySubtitle: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 13,
  },

  stockStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },

  stockStatusSuccess: {
    backgroundColor:
      colors.successLight,
  },

  stockStatusWarning: {
    backgroundColor:
      colors.warningLight,
  },

  stockStatusDanger: {
    backgroundColor:
      colors.dangerLight,
  },

  stockStatusText: {
    fontSize: 12,
    fontWeight: "900",
  },

  summaryTable: {
    width: "100%",
  },

  summaryRow: {
    minHeight: 82,
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  summaryRowAlternate: {
    backgroundColor:
      colors.inputBackground,
  },

  summaryRowCompact: {
    flexDirection: "column",
  },

  summaryCell: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },

  summaryDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: colors.border,
  },

  summaryDividerCompact: {
    width: "auto",
    height: 1,
    marginHorizontal: 20,
  },

  summaryLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },

  summaryValue: {
    marginTop: 5,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },

  summaryValueHighlight: {
    color: colors.primary,
    fontSize: 19,
  },

  summaryValueSuccess: {
    color: colors.success,
  },

  summaryValueWarning: {
    color: colors.warning,
  },

  summaryValueDanger: {
    color: colors.danger,
  },

  descriptionRow: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },

  descriptionValue: {
    marginTop: 7,
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
  },

  cardTitle: {
    marginBottom: 15,
    color: colors.primaryDark,
    fontSize: 19,
    fontWeight: "800",
  },

  stockAlert: {
    alignSelf: "flex-start",
    marginTop: 17,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },

  stockAlertText: {
    fontSize: 12,
    fontWeight: "800",
  },

  sectionCard: {
    marginTop: 16,
    padding: 20,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  sectionSubtitle: {
    marginTop: -9,
    color: colors.textMuted,
    fontSize: 13,
  },

  simpleList: {
    marginTop: 12,
  },

  simpleListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 15,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  simpleListTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },

  simpleListSubtitle: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
  },

  simpleListValue: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },

  movementQuantity: {
    fontSize: 17,
    fontWeight: "900",
  },

  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },

  commentText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
  },

  dangerZone: {
    marginTop: 16,
    padding: 20,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor:
      colors.dangerLight,
  },

  dangerTitle: {
    color: colors.danger,
    fontSize: 18,
    fontWeight: "800",
  },

  dangerDescription: {
    marginTop: 7,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 20,
  },

  archiveButton: {
    alignSelf: "flex-start",
    minHeight: 43,
    justifyContent: "center",
    marginTop: 14,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger,
  },

  archiveButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
  },

  confirmationActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },

  cancelArchiveButton: {
    minHeight: 43,
    justifyContent: "center",
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger,
  },

  cancelArchiveText: {
    color: colors.danger,
    fontWeight: "700",
  },

  confirmArchiveButton: {
    minHeight: 43,
    minWidth: 110,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: colors.danger,
  },

  confirmArchiveText: {
    color: colors.white,
    fontWeight: "800",
  },

  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor:
      "rgba(20, 16, 14, 0.58)",
  },

  modalCard: {
    width: "100%",
    maxWidth: 470,
    padding: 22,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },

  modalTitle: {
    color: colors.primaryDark,
    fontSize: 21,
    fontWeight: "900",
  },

  modalDescription: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 22,
  },

  modalCancelButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },

  modalCancelText: {
    color: colors.text,
    fontWeight: "800",
  },

  modalDeleteButton: {
    minHeight: 44,
    minWidth: 185,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.danger,
  },

  modalDeleteText: {
    color: colors.white,
    fontWeight: "900",
  },

  disabledButton: {
    opacity: 0.55,
  },

  pressed: {
    opacity: 0.82,
  },
});
