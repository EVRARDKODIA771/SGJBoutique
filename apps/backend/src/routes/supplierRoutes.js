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

const supplierRoutes = Router();

supplierRoutes.use(
  authenticateUser,
  requireApprovedAdmin(),
  requireCompanySession
);

/**
 * GET /api/admin/suppliers
 * Retourne la liste paginée des fournisseurs.
 */
supplierRoutes.get(
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
        .from("suppliers")
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
        data: suppliers,
        error,
        count,
      } = await databaseQuery;

      if (error) {
        console.error(
          "Suppliers listing error:",
          error
        );

        return response.status(500).json({
          success: false,
          error:
            "Unable to retrieve suppliers",
        });
      }

      return response.status(200).json({
        success: true,
        suppliers: suppliers ?? [],
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
        "Suppliers route error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to retrieve suppliers",
      });
    }
  }
);

/**
 * POST /api/admin/suppliers
 * Crée un nouveau fournisseur.
 */
supplierRoutes.post(
  "/",
  async (request, response) => {
    try {
      const supplierSchema = z
        .object({
          name: z
            .string()
            .trim()
            .min(
              1,
              "Supplier name is required"
            )
            .max(150),

          phone: z
            .string()
            .trim()
            .max(50)
            .nullable()
            .optional(),

          email: z
            .string()
            .trim()
            .email(
              "Invalid supplier email"
            )
            .max(254)
            .nullable()
            .optional(),

          address: z
            .string()
            .trim()
            .max(500)
            .nullable()
            .optional(),

          comment: z
            .string()
            .trim()
            .max(2000)
            .nullable()
            .optional(),
        })
        .strict();

      const validation =
        supplierSchema.safeParse(
          request.body
        );

      if (!validation.success) {
        return response.status(400).json({
          success: false,
          error:
            "Invalid supplier data",
          details:
            validation.error.flatten(),
        });
      }

      const supplier = validation.data;

      const {
        data: createdSupplier,
        error,
      } = await request.auth.supabase.rpc(
        "create_supplier",
        {
          supplier_name:
            supplier.name,

          supplier_phone:
            supplier.phone ?? null,

          supplier_email:
            supplier.email ?? null,

          supplier_address:
            supplier.address ?? null,

          supplier_comment:
            supplier.comment ?? null,
        }
      );

      if (error) {
        console.error(
          "Supplier creation error:",
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
                "Your administrative role does not allow supplier creation",
            });
        }

        return response.status(500).json({
          success: false,
          error:
            "Unable to create supplier",
        });
      }

      return response.status(201).json({
        success: true,
        message:
          "Supplier created successfully",
        supplier: createdSupplier,
      });
    } catch (error) {
      console.error(
        "Supplier creation route error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to create supplier",
      });
    }
  }
);

/**
 * PATCH /api/admin/suppliers/:supplierId
 * Modifie, active ou désactive un fournisseur.
 */
supplierRoutes.patch(
  "/:supplierId",
  async (request, response) => {
    try {
      const parameterSchema = z.object({
        supplierId: z.string().uuid(),
      });

      const updateSchema = z
        .object({
          name: z
            .string()
            .trim()
            .min(1)
            .max(150)
            .optional(),

          phone: z
            .string()
            .trim()
            .max(50)
            .nullable()
            .optional(),

          email: z
            .string()
            .trim()
            .email(
              "Invalid supplier email"
            )
            .max(254)
            .nullable()
            .optional(),

          address: z
            .string()
            .trim()
            .max(500)
            .nullable()
            .optional(),

          comment: z
            .string()
            .trim()
            .max(2000)
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
              "Invalid supplier ID",
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
              "Invalid supplier data",
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

      const { supplierId } =
        parameterValidation.data;

      const update =
        bodyValidation.data;

      const supplierUpdates = {};

      if (update.name !== undefined) {
        supplierUpdates.name =
          update.name;
      }

      if (update.phone !== undefined) {
        supplierUpdates.phone =
          update.phone;
      }

      if (update.email !== undefined) {
        supplierUpdates.email =
          update.email;
      }

      if (update.address !== undefined) {
        supplierUpdates.address =
          update.address;
      }

      if (update.comment !== undefined) {
        supplierUpdates.comment =
          update.comment;
      }

      if (
        update.isActive !== undefined
      ) {
        supplierUpdates.is_active =
          update.isActive;
      }

      const {
        data: updatedSupplier,
        error,
      } = await request.auth.supabase.rpc(
        "update_supplier",
        {
          supplier_id: supplierId,
          supplier_updates:
            supplierUpdates,
        }
      );

      if (error) {
        console.error(
          "Supplier update error:",
          error
        );

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
                "Supplier not found",
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
                "Your administrative role does not allow supplier modification",
            });
        }

        return response.status(500).json({
          success: false,
          error:
            "Unable to update supplier",
        });
      }

      return response.status(200).json({
        success: true,
        message:
          "Supplier updated successfully",
        supplier: updatedSupplier,
      });
    } catch (error) {
      console.error(
        "Supplier update route error:",
        error
      );

      return response.status(500).json({
        success: false,
        error:
          "Unable to update supplier",
      });
    }
  }
);

export default supplierRoutes;
