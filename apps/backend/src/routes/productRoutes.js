import { Router } from "express";
import { z } from "zod";

import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { authenticateUser } from "../middleware/authenticateUser.js";
import { requireApprovedAdmin } from "../middleware/requireApprovedAdmin.js";
import { requireCompanySession } from "../middleware/requireCompanySession.js";

const productRoutes = Router();

productRoutes.use(
  authenticateUser,
  requireApprovedAdmin(),
  requireCompanySession
);

/**
 * GET /api/admin/products
 * Retourne tous les parfums visibles dans le catalogue.
 */
productRoutes.get("/", async (request, response) => {
  try {
    const querySchema = z.object({
      search: z.string().trim().max(100).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    });

    const validation = querySchema.safeParse(request.query);

    if (!validation.success) {
      return response.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: validation.error.flatten(),
      });
    }

    const { search, page, limit } = validation.data;
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    let databaseQuery = supabaseAdmin
      .from("product_catalog")
      .select("*", {
        count: "exact",
      })
      .range(start, end);

    if (search) {
      databaseQuery = databaseQuery.ilike(
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
      console.error("Products listing error:", error);

      return response.status(500).json({
        success: false,
        error: "Unable to retrieve products",
      });
    }

    return response.status(200).json({
      success: true,
      products: products ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (error) {
    console.error("Products route error:", error);

    return response.status(500).json({
      success: false,
      error: "Unable to retrieve products",
    });
  }
});

/**
 * GET /api/admin/products/:productId
 * Retourne un parfum précis.
 */
productRoutes.get(
  "/:productId",
  async (request, response) => {
    try {
      const parameterSchema = z.object({
        productId: z.string().uuid(),
      });

      const validation = parameterSchema.safeParse(
        request.params
      );

      if (!validation.success) {
        return response.status(400).json({
          success: false,
          error: "Invalid product ID",
        });
      }

      const { productId } = validation.data;

      const {
        data: product,
        error,
      } = await supabaseAdmin
        .from("product_catalog")
        .select("*")
        .eq("id", productId)
        .maybeSingle();

      if (error) {
        console.error("Product retrieval error:", error);

        return response.status(500).json({
          success: false,
          error: "Unable to retrieve product",
        });
      }

      if (!product) {
        return response.status(404).json({
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
        .order("sort_order", {
          ascending: true,
        });

      if (imagesError) {
        console.error(
          "Product images retrieval error:",
          imagesError
        );

        return response.status(500).json({
          success: false,
          error: "Unable to retrieve product images",
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
      console.error("Product route error:", error);

      return response.status(500).json({
        success: false,
        error: "Unable to retrieve product",
      });
    }
  }
);

export default productRoutes;
