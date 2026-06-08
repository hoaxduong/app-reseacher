import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.APK_RESEARCHER_DB_PATH ?? "./.data/app-researcher.sqlite",
  },
  out: "./drizzle",
  schema: "./lib/db/schema.ts",
})
