import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";

import {
  supabaseAdmin,
} from "../lib/supabaseAdmin.js";

import {
  authenticateUser,
} from "../middleware/authenticateUser.js";

import {
  requireApprovedAdmin,
} from "../middleware/requireApprovedAdmin.js";

import {
  requireCompanySession,
} from "../middleware/requireCompanySession.js";

const productRoutes = Router();

const PRODUCT_IMAGES_BUCKET =
  "product-images";

const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const imageExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const productImageUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },

  fileFilter(request, file, callback) {
    if (
      !allowedImageTypes.has(file.mimetype)
    ) {
      return callback(
        new Error("Unsupported image type")
      );
    }

    return callback(null, true);
  },
});

function uploadSingleProductImage(
  request,
  response,
  next
) {
  productImageUpload.single("image")(
    request,
    response,
    (error) => {
      if (!error) {
        return next();
      }

      if (
        error instanceof multer.MulterError &&
        error.code === "LIMIT_FILE_SIZE"
      ) {
        return response.status(400).json({
          success: false,
          error:
            "Image size must not exceed 5 MB",
        });
      }

      return response.status(400).json({
        success: false,
        error:
          error.message ===
          "Unsupported image type"
            ? "Only JPEG, PNG and WebP images are allowed"
            : "Unable to process the uploaded image",
      });
    }
  );
}

productRoutes.use(
  authenticateUser,
  requireApprovedAdmin(),
  requireCompanySession
);

/**
 * GET /api/admin/products
 * Retourne tous les parfums administrables.
 */
productRoutes.get(
  "/",
  async (request, response) => {
    try {
      const querySchema = z.object({
        search: z
          .string()
          .trim()
          .max(100)
          .optional(),

        page: z.coerce
          .number()
          .int()
          .min(1)
          .default(1),

        limit: z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20),
      });

      const validation =
        querySchema.safeParse(
          request.query
        );

      if (!validation.success) {
        return response.status(400).json({
          success: false,
          error:
            "Invalid query parameters",
          details:
            validation.error.flatten(),
        });
      }

      const {
        search,
        page,
        limit,
      } = validation.data;

      const start = (page - 1) * limit;
      const end = start + limit - 1;

      let databaseQuery = supabaseAdmin
        .from("products")
        .select("*", {
          count: "exact",
        })
        .range(start, end);

      if (search) {
        databaseQuery =
          databaseQuery.ilike(
            "name",
            `%${search}%`
          );
      }

      const {
        data: products,
        error,
        count,
      } = await databaseQuery;

      if (error) {
        console.error(
          "Products listing error:",
          error
        );

        return response.status(500).json({
          success: false,
          error:
            "Unable to retrieve products",
        });
      }

      return response.status(200).json({
        success: true,
        products: products ?? [],
        pagination: {
          page,
          limit,
          total: count ?? 0,
          totalPages: Math.ceil(
            (count ?? 0) / limit
          ),
        },
      });
    } catch (error) {
      console.error(
        "Products route error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to retrieve products",
      });
    }
  }
);

/**
 * GET /api/admin/products/sold
 * Retourne les parfums vendus, du plus récent au moins récent.
 *
 * La recherche porte notamment sur le nom, la marque, le SKU,
 * la date, la référence et la personne ayant enregistré la vente.
 */
productRoutes.get(
  "/sold",
  async (request, response) => {
    try {
      const querySchema = z.object({
        search: z
          .string()
          .trim()
          .max(150)
          .optional(),

        startDate: z
          .string()
          .datetime({ offset: true })
          .optional(),

        endDate: z
          .string()
          .datetime({ offset: true })
          .optional(),

        page: z.coerce
          .number()
          .int()
          .min(1)
          .default(1),

        limit: z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20),
      });

      const validation =
        querySchema.safeParse(
          request.query
        );

      if (!validation.success) {
        return response.status(400).json({
          success: false,
          error:
            "Invalid sales query parameters",
          details:
            validation.error.flatten(),
        });
      }

      const {
        search,
        startDate,
        endDate,
        page,
        limit,
      } = validation.data;

      if (
        startDate &&
        endDate &&
        new Date(startDate) >
          new Date(endDate)
      ) {
        return response.status(400).json({
          success: false,
          error:
            "Start date must be before end date",
        });
      }

      const {
        data,
        error,
      } = await request.auth.supabase.rpc(
        "search_product_movements",
        {
          movement_view: "sold",
          search_text: search ?? null,
          selected_supplier_id: null,
          start_date: startDate ?? null,
          end_date: endDate ?? null,
          page_number: page,
          page_size: limit,
        }
      );

      if (error) {
        console.error(
          "Sold products search error:",
          error
        );

        if (
          error.message?.includes(
            "Administrative access required"
          )
        ) {
          return response
            .status(403)
            .json({
              success: false,
              error:
                "Administrative access required",
            });
        }

        return response
          .status(500)
          .json({
            success: false,
            error:
              "Unable to retrieve sold products",
          });
      }

      return response.status(200).json({
        success: true,
        soldProducts: data?.items ?? [],
        pagination:
          data?.pagination ?? {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
      });
    } catch (error) {
      console.error(
        "Sold products route error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to retrieve sold products",
      });
    }
  }
);

/**
 * GET /api/admin/products/supplier-purchases
 * Retourne les parfums achetés chez les fournisseurs.
 *
 * supplierId permet d’afficher les achats d’un fournisseur précis.
 */
