import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load DATABASE_URL from .env.local (Vercel/Neon convention) then .env.
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "./lib/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
