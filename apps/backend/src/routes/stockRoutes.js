import { Router } from "express";
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

const stockRoutes = Router();

stockRoutes.use(
  authenticateUser,
  requireApprovedAdmin(),
  requireCompanySession
);

/**
 * GET /api/admin/stock-movements
 * Retourne l’historique global paginé
 * des mouvements de stock.
 */
stockRoutes.get(
  "/",
  async (request, response) => {
    try {
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
          .uuid(
            "Invalid product ID"
          )
          .optional(),
      });

      const validation =
        querySchema.safeParse(
          request.query
        );

      if (!validation.success) {
        return response
          .status(400)
          .json({
            success: false,
            error:
              "Invalid query parameters",
            details:
              validation.error.flatten(),
          });
      }

      const {
        page,
        limit,
        movementType,
        productId,
      } = validation.data;

      const start =
        (page - 1) * limit;

      const end =
        start + limit - 1;

      let databaseQuery =
        supabaseAdmin
          .from("stock_movements")
          .select(
            `
              id,
              product_id,
              movement_type,
              quantity_change,
              quantity_before,
              quantity_after,
              reason,
              reference,
              performed_by,
              created_at,
              product:products (
                id,
                sku,
                name,
                brand,
                stock_quantity,
                low_stock_threshold,
                status
              )
            `,
            {
              count: "exact",
            }
          )
          .order("created_at", {
            ascending: false,
          })
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
          "Global stock movements retrieval error:",
          error
        );

        return response
          .status(500)
          .json({
            success: false,
            error:
              "Unable to retrieve stock movements",
          });
      }

      return response
        .status(200)
        .json({
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
        "Global stock movements route error:",
        error
      );

      return response
        .status(500)
        .json({
          success: false,
          error:
            "Unable to retrieve stock movements",
        });
    }
  }
);

export default stockRoutes;