productRoutes.get(
  "/supplier-purchases",
  async (request, response) => {
    try {
      const querySchema = z.object({
        supplierId: z
          .string()
          .uuid("Invalid supplier ID")
          .optional(),

        search: z
          .string()
          .trim()
          .max(150)
          .optional(),

        startDate: z
          .string()
          .datetime({ offset: true })
          .optional(),

        endDate: z
          .string()
          .datetime({ offset: true })
          .optional(),

        page: z.coerce
          .number()
          .int()
          .min(1)
          .default(1),

        limit: z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20),
      });

      const validation =
        querySchema.safeParse(
          request.query
        );

      if (!validation.success) {
        return response.status(400).json({
          success: false,
          error:
            "Invalid supplier purchase query parameters",
          details:
            validation.error.flatten(),
        });
      }

      const {
        supplierId,
        search,
        startDate,
        endDate,
        page,
        limit,
      } = validation.data;

      if (
        startDate &&
        endDate &&
        new Date(startDate) >
          new Date(endDate)
      ) {
        return response.status(400).json({
          success: false,
          error:
            "Start date must be before end date",
        });
      }

      if (supplierId) {
        const {
          data: supplier,
          error: supplierError,
        } = await supabaseAdmin
          .from("suppliers")
          .select("id, name, is_active")
          .eq("id", supplierId)
          .maybeSingle();

        if (supplierError) {
          console.error(
            "Supplier verification error:",
            supplierError
          );

          return response
            .status(500)
            .json({
              success: false,
              error:
                "Unable to verify supplier",
            });
        }

        if (!supplier) {
          return response
            .status(404)
            .json({
              success: false,
              error: "Supplier not found",
            });
        }
      }

      const {
        data,
        error,
      } = await request.auth.supabase.rpc(
        "search_product_movements",
        {
          movement_view:
            "supplier_purchases",
          search_text: search ?? null,
          selected_supplier_id:
            supplierId ?? null,
          start_date: startDate ?? null,
          end_date: endDate ?? null,
          page_number: page,
          page_size: limit,
        }
      );

      if (error) {
        console.error(
          "Supplier purchases search error:",
          error
        );

        if (
          error.message?.includes(
            "Administrative access required"
          )
        ) {
          return response
            .status(403)
            .json({
              success: false,
              error:
                "Administrative access required",
            });
        }

        return response
          .status(500)
          .json({
            success: false,
            error:
              "Unable to retrieve supplier purchases",
          });
      }

      return response.status(200).json({
        success: true,
        purchases: data?.items ?? [],
        pagination:
          data?.pagination ?? {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
      });
    } catch (error) {
      console.error(
        "Supplier purchases route error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to retrieve supplier purchases",
      });
    }
  }
);

/**
 * GET /api/admin/products/low-stock
 * Retourne les parfums bientôt épuisés.
 */
productRoutes.get(
  "/low-stock",
  async (request, response) => {
    try {
      const querySchema = z.object({
        search: z
          .string()
          .trim()
          .max(150)
          .optional(),

        page: z.coerce
          .number()
          .int()
          .min(1)
          .default(1),

        limit: z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20),
      });

      const validation =
        querySchema.safeParse(
          request.query
        );

      if (!validation.success) {
        return response.status(400).json({
          success: false,
          error:
            "Invalid low stock query parameters",
          details:
            validation.error.flatten(),
        });
      }

      const {
        search,
        page,
        limit,
      } = validation.data;

      const {
        data,
        error,
      } = await request.auth.supabase.rpc(
        "search_stock_alert_products",
        {
          stock_view: "low",
          search_text: search ?? null,
          page_number: page,
          page_size: limit,
        }
      );

      if (error) {
        console.error(
          "Low stock products search error:",
          error
        );

        if (
          error.message?.includes(
            "Administrative access required"
          )
        ) {
          return response
            .status(403)
            .json({
              success: false,
              error:
                "Administrative access required",
            });
        }

        return response
          .status(500)
          .json({
            success: false,
            error:
              "Unable to retrieve low stock products",
          });
      }

      return response.status(200).json({
        success: true,
        products: data?.items ?? [],
        pagination:
          data?.pagination ?? {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
      });
    } catch (error) {
      console.error(
        "Low stock products route error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to retrieve low stock products",
      });
    }
  }
);

/**
 * GET /api/admin/products/out-of-stock
 * Retourne les parfums épuisés.
 */
productRoutes.get(
  "/out-of-stock",
  async (request, response) => {
    try {
      const querySchema = z.object({
        search: z
          .string()
          .trim()
          .max(150)
          .optional(),

        page: z.coerce
          .number()
          .int()
          .min(1)
          .default(1),

        limit: z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20),
      });

      const validation =
        querySchema.safeParse(
          request.query
        );

      if (!validation.success) {
        return response.status(400).json({
          success: false,
          error:
            "Invalid out of stock query parameters",
          details:
            validation.error.flatten(),
        });
      }

      const {
        search,
        page,
        limit,
      } = validation.data;

      const {
        data,
        error,
      } = await request.auth.supabase.rpc(
        "search_stock_alert_products",
        {
          stock_view: "out",
          search_text: search ?? null,
          page_number: page,
          page_size: limit,
        }
      );

      if (error) {
        console.error(
          "Out of stock products search error:",
          error
        );

        if (
          error.message?.includes(
            "Administrative access required"
          )
        ) {
          return response
            .status(403)
            .json({
              success: false,
              error:
                "Administrative access required",
            });
        }

        return response
          .status(500)
          .json({
            success: false,
            error:
              "Unable to retrieve out of stock products",
          });
      }

      return response.status(200).json({
        success: true,
        products: data?.items ?? [],
        pagination:
          data?.pagination ?? {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
      });
    } catch (error) {
      console.error(
        "Out of stock products route error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to retrieve out of stock products",
      });
    }
  }
);

