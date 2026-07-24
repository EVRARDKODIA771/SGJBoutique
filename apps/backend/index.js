import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import {
  env,
  allowedOrigins,
} from "./src/config/env.js";

import adminAuthRoutes from
  "./src/routes/adminAuthRoutes.js";

import categoryRoutes from
  "./src/routes/categoryRoutes.js";

import productRoutes from
  "./src/routes/productRoutes.js";

import stockRoutes from
  "./src/routes/stockRoutes.js";

import supplierRoutes from
  "./src/routes/supplierRoutes.js";

const app = express();

const port =
  Number(process.env.PORT) || 3000;

/*
 * Vercel transmet les requêtes à Express
 * derrière un proxy.
 *
 * Cette option est également nécessaire pour
 * que express-rate-limit identifie correctement
 * les adresses des clients.
 */
app.set("trust proxy", 1);

/*
 * En-têtes de sécurité.
 */
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

/*
 * Configuration CORS générale.
 *
 * Ce middleware répond aussi aux requêtes
 * OPTIONS envoyées par les navigateurs avant
 * les appels administratifs.
 */
const corsOptions = {
  origin(origin, callback) {
    /*
     * Les applications mobiles, les outils
     * serveur et certaines requêtes directes
     * peuvent ne pas envoyer d’en-tête Origin.
     */
    if (!origin) {
      return callback(null, true);
    }

    /*
     * En développement, les origines locales
     * utilisées par Expo sont acceptées.
     */
    if (env.NODE_ENV !== "production") {
      return callback(null, true);
    }

    /*
     * En production, l’origine doit être
     * présente dans ALLOWED_ORIGINS.
     */
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(
      new Error("Origin not allowed")
    );
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Authorization",
    "Content-Type",
    "X-Company-Session-ID",
  ],

  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

/*
 * Lecture des corps JSON.
 */
app.use(
  express.json({
    limit: "1mb",
  })
);

/*
 * Lecture des formulaires URL-encoded.
 *
 * Les images multipart restent prises en
 * charge par Multer dans productRoutes.
 */
app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

/*
 * Limitation globale des requêtes API.
 */
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
 * Informations publiques du backend.
 */
app.get("/", (request, response) => {
  return response.status(200).json({
    success: true,
    application: "SGJ Boutique API",
    version: "1.0.0",
  });
});

/*
 * Vérification de disponibilité.
 */
app.get(
  "/api/health",
  (request, response) => {
    return response.status(200).json({
      success: true,
      status: "healthy",
      environment: env.NODE_ENV,
      timestamp:
        new Date().toISOString(),
    });
  }
);

/*
 * AUTHENTIFICATION ET ADMINISTRATION
 *
 * Routes officielles :
 *
 * GET  /api/admin/auth/access/status
 * POST /api/admin/auth/access/request
 * GET  /api/admin/auth/access-requests
 * GET  /api/admin/auth/authorized-users
 * POST /api/admin/auth/users/:userId/action
 * POST /api/admin/auth/company-password/setup
 * POST /api/admin/auth/company-password/verify
 * POST /api/admin/auth/company-password/logout
 */
app.use(
  "/api/admin/auth",
  adminAuthRoutes
);

/*
 * CATÉGORIES
 */
app.use(
  "/api/admin/categories",
  categoryRoutes
);

/*
 * FOURNISSEURS
 */
app.use(
  "/api/admin/suppliers",
  supplierRoutes
);

/*
 * COMPATIBILITÉ AVEC LES ANCIENNES URLS
 *
 * Certaines parties du frontend utilisent
 * encore des URL administratives commençant
 * par /api/admin/products.
 *
 * Exemples encore pris en charge :
 *
 * GET  /api/admin/products/access-status
 * POST /api/admin/products/access-request
 * GET  /api/admin/products/access-requests
 * GET  /api/admin/products/authorized-users
 * POST /api/admin/products/users/:userId/action
 * POST /api/admin/products/company-password/setup
 * POST /api/admin/products/company-password/verify
 * POST /api/admin/products/company-password/logout
 *
 * Ce montage doit rester avant stockRoutes
 * et productRoutes.
 *
 * Lorsqu’une route ne correspond pas à
 * adminAuthRoutes, Express continue vers
 * les routeurs suivants.
 */
app.use(
  "/api/admin/products",
  adminAuthRoutes
);

/*
 * HISTORIQUE GLOBAL DU STOCK
 *
 * Cette route doit rester avant productRoutes
 * afin que "stock-history" ne soit jamais
 * interprété comme un productId.
 *
 * Route :
 * GET /api/admin/products/stock-history
 */
app.use(
  "/api/admin/products/stock-history",
  stockRoutes
);

/*
 * PARFUMS
 *
 * Ce routeur contient notamment des routes
 * dynamiques utilisant /:productId.
 *
 * Il doit donc rester après :
 *
 * 1. l’alias administratif ;
 * 2. la route fixe stock-history.
 */
app.use(
  "/api/admin/products",
  productRoutes
);

/*
 * Route inexistante.
 *
 * Ce middleware doit obligatoirement rester
 * après tous les routeurs de l’application.
 */
app.use((request, response) => {
  return response.status(404).json({
    success: false,
    error: "Route not found",
    method: request.method,
    path: request.originalUrl,
  });
});

/*
 * Gestion centralisée des erreurs.
 *
 * Ce middleware doit rester en dernière
 * position.
 */
app.use(
  (
    error,
    request,
    response,
    next
  ) => {
    console.error(
      "Unhandled backend error:",
      error
    );

    /*
     * Origine refusée par CORS.
     */
    if (
      error.message ===
      "Origin not allowed"
    ) {
      return response.status(403).json({
        success: false,
        error: "Origin not allowed",
      });
    }

    /*
     * Corps JSON invalide.
     */
    if (
      error instanceof SyntaxError &&
      error.status === 400 &&
      "body" in error
    ) {
      return response.status(400).json({
        success: false,
        error: "Invalid JSON body",
      });
    }

    return response.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
);

/*
 * Démarrage local uniquement.
 *
 * Sur Vercel, la variable VERCEL vaut "1".
 * Dans ce cas, l’application est exportée
 * sans ouvrir manuellement un port.
 */
if (process.env.VERCEL !== "1") {
  app.listen(port, () => {
    console.log(
      `SGJ Boutique API running on port ${port}`
    );
  });
}

/*
 * Point d’entrée Express unique utilisé
 * automatiquement par Vercel.
 */
export default app;
