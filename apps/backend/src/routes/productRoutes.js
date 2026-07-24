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
 * GET /api/admin/products/stock-history
 *
 * Retourne lâ€™historique global des entrÃ©es
 * et sorties avec filtrage et pagination.
 *
 * Cette route statique doit rester avant les
 * routes dynamiques utilisant :productId.
 */
productRoutes.get(
  "/stock-history",
  async (request, response) => {
    try {
      const querySchema = z.object({
        movementType: z
          .enum([
            "initial",
            "purchase",
            "sale",
            "return",
            "damage",
            "loss",
            "adjustment",
          ])
          .optional(),

        productId: z
          .string()
          .uuid("Invalid product ID")
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
        movementType,
        productId,
        page,
        limit,
      } = validation.data;

      const start =
        (page - 1) * limit;

      const end =
        start + limit - 1;

      let databaseQuery = supabaseAdmin
        .from("stock_movements")
        .select(
          `
            *,
            product:products (
              id,
              name,
              brand,
              sku,
              added_by_code
            ),
            supplier:suppliers (
              id,
              name
            )
          `,
          {
            count: "exact",
          }
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .range(start, end);

      if (movementType) {
        databaseQuery =
          databaseQuery.eq(
            "movement_type",
            movementType
          );
      }

      if (productId) {
        databaseQuery =
          databaseQuery.eq(
            "product_id",
            productId
          );
      }

      const {
        data: movements,
        error,
        count,
      } = await databaseQuery;

      if (error) {
        console.error(
          "Global stock history error:",
          error
        );

        return response.status(500).json({
          success: false,
          error:
            "Unable to retrieve stock history",
        });
      }

      return response.status(200).json({
        success: true,

        movements:
          movements ?? [],

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
        "Global stock history route error:",
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
 * Retourne les parfums vendus, du plus rÃ©cent au moins rÃ©cent.
 *
 * La recherche porte notamment sur le nom, la marque, le SKU,
 * la date, la rÃ©fÃ©rence et la personne ayant enregistrÃ© la vente.
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
 * Retourne les parfums achetÃ©s chez les fournisseurs.
 *
 * supplierId permet dâ€™afficher les achats dâ€™un fournisseur prÃ©cis.
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
            "