/**
 * POST /api/admin/products
 * CrÃ©e un parfum et son stock initial.
 */
productRoutes.post(
  "/",
  async (request, response) => {
    try {
      const productSchema = z.object({
        name: z
          .string()
          .trim()
          .min(
            1,
            "Product name is required"
          )
          .max(150),

        brand: z
          .string()
          .trim()
          .max(100)
          .nullable()
          .optional(),

        categoryId: z
          .string()
          .uuid("Invalid category ID")
          .nullable()
          .optional(),

        supplierId: z
          .string()
          .uuid("Invalid supplier ID")
          .nullable()
          .optional(),

        supplierReference: z
          .string()
          .trim()
          .max(150)
          .nullable()
          .optional(),

        description: z
          .string()
          .trim()
          .max(2000)
          .nullable()
          .optional(),

        internalComment: z
          .string()
          .trim()
          .max(2000)
          .nullable()
          .optional(),

        purchasePrice: z
          .number()
          .int()
          .min(
            0,
            "Purchase price cannot be negative"
          ),

        salePrice: z
          .number()
          .int()
          .min(
            0,
            "Sale price cannot be negative"
          ),

        initialQuantity: z
          .number()
          .int()
          .min(
            0,
            "Initial quantity cannot be negative"
          ),

        lowStockThreshold: z
          .number()
          .int()
          .min(0)
          .default(5),

        volumeMl: z
          .number()
          .int()
          .positive()
          .nullable()
          .optional(),

        adminRating: z
          .number()
          .min(0)
          .max(5)
          .nullable()
          .optional(),
      });

      const validation =
        productSchema.safeParse(
          request.body
        );

      if (!validation.success) {
        return response.status(400).json({
          success: false,
          error: "Invalid product data",
          details:
            validation.error.flatten(),
        });
      }

      const product = validation.data;

      /*
       * Ce client transmet le JWT de
       * lâ€™utilisateur Ã  la fonction SQL.
       */
      const {
        data: createdProduct,
        error,
      } = await request.auth.supabase.rpc(
        "create_product",
        {
          product_name:
            product.name,

          product_brand:
            product.brand ?? null,

          product_category_id:
            product.categoryId ?? null,

          product_supplier_id:
            product.supplierId ?? null,

          product_supplier_reference:
            product.supplierReference ??
            null,

          product_description:
            product.description ?? null,

          product_internal_comment:
            product.internalComment ??
            null,

          product_purchase_price:
            product.purchasePrice,

          product_sale_price:
            product.salePrice,

          initial_quantity:
            product.initialQuantity,

          product_low_stock_threshold:
            product.lowStockThreshold,

          product_volume_ml:
            product.volumeMl ?? null,

          product_admin_rating:
            product.adminRating ?? null,

          product_status: "draft",
        }
      );

      if (error) {
        console.error(
          "Product creation error:",
          error
        );

        if (
          error.message?.includes(
            "Administrative access required"
          )
        ) {
          return response
            .status(403)
            .json({
              success: false,
              error:
                "Your administrative role does not allow product creation",
            });
        }

        if (
          error.code === "23503" ||
          error.message
            ?.toLowerCase()
            .includes("foreign key")
        ) {
          return response
            .status(400)
            .json({
              success: false,
              error:
                "The selected category does not exist",
            });
        }

        if (
          error.message?.includes(
            "Supplier not found"
          )
        ) {
          return response
            .status(404)
            .json({
              success: false,
              error:
                "The selected supplier does not exist",
            });
        }

        if (
          error.message?.includes(
            "Supplier is inactive"
          )
        ) {
          return response
            .status(409)
            .json({
              success: false,
              error:
                "The selected supplier is inactive",
            });
        }

        if (
          error.message?.includes(
            "Active staff profile required"
          ) ||
          error.message?.includes(
            "Staff business profile is not configured"
          )
        ) {
          return response
            .status(403)
            .json({
              success: false,
              error:
                "Your staff profile is not configured",
            });
        }

        if (
          error.message?.includes(
            "Supplier reference requires a supplier"
          )
        ) {
          return response
            .status(400)
            .json({
              success: false,
              error:
                "A supplier must be selected when a supplier reference is provided",
            });
        }

        return response
          .status(500)
          .json({
            success: false,
            error:
              "Unable to create product",
          });
      }

      return response.status(201).json({
        success: true,
        message:
          "Product created successfully",
        product: createdProduct,
      });
    } catch (error) {
      console.error(
        "Product creation route error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to create product",
      });
    }
  }
);

/**
 * POST /api/admin/products/:productId/images
 * Ajoute une image Ã  un parfum.
 *
 * La premiÃ¨re image devient automatiquement
 * lâ€™image principale.
 */
