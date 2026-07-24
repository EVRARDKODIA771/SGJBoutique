import { apiRequest } from
  "../lib/api.js";

function buildQuery(parameters = {}) {
  const query = Object.entries(parameters)
    .filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== ""
    )
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=` +
        `${encodeURIComponent(value)}`
    )
    .join("&");

  return query ? `?${query}` : "";
}

/*
 * PARFUMS
 */

export function getProducts({
  search,
  page = 1,
  limit = 20,
} = {}) {
  const query = buildQuery({
    search,
    page,
    limit,
  });

  return apiRequest(
    `/api/admin/products${query}`
  );
}

export function getSoldProducts({
  search,
  startDate,
  endDate,
  page = 1,
  limit = 20,
} = {}) {
  const query = buildQuery({
    search,
    startDate,
    endDate,
    page,
    limit,
  });

  return apiRequest(
    `/api/admin/products/sold${query}`
  );
}

export function getSupplierPurchases({
  supplierId,
  search,
  startDate,
  endDate,
  page = 1,
  limit = 20,
} = {}) {
  const query = buildQuery({
    supplierId,
    search,
    startDate,
    endDate,
    page,
    limit,
  });

  return apiRequest(
    `/api/admin/products/supplier-purchases${query}`
  );
}

export function getLowStockProducts({
  search,
  page = 1,
  limit = 20,
} = {}) {
  const query = buildQuery({
    search,
    page,
    limit,
  });

  return apiRequest(
    `/api/admin/products/low-stock${query}`
  );
}

export function getOutOfStockProducts({
  search,
  page = 1,
  limit = 20,
} = {}) {
  const query = buildQuery({
    search,
    page,
    limit,
  });

  return apiRequest(
    `/api/admin/products/out-of-stock${query}`
  );
}

export function getProduct(productId) {
  return apiRequest(
    `/api/admin/products/${productId}`
  );
}

export function createProduct(
  productData
) {
  return apiRequest(
    "/api/admin/products",
    {
      method: "POST",
      body: productData,
    }
  );
}

export function updateProduct(
  productId,
  productData
) {
  return apiRequest(
    `/api/admin/products/${productId}`,
    {
      method: "PATCH",
      body: productData,
    }
  );
}

export function archiveProduct(
  productId
) {
  return apiRequest(
    `/api/admin/products/${productId}/archive`,
    {
      method: "PATCH",
    }
  );
}

/*
 * IMAGES DES PARFUMS
 */

export function uploadProductImage(
  productId,
  image
) {
  const formData = new FormData();

  formData.append("image", image);

  return apiRequest(
    `/api/admin/products/${productId}/images`,
    {
      method: "POST",
      body: formData,
    }
  );
}

/*
 * HISTORIQUE DES ENTRÃ‰ES ET SORTIES
 */

export function getStockMovements(
  productId,
  {
    page = 1,
    limit = 20,
  } = {}
) {
  const query = buildQuery({
    page,
    limit,
  });

  return apiRequest(
    `/api/admin/products/${productId}/stock-movements${query}`
  );
}

export function recordStockMovement(
  productId,
  movementData
) {
  return apiRequest(
    `/api/admin/products/${productId}/stock-movements`,
    {
      method: "POST",
      body: movementData,
    }
  );
}

export function getGlobalStockMovements({
  movementType,
  productId,
  page = 1,
  limit = 20,
} = {}) {
  const query = buildQuery({
    movementType,
    productId,
    page,
    limit,
  });

  return apiRequest(
    `/api/admin/products/stock-history${query}`
  );
}

/*
 * CATÃ‰GORIES
 */

export function getCategories({
  search,
  isActive,
  page = 1,
  limit = 50,
} = {}) {
  const query = buildQuery({
    search,
    isActive,
    page,
    limit,
  });

  return apiRequest(
    `/api/admin/categories${query}`
  );
}

export function createCategory(
  categoryData
) {
  return apiRequest(
    "/api/admin/categories",
    {
      method: "POST",
      body: categoryData,
    }
  );
}

export function updateCategory(
  categoryId,
  categoryData
) {
  return apiRequest(
    "/api/admin/categories",
    {
      method: "PATCH",
      body: {
        categoryId,
        ...categoryData,
      },
    }
  );
}

/*
 * FOURNISSEURS
 */

export function getSuppliers({
  search,
  isActive,
  page = 1,
  limit = 50,
} = {}) {
  const query = buildQuery({
    search,
    isActive,
    page,
    limit,
  });

  return apiRequest(
    `/api/admin/suppliers${query}`
  );
}

export function createSupplier(
  supplierData
) {
  return apiRequest(
    "/api/admin/suppliers",
    {
      method: "POST",
      body: supplierData,
    }
  );
}

export function updateSupplier(
  supplierId,
  supplierData
) {
  return apiRequest(
    "/api/admin/suppliers",
    {
      method: "PATCH",
      body: {
        supplierId,
        ...supplierData,
      },
    }
  );
}

/*
 * FOURNISSEURS ASSOCIÃ‰S Ã€ UN PARFUM
 */

export function getProductSuppliers(
  productId
) {
  return apiRequest(
    `/api/admin/products/${productId}/suppliers`
  );
}

export function saveProductSupplier(
  productId,
  supplierData
) {
  return apiRequest(
    `/api/admin/products/${productId}/suppliers`,
    {
      method: "POST",
      body: supplierData,
    }
  );
}

export function removeProductSupplier(
  productId,
  supplierId
) {
  return apiRequest(
    `/api/admin/products/${productId}/suppliers/${supplierId}`,
    {
      method: "DELETE",
    }
  );
}