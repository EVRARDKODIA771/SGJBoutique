import { Router } from "express";
import { z } from "zod";

import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { authenticateUser } from "../middleware/authenticateUser.js";
import { requireApprovedAdmin } from "../middleware/requireApprovedAdmin.js";
import { requireCompanySession } from "../middleware/requireCompanySession.js";
import {
  getUserDisplayLabel,
  notifySafely,
} from "../services/notificationService.js";

const restockingRoutes = Router();

restockingRoutes.use(
  authenticateUser,
  requireApprovedAdmin(),
  requireCompanySession
);

const createSchema = z.object({
  title: z.string().trim().min(1).max(150),
  restockingDate: z.string().date(),
  supplierId: z.string().uuid(),
  invoiceNumber: z.string().trim().min(1).max(100),
}).strict();

async function loadRestockingSummary(restocking) {
  const { data: items, error } = await supabaseAdmin
    .from("restocking_items")
    .select(`
      id,
      initial_quantity,
      remaining_quantity,
      purchase_price,
      sale_price,
      product:products (id, name, brand, sku)
    `)
    .eq("restocking_id", restocking.id)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const normalizedItems = items ?? [];
  const initialUnits = normalizedItems.reduce(
    (sum, item) => sum + Number(item.initial_quantity ?? 0),
    0
  );
  const remainingUnits = normalizedItems.reduce(
    (sum, item) => sum + Number(item.remaining_quantity ?? 0),
    0
  );

  const itemIds = normalizedItems.map((item) => item.id);
  let allocations = [];

  if (itemIds.length > 0) {
    const allocationResult = await supabaseAdmin
      .from("sale_allocations")
      .select("quantity, purchase_price_snapshot, sale_price_snapshot")
      .in("restocking_item_id", itemIds);

    if (allocationResult.error) throw allocationResult.error;
    allocations = allocationResult.data ?? [];
  }

  const salesRevenue = allocations.reduce(
    (sum, row) => sum + Number(row.quantity) * Number(row.sale_price_snapshot),
    0
  );
  const purchaseCost = allocations.reduce(
    (sum, row) => sum + Number(row.quantity) * Number(row.purchase_price_snapshot),
    0
  );

  return {
    ...restocking,
    items: normalizedItems,
    statistics: {
      productCount: normalizedItems.length,
      initialUnits,
      soldUnits: initialUnits - remainingUnits,
      remainingUnits,
      salesRevenue,
      purchaseCost,
      profit: salesRevenue - purchaseCost,
    },
  };
}

restockingRoutes.post("/", async (request, response) => {
  const validation = createSchema.safeParse(request.body);
  if (!validation.success) {
    return response.status(400).json({
      success: false,
      error: "Invalid restocking data",
      details: validation.error.flatten(),
    });
  }

  try {
    const value = validation.data;
    const { data: supplier, error: supplierError } = await supabaseAdmin
      .from("suppliers")
      .select("id, name, is_active")
      .eq("id", value.supplierId)
      .maybeSingle();

    if (supplierError) throw supplierError;
    if (!supplier) {
      return response.status(404).json({ success: false, error: "Supplier not found" });
    }
    if (!supplier.is_active) {
      return response.status(409).json({ success: false, error: "Supplier is inactive" });
    }

    const { data: restocking, error } = await supabaseAdmin
      .from("restockings")
      .insert({
        title: value.title,
        restocking_date: value.restockingDate,
        supplier_id: value.supplierId,
        invoice_number: value.invoiceNumber,
        created_by: request.auth.user.id,
      })
      .select(`*, supplier:suppliers (id, name)`)
      .single();

    if (error) throw error;
    return response.status(201).json({ success: true, restocking });
  } catch (error) {
    console.error("Restocking creation error:", error);
    return response.status(500).json({ success: false, error: "Unable to create restocking" });
  }
});