productRoutes.post(
  "/:productId/images",
  uploadSingleProductImage,
  async (request, response) => {
    let uploadedStoragePath = null;

    try {
      const parameterSchema = z.object({
        productId: z.string().uuid(),
      });

      const parameterValidation =
        parameterSchema.safeParse(
          request.params
        );

      if (
        !parameterValidation.success
      ) {
        return response
          .status(400)
          .json({
            success: false,
            error: "Invalid product ID",
          });
      }

      if (!request.file) {
        return response
          .status(400)
          .json({
            success: false,
            error:
              "An image file is required",
          });
      }

      const {
        productId,
      } = parameterValidation.data;

      const {
        data: product,
        error: productError,
      } = await supabaseAdmin
        .from("products")
        .select("id")
        .eq("id", productId)
        .maybeSingle();

      if (productError) {
        console.error(
          "Product verification error:",
          productError
        );

        return response
          .status(500)
          .json({
            success: false,
            error:
              "Unable to verify product",
          });
      }

      if (!product) {
        return response
          .status(404)
          .json({
            success: false,
            error: "Product not found",
          });
      }

      const {
        data: existingImages,
        error: imagesError,
      } = await supabaseAdmin
        .from("product_images")
        .select(
          "id, is_primary, display_order"
        )
        .eq("product_id", productId)
        .order("display_order", {
          ascending: true,
        });

      if (imagesError) {
        console.error(
          "Existing images retrieval error:",
          imagesError
        );

        return response
          .status(500)
          .json({
            success: false,
            error:
              "Unable to retrieve existing images",
          });
      }

      const images =
        existingImages ?? [];

      const isPrimary =
        images.length === 0;

      const highestDisplayOrder =
        images.length === 0
          ? -1
          : Math.max(
              ...images.map(
                (image) =>
                  image.display_order ??
                  0
              )
            );

      const displayOrder =
        highestDisplayOrder + 1;

      const extension =
        imageExtensions[
          request.file.mimetype
        ];

      uploadedStoragePath =
        `${productId}/` +
        `${randomUUID()}.${extension}`;

      const {
        error: uploadError,
      } = await supabaseAdmin.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .upload(
          uploadedStoragePath,
          request.file.buffer,
          {
            contentType:
              request.file.mimetype,
            cacheControl: "3600",
            upsert: false,
          }
        );

      if (uploadError) {
        console.error(
          "Product image upload error:",
          uploadError
        );

        return response
          .status(500)
          .json({
            success: false,
            error:
              "Unable to upload image",
          });
      }

      const {
        data: publicUrlData,
      } = supabaseAdmin.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .getPublicUrl(
          uploadedStoragePath
        );

      const {
        data: image,
        error: insertError,
      } = await supabaseAdmin
        .from("product_images")
        .insert({
          product_id: productId,
          storage_path:
            uploadedStoragePath,
          public_url:
            publicUrlData.publicUrl,
          is_primary: isPrimary,
          display_order: displayOrder,
          created_by:
            request.auth.user.id,
        })
        .select("*")
        .single();

      if (insertError) {
        console.error(
          "Product image record error:",
          insertError
        );

        await supabaseAdmin.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .remove([
            uploadedStoragePath,
          ]);

        uploadedStoragePath = null;

        return response
          .status(500)
          .json({
            success: false,
            error:
              "Unable to save image information",
          });
      }

      return response
        .status(201)
        .json({
          success: true,
          message:
            "Product image uploaded successfully",
          image,
        });
    } catch (error) {
      console.error(
        "Product image route error:",
        error
      );

      if (uploadedStoragePath) {
        await supabaseAdmin.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .remove([
            uploadedStoragePath,
          ]);
      }

      return response
        .status(500)
        .json({
          success: false,
          error:
            "Unable to upload image",
        });
    }
  }
);

/**
 * PATCH /api/admin/products/:productId
 * Modifie les informations dâ€™un parfum.
 *
 * Le stock ne peut pas Ãªtre modifiÃ© ici.
 */
