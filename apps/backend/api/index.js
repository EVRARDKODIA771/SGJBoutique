/*
 * Fonction Serverless Vercel unique.
 *
 * Toutes les requêtes du backend sont
 * transférées vers l’application Express
 * définie dans ../index.js.
 */

import app from "../index.js";

export default app;
