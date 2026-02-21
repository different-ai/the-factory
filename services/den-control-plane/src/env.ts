import { z } from "zod"

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().min(1),
  PORT: z.string().optional(),
  CORS_ORIGINS: z.string().optional(),
  PROVISIONER_MODE: z.enum(["stub", "render"]).optional(),
  WORKER_URL_TEMPLATE: z.string().optional(),
})

const parsed = schema.parse(process.env)

const corsOrigins = parsed.CORS_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)

export const env = {
  databaseUrl: parsed.DATABASE_URL,
  betterAuthSecret: parsed.BETTER_AUTH_SECRET,
  betterAuthUrl: parsed.BETTER_AUTH_URL,
  port: Number(parsed.PORT ?? "8788"),
  corsOrigins: corsOrigins ?? [],
  provisionerMode: parsed.PROVISIONER_MODE ?? "stub",
  workerUrlTemplate: parsed.WORKER_URL_TEMPLATE,
}