productRoutes.patch(
  "/:productId",
  async (request, response) => {
    try {
      const parameterSchema = z.object({
        productId: z.string().uuid(),
      });

      const updateSchema = z
        .object({
          name: z
            .string()
            .trim()
            .min(1)
            .max(150)
            .optional(),

          brand: z
            .string()
            .trim()
            .max(100)
            .nullable()
            .optional(),

          categoryId: z
            .string()
            .uuid()
            .nullable()
            .optional(),

          description: z
            .string()
            .trim()
            .max(2000)
            .nullable()
            .optional(),

          internalComment: z
            .string()
            .trim()
            .max(2000)
            .nullable()
            .optional(),

          purchasePrice: z
            .number()
            .int()
            .min(0)
            .optional(),

          salePrice: z
            .number()
            .int()
            .min(0)
            .optional(),

          lowStockThreshold: z
            .number()
            .int()
            .min(0)
            .optional(),

          volumeMl: z
            .number()
            .int()
            .positive()
            .nullable()
            .optional(),

          adminRating: z
            .number()
            .min(0)
            .max(5)
            .nullable()
            .optional(),

          status: z
            .enum([
              "draft",
              "active",
            ])
            .optional(),
        })
        .strict();

      const parameterValidation =
        parameterSchema.safeParse(
          request.params
        );

      if (
        !parameterValidation.success
      ) {
        return response
          .status(400)
          .json({
            success: false,
            error: "Invalid product ID",
          });
      }

      const bodyValidation =
        updateSchema.safeParse(
          request.body
        );

      if (!bodyValidation.success) {
        return response
          .status(400)
          .json({
            success: false,
            error:
              "Invalid product data",
            details:
              bodyValidation.error.flatten(),
          });
      }

      if (
        Object.keys(
          bodyValidation.data
        ).length === 0
      ) {
        return response
          .status(400)
          .json({
            success: false,
            error:
              "At least one modification is required",
          });
      }

      const { productId } =
        parameterValidation.data;

      const update =
        bodyValidation.data;

      const productUpdates = {};

      if (update.name !== undefined) {
        productUpdates.name =
          update.name;
      }

      if (update.brand !== undefined) {
        productUpdates.brand =
          update.brand;
      }

      if (
        update.categoryId !== undefined
      ) {
        productUpdates.category_id =
          update.categoryId;
      }

      if (
        update.description !== undefined
      ) {
        productUpdates.public_description =
          update.description;
      }

      if (
        update.internalComment !==
        undefined
      ) {
        productUpdates.internal_comment =
          update.internalComment;
      }

      if (
        update.purchasePrice !== undefined
      ) {
        productUpdates.purchase_price =
          update.purchasePrice;
      }

      if (
        update.salePrice !== undefined
      ) {
        productUpdates.sale_price =
          update.salePrice;
      }

      if (
        update.lowStockThreshold !==
        undefined
      ) {
        productUpdates.low_stock_threshold =
          update.lowStockThreshold;
      }

      if (
        update.volumeMl !== undefined
      ) {
        productUpdates.volume_ml =
          update.volumeMl;
      }

      if (
        update.adminRating !== undefined
      ) {
        productUpdates.admin_rating =
          update.adminRating;
      }

      if (update.status !== undefined) {
        productUpdates.status =
          update.status;
      }

      const {
        data: updatedProduct,
        error,
      } = await request.auth.supabase.rpc(
        "update_product",
        {
          product_id: productId,
          product_updates:
            productUpdates,
        }
      );

      if (error) {
        console.error(
          "Product update error:",
          error
        );

        if (
          error.message?.includes(
            "Product not found"
          )
        ) {
          return response
            .status(404)
            .json({
              success: false,
              error: "Product not found",
            });
        }

        if (
          error.message?.includes(
            "Archived products cannot be modified"
          )
        ) {
          return response
            .status(409)
            .json({
              success: false,
              error:
                "Archived products cannot be modified",
            });
        }

        if (
          error.message?.includes(
            "Administrative access required"
          )
        ) {
          return response
            .status(403)
            .json({
              success: false,
              error:
                "Your administrative role does not allow this operation",
            });
        }

        if (
          error.code === "23503" ||
          error.message
            ?.toLowerCase()
            .includes("foreign key")
        ) {
          return response
            .status(400)
            .json({
              success: false,
              error:
                "The selected category does not exist",
            });
        }

        return response
          .status(500)
          .json({
            success: false,
            error:
              "Unable to update product",
          });
      }

      return response.status(200).json({
        success: true,
        message:
          "Product updated successfully",
        product: updatedProduct,
      });
    } catch (error) {
      console.error(
        "Product update route error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to update product",
      });
    }
  }
);

/**
 * PATCH /api/admin/products/:productId/archive
 * Archive un parfum sans le supprimer.
 */
productRoutes.patch(
  "/:productId/archive",
  async (request, response) => {
    try {
      const parameterSchema = z.object({
        productId: z.string().uuid(),
      });

      const validation =
        parameterSchema.safeParse(
          request.params
        );

      if (!validation.success) {
        return response
          .status(400)
          .json({
            success: false,
            error: "Invalid product ID",
          });
      }

      const { productId } =
        validation.data;

      const {
        data: archivedProduct,
        error,
      } = await request.auth.supabase.rpc(
        "archive_product",
        {
          product_id: productId,
        }
      );

      if (error) {
        console.error(
          "Product archive error:",
          error
        );

        if (
          error.message?.includes(
            "Product not found"
          )
        ) {
          return response
            .status(404)
            .json({
              success: false,
              error: "Product not found",
            });
        }

        if (
          error.message?.includes(
            "Product is already archived"
          )
        ) {
          return response
            .status(409)
            .json({
              success: false,
              error:
                "Product is already archived",
            });
        }

        if (
          error.message?.includes(
            "Administrative access required"
          )
        ) {
          return response
            .status(403)
            .json({
              success: false,
              error:
                "Your administrative role does not allow product archiving",
            });
        }

        return response
          .status(500)
          .json({
            success: false,
            error:
              "Unable to archive product",
          });
      }

      return response.status(200).json({
        success: true,
        message:
          "Product archived successfully",
        product: archivedProduct,
      });
    } catch (error) {
      console.error(
        "Product archive route error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to archive product",
      });
    }
  }
);

/**
 * POST /api/admin/products/:productId/stock-movements
 * Enregistre un mouvement de stock.
 *
 * La quantitÃ© reÃ§ue par lâ€™API est toujours positive.
 * Le backend dÃ©termine automatiquement son signe.
 */
