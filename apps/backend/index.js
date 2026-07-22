import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import {
  env,
  allowedOrigins,
} from "./src/config/env.js";

import adminAuthRoutes
  from "./src/routes/adminAuthRoutes.js";

import categoryRoutes
  from "./src/routes/categoryRoutes.js";

import productRoutes
  from "./src/routes/productRoutes.js";

import stockRoutes
  from "./src/routes/stockRoutes.js";

import supplierRoutes
  from "./src/routes/supplierRoutes.js";

const app = express();
const port = process.env.PORT || 3000;

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

app.use(
  cors({
    origin(origin, callback) {
      // Applications mobiles, outils serveur
      // et accès direct sans en-tête Origin.
      if (!origin) {
        return callback(null, true);
      }

      if (
        env.NODE_ENV !== "production" ||
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      return callback(
        new Error("Origin not allowed")
      );
    },

    credentials: true,
  })
);

app.use(
  express.json({
    limit: "1mb",
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    error:
      "Too many requests. Please try again later.",
  },
});

app.use("/api", apiLimiter);

/*
 * Authentification administrative.
 *
 * Ces routes profondes restent disponibles
 * pour les points d’entrée Vercel exacts déjà
 * créés, notamment le mot de passe entreprise.
 */
app.use(
  "/api/admin/auth",
  adminAuthRoutes
);

/*
 * Catégories.
 */
app.use(
  "/api/admin/categories",
  categoryRoutes
);

/*
 * Alias plats d’authentification.
 *
 * Ils réutilisent la fonction Vercel :
 * api/admin/products/[productId].js
 *
 * Ce montage doit rester avant stockRoutes
 * et productRoutes.
 */
app.use(
  "/api/admin/products",
  adminAuthRoutes
);

/*
 * Historique global des mouvements de stock.
 *
 * Cette route doit également rester avant
 * productRoutes pour que "stock-history" ne
 * soit pas interprété comme un UUID produit.
 */
app.use(
  "/api/admin/products/stock-history",
  stockRoutes
);

/*
 * Gestion des parfums.
 */
app.use(
  "/api/admin/products",
  productRoutes
);

/*
 * Gestion des fournisseurs.
 */
app.use(
  "/api/admin/suppliers",
  supplierRoutes
);

app.get("/", (request, response) => {
  return response.status(200).json({
    success: true,
    application: "SGJ Boutique API",
    version: "1.0.0",
  });
});

app.get(
  "/api/health",
  (request, response) => {
    return response.status(200).json({
      success: true,
      status: "healthy",
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  }
);

/*
 * Cette route doit rester après toutes
 * les routes de l’API.
 */
app.use((request, response) => {
  return response.status(404).json({
    success: false,
    error: "Route not found",
  });
});

/*
 * Gestion centralisée des erreurs.
 */
app.use(
  (
    error,
    request,
    response,
    next
  ) => {
    console.error(error);

    if (
      error.message ===
      "Origin not allowed"
    ) {
      return response.status(403).json({
        success: false,
        error: "Origin not allowed",
      });
    }

    return response.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
);

if (env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(
      `SGJ Boutique API running on port ${port}`
    );
  });
}

export default app;
