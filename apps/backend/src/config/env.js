import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  SUPABASE_URL: z
    .string()
    .url("SUPABASE_URL must be a valid URL"),

  SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .startsWith(
      "sb_publishable_",
      "SUPABASE_PUBLISHABLE_KEY is missing or invalid"
    ),

  SUPABASE_SECRET_KEY: z
    .string()
    .startsWith(
      "sb_secret_",
      "SUPABASE_SECRET_KEY is missing or invalid"
    ),

  ALLOWED_ORIGINS: z
    .string()
    .default(""),
});

const validation =
  environmentSchema.safeParse(process.env);

if (!validation.success) {
  const invalidVariables =
    validation.error.issues.map(
      (issue) => issue.path.join(".")
    );

  console.error(
    "Invalid backend environment variables:",
    invalidVariables
  );

  throw new Error(
    "Backend environment configuration is invalid"
  );
}

export const env = validation.data;

export const allowedOrigins =
  env.ALLOWED_ORIGINS
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