productRoutes.post(
  "/:productId/stock-movements",
  async (request, response) => {
    try {
      const parameterSchema = z.object({
        productId: z.string().uuid(),
      });

      const movementSchema = z
        .object({
          movementType: z.enum([
            "purchase",
            "sale",
            "return",
            "damage",
            "loss",
            "adjustment",
          ]),

          quantity: z
            .number()
            .int()
            .positive(),

          supplierId: z
            .string()
            .uuid(
              "Invalid supplier ID"
            )
            .nullable()
            .optional(),

          unitPrice: z
            .number()
            .int()
            .min(
              0,
              "Unit price cannot be negative"
            )
            .nullable()
            .optional(),

          adjustmentDirection: z
            .enum([
              "increase",
              "decrease",
            ])
            .optional(),

          reason: z
            .string()
            .trim()
            .max(500)
            .nullable()
            .optional(),

          reference: z
            .string()
            .trim()
            .max(100)
            .nullable()
            .optional(),
        })
        .strict()
        .superRefine((movement, context) => {
          if (
            movement.movementType ===
              "adjustment" &&
            !movement.adjustmentDirection
          ) {
            context.addIssue({
              code: "custom",
              path: [
                "adjustmentDirection",
              ],
              message:
                "Adjustment direction is required",
            });
          }

          if (
            movement.movementType !==
              "adjustment" &&
            movement.adjustmentDirection !==
              undefined
          ) {
            context.addIssue({
              code: "custom",
              path: [
                "adjustmentDirection",
              ],
              message:
                "Adjustment direction is only allowed for adjustments",
            });
          }

          if (
            movement.movementType ===
              "purchase" &&
            !movement.supplierId
          ) {
            context.addIssue({
              code: "custom",
              path: ["supplierId"],
              message:
                "A supplier is required for a purchase",
            });
          }

          if (
            movement.movementType !==
              "purchase" &&
            movement.supplierId
          ) {
            context.addIssue({
              code: "custom",
              path: ["supplierId"],
              message:
                "A supplier can only be selected for a purchase",
            });
          }
        });

      const parameterValidation =
        parameterSchema.safeParse(
          request.params
        );

      if (
        !parameterValidation.success
      ) {
        return response
          .status(400)
          .json({
            success: false,
            error: "Invalid product ID",
          });
      }

      const movementValidation =
        movementSchema.safeParse(
          request.body
        );

      if (!movementValidation.success) {
        return response
          .status(400)
          .json({
            success: false,
            error:
              "Invalid stock movement data",
            details:
              movementValidation.error.flatten(),
          });
      }

      const { productId } =
        parameterValidation.data;

      const movement =
        movementValidation.data;

      let quantityDelta =
        movement.quantity;

      if (
        [
          "sale",
          "damage",
          "loss",
        ].includes(movement.movementType)
      ) {
        quantityDelta =
          -movement.quantity;
      }

      if (
        movement.movementType ===
          "adjustment" &&
        movement.adjustmentDirection ===
          "decrease"
      ) {
        quantityDelta =
          -movement.quantity;
      }

      const {
        data: updatedProduct,
        error,
      } = await request.auth.supabase.rpc(
        "record_stock_movement",
        {
          target_product_id:
            productId,
          target_movement_type:
            movement.movementType,
          quantity_delta:
            quantityDelta,
          movement_reason:
            movement.reason ?? null,
          movement_reference:
            movement.reference ?? null,

          target_supplier_id:
            movement.supplierId ?? null,

          movement_unit_price:
            movement.unitPrice ?? null,
        }
      );

      if (error) {
        console.error(
          "Stock movement error:",
          error
        );

        if (
          error.message?.includes(
            "Product not found"
          )
        ) {
          return response
            .status(404)
            .json({
              success: false,
              error: "Product not found",
            });
        }

        if (
          error.message?.includes(
            "Insufficient stock"
          )
        ) {
          return response
            .status(409)
            .json({
              success: false,
              error:
                "Insufficient stock",
            });
        }

        if (
          error.message?.includes(
            "Administrative access required"
          )
        ) {
          return response
            .status(403)
            .json({
              success: false,
              error:
                "Your administrative role does not allow stock movements",
            });
        }

        if (
          error.message?.includes(
            "Supplier not found"
          )
        ) {
          return response
            .status(404)
            .json({
              success: false,
              error: "Supplier not found",
            });
        }

        if (
          error.message?.includes(
            "Supplier is inactive"
          )
        ) {
          return response
            .status(409)
            .json({
              success: false,
              error: "Supplier is inactive",
            });
        }

        return response
          .status(500)
          .json({
            success: false,
            error:
              "Unable to record stock movement",
          });
      }

      return response.status(201).json({
        success: true,
        message:
          "Stock movement recorded successfully",
        movement: {
          type: movement.movementType,
          quantityChange:
            quantityDelta,
          reason:
            movement.reason ?? null,
          reference:
            movement.reference ?? null,

          supplierId:
            movement.supplierId ?? null,

          unitPrice:
            movement.unitPrice ?? null,
        },
        product: updatedProduct,
      });
    } catch (error) {
      console.error(
        "Stock movement route error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to record stock movement",
      });
    }
  }
);

/**
 * GET /api/admin/products/:productId/stock-movements
 * Retourne lâ€™historique paginÃ© du stock.
 */
