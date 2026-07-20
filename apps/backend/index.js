import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import {
  env,
  allowedOrigins,
} from "./src/config/env.js";

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
      // Autorise les appels sans origine :
      // applications mobiles, outils serveur et tests directs.
      if (!origin) {
        return callback(null, true);
      }

      // En développement, toutes les origines sont acceptées.
      // En production, seules les origines enregistrées sont acceptées.
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

app.get("/", (request, response) => {
  response.status(200).json({
    success: true,
    application: "SGJ Boutique API",
    version: "1.0.0",
  });
});

app.get("/api/health", (request, response) => {
  response.status(200).json({
    success: true,
    status: "healthy",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Cette route intercepte toutes les adresses inexistantes.
app.use((request, response) => {
  response.status(404).json({
    success: false,
    error: "Route not found",
  });
});

// Gestion centrale des erreurs Express.
app.use((error, request, response, next) => {
  console.error(error);

  if (error.message === "Origin not allowed") {
    return response.status(403).json({
      success: false,
      error: "Origin not allowed",
    });
  }

  return response.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

// En local, Node démarre le serveur normalement.
// Sur Vercel, l’application Express exportée devient une fonction.
if (env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(
      `SGJ Boutique API running on port ${port}`
    );
  });
}

export default app;
