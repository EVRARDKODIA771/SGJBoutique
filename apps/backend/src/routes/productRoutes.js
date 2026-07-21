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
 * POST /api/admin/products
 * Crée un parfum et son stock initial.
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
       * l’utilisateur à la fonction SQL.
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
 * Ajoute une image à un parfum.
 *
 * La première image devient automatiquement
 * l’image principale.
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
 * GET /api/admin/products/:productId
 * Retourne un parfum précis avec ses images.
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

export default productRoutes;