productRoutes.get(
  "/:productId/stock-movements",
  async (request, response) => {
    try {
      const parameterSchema = z.object({
        productId: z.string().uuid(),
      });

      const querySchema = z.object({
        page: z.coerce
          .number()
          .int()
          .min(1)
          .default(1),

        limit: z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20),
      });

      const parameterValidation =
        parameterSchema.safeParse(
          request.params
        );

      if (
        !parameterValidation.success
      ) {
        return response
          .status(400)
          .json({
            success: false,
            error: "Invalid product ID",
          });
      }

      const queryValidation =
        querySchema.safeParse(
          request.query
        );

      if (!queryValidation.success) {
        return response
          .status(400)
          .json({
            success: false,
            error:
              "Invalid query parameters",
            details:
              queryValidation.error.flatten(),
          });
      }

      const { productId } =
        parameterValidation.data;

      const {
        page,
        limit,
      } = queryValidation.data;

      const start =
        (page - 1) * limit;
      const end = start + limit - 1;

      const {
        data: product,
        error: productError,
      } = await supabaseAdmin
        .from("products")
        .select("id")
        .eq("id", productId)
        .maybeSingle();

      if (productError) {
        console.error(
          "Product verification error:",
          productError
        );

        return response
          .status(500)
          .json({
            success: false,
            error:
              "Unable to verify product",
          });
      }

      if (!product) {
        return response
          .status(404)
          .json({
            success: false,
            error: "Product not found",
          });
      }

      const {
        data: movements,
        error,
        count,
      } = await supabaseAdmin
        .from("stock_movements")
        .select("*", {
          count: "exact",
        })
        .eq("product_id", productId)
        .order("created_at", {
          ascending: false,
        })
        .range(start, end);

      if (error) {
        console.error(
          "Stock history error:",
          error
        );

        return response
          .status(500)
          .json({
            success: false,
            error:
              "Unable to retrieve stock history",
          });
      }

      return response.status(200).json({
        success: true,
        movements: movements ?? [],
        pagination: {
          page,
          limit,
          total: count ?? 0,
          totalPages: Math.ceil(
            (count ?? 0) / limit
          ),
        },
      });
    } catch (error) {
      console.error(
        "Stock history route error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to retrieve stock history",
      });
    }
  }
);

/**
 * GET /api/admin/products/:productId
 * Retourne un parfum prÃ©cis avec ses images.
 */
productRoutes.get(
  "/:productId",
  async (request, response) => {
    try {
      const parameterSchema = z.object({
        productId: z.string().uuid(),
      });

      const validation =
        parameterSchema.safeParse(
          request.params
        );

      if (!validation.success) {
        return response
          .status(400)
          .json({
            success: false,
            error: "Invalid product ID",
          });
      }

      const {
        productId,
      } = validation.data;

      const {
        data: product,
        error,
      } = await supabaseAdmin
        .from("products")
        .select("*")
        .eq("id", productId)
        .maybeSingle();

      if (error) {
        console.error(
          "Product retrieval error:",
          error
        );

        return response
          .status(500)
          .json({
            success: false,
            error:
              "Unable to retrieve product",
          });
      }

      if (!product) {
        return response
          .status(404)
          .json({
            success: false,
            error: "Product not found",
          });
      }

      const {
        data: images,
        error: imagesError,
      } = await supabaseAdmin
        .from("product_images")
        .select("*")
        .eq("product_id", productId)
        .order("display_order", {
          ascending: true,
        });

      if (imagesError) {
        console.error(
          "Product images retrieval error:",
          imagesError
        );

        return response
          .status(500)
          .json({
            success: false,
            error:
              "Unable to retrieve product images",
          });
      }

      return response.status(200).json({
        success: true,
        product: {
          ...product,
          images: images ?? [],
        },
      });
    } catch (error) {
      console.error(
        "Product route error:",
        error
      );

      return response
        .status(500)
        .json({
          success: false,
          error:
            "Unable to retrieve product",
        });
    }
  }
);

/**
 * GET /api/admin/products/:productId/suppliers
 * Retourne les fournisseurs associÃ©s Ã  un parfum.
 */
productRoutes.get(
  "/:productId/suppliers",
  async (request, response) => {
    try {
      const parameterSchema = z.object({
        productId: z.string().uuid(),
      });

      const validation =
        parameterSchema.safeParse(
          request.params
        );

      if (!validation.success) {
        return response
          .status(400)
          .json({
            success: false,
            error: "Invalid product ID",
          });
      }

      const { productId } =
        validation.data;

      const {
        data: product,
        error: productError,
      } = await supabaseAdmin
        .from("products")
        .select("id")
        .eq("id", productId)
        .maybeSingle();

      if (productError) {
        console.error(
          "Product verification error:",
          productError
        );

        return response
          .status(500)
          .json({
            success: false,
            error:
              "Unable to verify product",
          });
      }

      if (!product) {
        return response
          .status(404)
          .json({
            success: false,
            error: "Product not found",
          });
      }

      const {
        data: associations,
        error,
      } = await supabaseAdmin
        .from("product_suppliers")
        .select(`
          product_id,
          supplier_id,
          supplier_reference,
          last_purchase_price,
          created_at,
          supplier:suppliers (
            id,
            name,
            phone,
            email,
            address,
            comment,
            is_active,
            created_at,
            updated_at
          )
        `)
        .eq("product_id", productId)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        console.error(
          "Product suppliers retrieval error:",
          error
        );

        return response
          .status(500)
          .json({
            success: false,
            error:
              "Unable to retrieve product suppliers",
          });
      }

      return response
        .status(200)
        .json({
          success: true,
          suppliers:
            associations ?? [],
        });
    } catch (error) {
      console.error(
        "Product suppliers route error:",
        error
      );

      return response
        .status(500)
        .json({
          success: false,
          error:
            "Unable to retrieve product suppliers",
        });
    }
  }
);