restockingRoutes.get("/", async (request, response) => {
  const validation = z.object({
    supplierId: z.string().uuid().optional(),
    status: z.enum(["active", "completed"]).optional(),
  }).safeParse(request.query);

  if (!validation.success) {
    return response.status(400).json({ success: false, error: "Invalid restocking filters" });
  }

  try {
    let query = supabaseAdmin
      .from("restockings")
      .select(`*, supplier:suppliers (id, name)`)
      .order("restocking_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (validation.data.supplierId) {
      query = query.eq("supplier_id", validation.data.supplierId);
    }
    if (validation.data.status) {
      query = query.eq("status", validation.data.status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const restockings = await Promise.all((data ?? []).map(loadRestockingSummary));
    return response.status(200).json({ success: true, restockings });
  } catch (error) {
    console.error("Restocking listing error:", error);
    return response.status(500).json({ success: false, error: "Unable to retrieve restockings" });
  }
});

restockingRoutes.get("/dashboard-statistics", async (request, response) => {
  try {
    const { data: activeRestockings, error: restockingError } = await supabaseAdmin
      .from("restockings")
      .select(`id, title, restocking_date, invoice_number, supplier:suppliers (id, name)`)
      .eq("status", "active")
      .order("restocking_date", { ascending: true });
    if (restockingError) throw restockingError;

    const ids = (activeRestockings ?? []).map((item) => item.id);
    if (ids.length === 0) {
      return response.status(200).json({
        success: true,
        activeRestockings: [],
        statistics: {
          productTotal: 0, supplierTotal: 0, stockQuantity: 0,
          soldUnits: 0, salesRevenue: 0, purchaseCost: 0, profit: 0,
        },
      });
    }

    const { data: items, error: itemError } = await supabaseAdmin
      .from("restocking_items")
      .select("id, restocking_id, product_id, remaining_quantity")
      .in("restocking_id", ids);
    if (itemError) throw itemError;

    const itemIds = (items ?? []).map((item) => item.id);
    let allocations = [];
    if (itemIds.length > 0) {
      const allocationResult = await supabaseAdmin
        .from("sale_allocations")
        .select("quantity, purchase_price_snapshot, sale_price_snapshot")
        .in("restocking_item_id", itemIds);
      if (allocationResult.error) throw allocationResult.error;
      allocations = allocationResult.data ?? [];
    }

    const soldUnits = allocations.reduce((sum, row) => sum + Number(row.quantity), 0);
    const salesRevenue = allocations.reduce(
      (sum, row) => sum + Number(row.quantity) * Number(row.sale_price_snapshot), 0
    );
    const purchaseCost = allocations.reduce(
      (sum, row) => sum + Number(row.quantity) * Number(row.purchase_price_snapshot), 0
    );

    return response.status(200).json({
      success: true,
      activeRestockings,
      statistics: {
        productTotal: new Set((items ?? []).map((item) => item.product_id)).size,
        supplierTotal: new Set((activeRestockings ?? []).map((item) => item.supplier?.id)).size,
        stockQuantity: (items ?? []).reduce(
          (sum, item) => sum + Number(item.remaining_quantity ?? 0), 0
        ),
        soldUnits,
        salesRevenue,
        purchaseCost,
        profit: salesRevenue - purchaseCost,
      },
    });
  } catch (error) {
    console.error("Active restocking dashboard error:", error);
    return response.status(500).json({ success: false, error: "Unable to calculate dashboard statistics" });
  }
});

restockingRoutes.get("/:restockingId", async (request, response) => {
  const idValidation = z.string().uuid().safeParse(request.params.restockingId);
  if (!idValidation.success) {
    return response.status(400).json({ success: false, error: "Invalid restocking ID" });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("restockings")
      .select(`*, supplier:suppliers (id, name)`)
      .eq("id", idValidation.data)
      .maybeSingle();
    if (error) throw error;
    if (!data) return response.status(404).json({ success: false, error: "Restocking not found" });

    const restocking = await loadRestockingSummary(data);
    const itemIds = restocking.items.map((item) => item.id);
    let allocations = [];

    if (itemIds.length > 0) {
      const result = await supabaseAdmin
        .from("sale_allocations")
        .select(`
          id, quantity, purchase_price_snapshot, sale_price_snapshot, created_at,
          restocking_item:restocking_items (id, product:products (id, name, brand)),
          movement:stock_movements (id, created_at, reference, reason, performed_by)
        `)
        .in("restocking_item_id", itemIds)
        .order("created_at", { ascending: false });
      if (result.error) throw result.error;
      allocations = result.data ?? [];
    }

    const sellerIds = [
      ...new Set(
        allocations
          .map((sale) => sale.movement?.performed_by)
          .filter(Boolean)
      ),
    ];
    let sellersById = new Map();

    if (sellerIds.length > 0) {
      const sellerResult = await supabaseAdmin
        .from("staff_profiles")
        .select("user_id, display_name, staff_code")
        .in("user_id", sellerIds);

      if (sellerResult.error) throw sellerResult.error;
      sellersById = new Map(
        (sellerResult.data ?? []).map((seller) => [seller.user_id, seller])
      );
    }

    allocations = allocations.map((sale) => {
      const [clientName = "Client non renseigné", clientPhone = ""] =
        String(sale.movement?.reference ?? "").split(" · ");

      return {
        ...sale,
        client: { name: clientName, phone: clientPhone },
        seller: sellersById.get(sale.movement?.performed_by) ?? null,
      };
    });

    const salesRevenue = allocations.reduce(
      (sum, sale) => sum + Number(sale.quantity) * Number(sale.sale_price_snapshot), 0
    );
    const purchaseCost = allocations.reduce(
      (sum, sale) => sum + Number(sale.quantity) * Number(sale.purchase_price_snapshot), 0
    );

    return response.status(200).json({
      success: true,
      restocking: {
        ...restocking,
        allocations,
        statistics: {
          ...restocking.statistics,
          salesRevenue,
          purchaseCost,
          profit: salesRevenue - purchaseCost,
        },
      },
    });
  } catch (error) {
    console.error("Restocking detail error:", error);
    return response.status(500).json({ success: false, error: "Unable to retrieve restocking" });
  }
});

restockingRoutes.post("/:restockingId/complete", async (request, response) => {
  const validation = z.object({
    authorizationMethod: z.enum(["biometric", "company_password"]),
  }).strict().safeParse(request.body);
  const idValidation = z.string().uuid().safeParse(request.params.restockingId);

  if (!validation.success || !idValidation.success) {
    return response.status(400).json({ success: false, error: "Invalid completion request" });
  }

  try {
    const { data: restocking, error: restockingError } = await supabaseAdmin
      .from("restockings")
      .select(`*, supplier:suppliers (id, name)`)
      .eq("id", idValidation.data)
      .maybeSingle();
    if (restockingError) throw restockingError;
    if (!restocking) return response.status(404).json({ success: false, error: "Restocking not found" });
    if (restocking.status !== "active") {
      return response.status(409).json({ success: false, error: "Restocking is already completed" });
    }

    const { data: remainingItems, error: itemError } = await supabaseAdmin
      .from("restocking_items")
      .select(`*, product:products (id, name, stock_quantity)`)
      .eq("restocking_id", restocking.id)
      .gt("remaining_quantity", 0);
    if (itemError) throw itemError;

    for (const item of remainingItems ?? []) {
      const { error: movementError } = await request.auth.supabase.rpc(
        "record_stock_movement",
        {
          target_product_id: item.product_id,
          target_movement_type: "loss",
          quantity_delta: -Number(item.remaining_quantity),
          movement_reason: `Clôture anticipée du ravitaillement ${restocking.title}`,
          movement_reference: restocking.invoice_number,
          target_supplier_id: null,
          movement_unit_price: null,
        }
      );
      if (movementError) throw movementError;
    }

    await supabaseAdmin
      .from("restocking_items")
      .update({ remaining_quantity: 0 })
      .eq("restocking_id", restocking.id);

    const { data: completed, error } = await supabaseAdmin
      .from("restockings")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: request.auth.user.id,
        forced_completion: (remainingItems ?? []).length > 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", restocking.id)
      .select(`*, supplier:suppliers (id, name)`)
      .single();
    if (error) throw error;

    if ((remainingItems ?? []).length > 0) {
      const actorLabel = await getUserDisplayLabel(request.auth.user.id);
      await notifySafely({
        eventType: "restocking_forced_completed",
        title: "Ravitaillement arrêté avant épuisement",
        body: `${actorLabel} a arrêté « ${restocking.title} » alors qu'il restait du stock.`,
        actorUserId: request.auth.user.id,
        route: "/restockings",
        data: { restockingId: restocking.id, authorizationMethod: validation.data.authorizationMethod },
      });
    }

    return response.status(200).json({ success: true, restocking: completed });
  } catch (error) {
    console.error("Restocking completion error:", error);
    return response.status(500).json({ success: false, error: "Unable to complete restocking" });
  }
});

export default restockingRoutes;
