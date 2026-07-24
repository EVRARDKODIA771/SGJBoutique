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
 * Le middleware cors répond également aux
 * requêtes OPTIONS envoyées par le navigateur.
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
     * En développement, on accepte les origines
     * locales utilisées par Expo.
     */
    if (env.NODE_ENV !== "production") {
      return callback(null, true);
    }

    /*
     * En production, l’origine doit être présente
     * dans ALLOWED_ORIGINS.
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
 * Lecture des formulaires classiques.
 *
 * Les images multipart restent gérées par
 * Multer dans les routes concernées.
 */
app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

/*
 * Limitation des requêtes API.
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
 * Exemples :
 *
 * GET  /api/admin/auth/access/status
 * POST /api/admin/auth/access/request
 * GET  /api/admin/auth/access-requests
 * GET  /api/admin/auth/authorized-users
 * POST /api/admin/auth/users/:userId/action
 * POST /api/admin/auth/company-password/verify
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
 * HISTORIQUE GLOBAL DU STOCK
 *
 * Ce montage doit rester avant productRoutes.
 * Sinon, "stock-history" pourrait être traité
 * comme un productId.
 */
app.use(
  "/api/admin/products/stock-history",
  stockRoutes
);

/*
 * PARFUMS
 *
 * Ce routeur peut contenir des routes dynamiques
 * comme /:productId. Il doit donc rester après
 * la route fixe /stock-history.
 */
app.use(
  "/api/admin/products",
  productRoutes
);

/*
 * Route inexistante.
 *
 * Ce middleware doit rester après tous les
 * routeurs de l’application.
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
 * Ce middleware doit rester en dernière position.
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
     * Origine non autorisée par CORS.
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
 * Vercel définit automatiquement VERCEL="1".
 * Sur Vercel, l’application est donc exportée
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