/**
 * POST /api/admin/products/:productId/suppliers
 * Associe un fournisseur Ã  un parfum.
 *
 * Si lâ€™association existe dÃ©jÃ ,
 * ses informations sont mises Ã  jour.
 */
productRoutes.post(
  "/:productId/suppliers",
  async (request, response) => {
    try {
      const parameterSchema = z.object({
        productId: z.string().uuid(),
      });

      const associationSchema = z
        .object({
          supplierId: z
            .string()
            .uuid(
              "Invalid supplier ID"
            ),

          supplierReference: z
            .string()
            .trim()
            .max(150)
            .nullable()
            .optional(),

          lastPurchasePrice: z
            .number()
            .int()
            .min(
              0,
              "Last purchase price cannot be negative"
            )
            .nullable()
            .optional(),
        })
        .strict();

      const parameterValidation =
        parameterSchema.safeParse(
          request.params
        );

      if (
        !parameterValidation.success
      ) {
        return response
          .status(400)
          .json({
            success: false,
            error: "Invalid product ID",
          });
      }

      const bodyValidation =
        associationSchema.safeParse(
          request.body
        );

      if (!bodyValidation.success) {
        return response
          .status(400)
          .json({
            success: false,
            error:
              "Invalid product supplier data",
            details:
              bodyValidation.error.flatten(),
          });
      }

      const { productId } =
        parameterValidation.data;

      const association =
        bodyValidation.data;

      const {
        data: productSupplier,
        error,
      } = await request.auth.supabase.rpc(
        "upsert_product_supplier",
        {
          target_product_id:
            productId,

          target_supplier_id:
            association.supplierId,

          target_supplier_reference:
            association.supplierReference ??
            null,

          target_last_purchase_price:
            association.lastPurchasePrice ??
            null,
        }
      );

      if (error) {
        console.error(
          "Product supplier association error:",
          error
        );

        if (
          error.message?.includes(
            "Product not found"
          )
        ) {
          return response
            .status(404)
            .json({
              success: false,
              error: "Product not found",
            });
        }

        if (
          error.message?.includes(
            "Supplier not found"
          )
        ) {
          return response
            .status(404)
            .json({
              success: false,
              error: "Supplier not found",
            });
        }

        if (
          error.message?.includes(
            "Supplier is inactive"
          )
        ) {
          return response
            .status(409)
            .json({
              success: false,
              error: "Supplier is inactive",
            });
        }

        if (
          error.message?.includes(
            "Administrative access required"
          )
        ) {
          return response
            .status(403)
            .json({
              success: false,
              error:
                "Your administrative role does not allow supplier association",
            });
        }

        return response
          .status(500)
          .json({
            success: false,
            error:
              "Unable to associate supplier with product",
          });
      }

      return response
        .status(201)
        .json({
          success: true,
          message:
            "Supplier associated with product successfully",
          productSupplier,
        });
    } catch (error) {
      console.error(
        "Product supplier association route error:",
        error
      );

      return response
        .status(500)
        .json({
          success: false,
          error:
            "Unable to associate supplier with product",
        });
    }
  }
);
/**
 * DELETE /api/admin/products/:productId/suppliers/:supplierId
 * Retire un fournisseur dâ€™un parfum.
 *
 * Le fournisseur lui-mÃªme nâ€™est pas supprimÃ©.
 */
productRoutes.delete(
  "/:productId/suppliers/:supplierId",
  async (request, response) => {
    try {
      const parameterSchema = z.object({
        productId: z.string().uuid(),
        supplierId: z.string().uuid(),
      });

      const validation =
        parameterSchema.safeParse(
          request.params
        );

      if (!validation.success) {
        return response
          .status(400)
          .json({
            success: false,
            error:
              "Invalid product or supplier ID",
            details:
              validation.error.flatten(),
          });
      }

      const {
        productId,
        supplierId,
      } = validation.data;

      const {
        data: removed,
        error,
      } = await request.auth.supabase.rpc(
        "remove_product_supplier",
        {
          target_product_id:
            productId,

          target_supplier_id:
            supplierId,
        }
      );

      if (error) {
        console.error(
          "Product supplier removal error:",
          error
        );

        if (
          error.message?.includes(
            "Product supplier association not found"
          )
        ) {
          return response
            .status(404)
            .json({
              success: false,
              error:
                "Product supplier association not found",
            });
        }

        if (
          error.message?.includes(
            "Administrative access required"
          )
        ) {
          return response
            .status(403)
            .json({
              success: false,
              error:
                "Your administrative role does not allow supplier removal",
            });
        }

        return response
          .status(500)
          .json({
            success: false,
            error:
              "Unable to remove supplier from product",
          });
      }

      return response
        .status(200)
        .json({
          success: true,
          message:
            "Supplier removed from product successfully",
          removed,
        });
    } catch (error) {
      console.error(
        "Product supplier removal route error:",
        error
      );

      return response
        .status(500)
        .json({
          success: false,
          error:
            "Unable to remove supplier from product",
        });
    }
  }
);
export default productRoutes;
