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

const categoryRoutes = Router();

categoryRoutes.use(
  authenticateUser,
  requireApprovedAdmin(),
  requireCompanySession
);

/**
 * GET /api/admin/categories
 * Retourne la liste paginée des catégories.
 */
categoryRoutes.get(
  "/",
  async (request, response) => {
    try {
      const querySchema = z.object({
        search: z
          .string()
          .trim()
          .max(100)
          .optional(),

        isActive: z
          .enum(["true", "false"])
          .transform(
            (value) => value === "true"
          )
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
          .default(50),
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
        isActive,
        page,
        limit,
      } = validation.data;

      const start = (page - 1) * limit;
      const end = start + limit - 1;

      let databaseQuery = supabaseAdmin
        .from("categories")
        .select("*", {
          count: "exact",
        })
        .order("name", {
          ascending: true,
        })
        .range(start, end);

      if (search) {
        databaseQuery =
          databaseQuery.ilike(
            "name",
            `%${search}%`
          );
      }

      if (isActive !== undefined) {
        databaseQuery =
          databaseQuery.eq(
            "is_active",
            isActive
          );
      }

      const {
        data: categories,
        error,
        count,
      } = await databaseQuery;

      if (error) {
        console.error(
          "Categories listing error:",
          error
        );

        return response.status(500).json({
          success: false,
          error:
            "Unable to retrieve categories",
        });
      }

      return response.status(200).json({
        success: true,
        categories: categories ?? [],
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
        "Categories route error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to retrieve categories",
      });
    }
  }
);

/**
 * POST /api/admin/categories
 * Crée une nouvelle catégorie.
 */
categoryRoutes.post(
  "/",
  async (request, response) => {
    try {
      const categorySchema = z
        .object({
          name: z
            .string()
            .trim()
            .min(
              1,
              "Category name is required"
            )
            .max(150),

          description: z
            .string()
            .trim()
            .max(1000)
            .nullable()
            .optional(),
        })
        .strict();

      const validation =
        categorySchema.safeParse(
          request.body
        );

      if (!validation.success) {
        return response.status(400).json({
          success: false,
          error:
            "Invalid category data",
          details:
            validation.error.flatten(),
        });
      }

      const category = validation.data;

      const {
        data: createdCategory,
        error,
      } = await request.auth.supabase.rpc(
        "create_category",
        {
          category_name:
            category.name,

          category_description:
            category.description ?? null,
        }
      );

      if (error) {
        console.error(
          "Category creation error:",
          error
        );

        if (error.code === "23505") {
          return response
            .status(409)
            .json({
              success: false,
              error:
                "A category with this name already exists",
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
                "Your administrative role does not allow category creation",
            });
        }

        return response.status(500).json({
          success: false,
          error:
            "Unable to create category",
        });
      }

      return response.status(201).json({
        success: true,
        message:
          "Category created successfully",
        category: createdCategory,
      });
    } catch (error) {
      console.error(
        "Category creation route error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to create category",
      });
    }
  }
);

/**
 * PATCH /api/admin/categories/:categoryId
 * Modifie, active ou désactive une catégorie.
 */
categoryRoutes.patch(
  "/:categoryId",
  async (request, response) => {
    try {
      const parameterSchema = z.object({
        categoryId: z.string().uuid(),
      });

      const updateSchema = z
        .object({
          name: z
            .string()
            .trim()
            .min(1)
            .max(150)
            .optional(),

          description: z
            .string()
            .trim()
            .max(1000)
            .nullable()
            .optional(),

          isActive: z
            .boolean()
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
            error:
              "Invalid category ID",
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
              "Invalid category data",
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

      const { categoryId } =
        parameterValidation.data;

      const update =
        bodyValidation.data;

      const categoryUpdates = {};

      if (update.name !== undefined) {
        categoryUpdates.name =
          update.name;
      }

      if (
        update.description !== undefined
      ) {
        categoryUpdates.description =
          update.description;
      }

      if (
        update.isActive !== undefined
      ) {
        categoryUpdates.is_active =
          update.isActive;
      }

      const {
        data: updatedCategory,
        error,
      } = await request.auth.supabase.rpc(
        "update_category",
        {
          category_id: categoryId,
          category_updates:
            categoryUpdates,
        }
      );

      if (error) {
        console.error(
          "Category update error:",
          error
        );

        if (
          error.message?.includes(
            "Category not found"
          )
        ) {
          return response
            .status(404)
            .json({
              success: false,
              error:
                "Category not found",
            });
        }

        if (error.code === "23505") {
          return response
            .status(409)
            .json({
              success: false,
              error:
                "A category with this name already exists",
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
                "Your administrative role does not allow category modification",
            });
        }

        return response.status(500).json({
          success: false,
          error:
            "Unable to update category",
        });
      }

      return response.status(200).json({
        success: true,
        message:
          "Category updated successfully",
        category: updatedCategory,
      });
    } catch (error) {
      console.error(
        "Category update route error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to update category",
      });
    }
  }
);

export default categoryRoutes;
