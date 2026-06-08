import { relations } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const apps = sqliteTable("apps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  displayName: text("display_name").notNull(),
  packageName: text("package_name").unique(),
  sourceType: text("source_type", {
    enum: ["upload", "apkpure"],
  }).notNull(),
  apkPureUrl: text("apk_pure_url"),
  status: text("status", {
    enum: ["draft", "analyzing", "ready", "needs_tooling", "failed"],
  })
    .notNull()
    .default("draft"),
  currentArtifactId: integer("current_artifact_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const apkArtifacts = sqliteTable(
  "apk_artifacts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    originalFilename: text("original_filename").notNull(),
    storedPath: text("stored_path").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    source: text("source", { enum: ["upload", "apkpure"] }).notNull(),
    md5: text("md5").notNull(),
    sha1: text("sha1").notNull(),
    sha256: text("sha256").notNull().unique(),
    uploadedAt: integer("uploaded_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("apk_artifacts_app_idx").on(table.appId)]
)

export const analysisRuns = sqliteTable(
  "analysis_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    artifactId: integer("artifact_id").references(() => apkArtifacts.id, {
      onDelete: "set null",
    }),
    status: text("status", {
      enum: ["running", "completed", "needs_tooling", "failed"],
    }).notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    durationMs: integer("duration_ms"),
    toolVersions: text("tool_versions"),
    errorJson: text("error_json"),
    summaryJson: text("summary_json"),
  },
  (table) => [
    index("analysis_runs_app_idx").on(table.appId),
    index("analysis_runs_artifact_idx").on(table.artifactId),
  ]
)

export const appVersions = sqliteTable("app_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appId: integer("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  artifactId: integer("artifact_id").references(() => apkArtifacts.id, {
    onDelete: "cascade",
  }),
  runId: integer("run_id")
    .notNull()
    .references(() => analysisRuns.id, { onDelete: "cascade" }),
  versionName: text("version_name"),
  versionCode: text("version_code"),
  minSdk: text("min_sdk"),
  targetSdk: text("target_sdk"),
  compileSdk: text("compile_sdk"),
})

export const appPermissions = sqliteTable("app_permissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appId: integer("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  runId: integer("run_id")
    .notNull()
    .references(() => analysisRuns.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  source: text("source").notNull(),
  protectionLevel: text("protection_level"),
})

export const appSdks = sqliteTable("app_sdks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appId: integer("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  runId: integer("run_id")
    .notNull()
    .references(() => analysisRuns.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  evidence: text("evidence").notNull(),
  confidence: integer("confidence").notNull(),
})

export const appResources = sqliteTable("app_resources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appId: integer("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  runId: integer("run_id")
    .notNull()
    .references(() => analysisRuns.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  name: text("name").notNull(),
  value: text("value"),
  path: text("path"),
})

export const appStrings = sqliteTable("app_strings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appId: integer("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  runId: integer("run_id")
    .notNull()
    .references(() => analysisRuns.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  source: text("source").notNull(),
  locale: text("locale"),
})

export const appCertificates = sqliteTable("app_certificates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appId: integer("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  runId: integer("run_id")
    .notNull()
    .references(() => analysisRuns.id, { onDelete: "cascade" }),
  subject: text("subject"),
  issuer: text("issuer"),
  serialNumber: text("serial_number"),
  validFrom: text("valid_from"),
  validTo: text("valid_to"),
  sha1: text("sha1"),
  sha256: text("sha256"),
  pem: text("pem"),
})

export const appComponents = sqliteTable("app_components", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appId: integer("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  runId: integer("run_id")
    .notNull()
    .references(() => analysisRuns.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  name: text("name").notNull(),
  exported: text("exported"),
  permission: text("permission"),
  intentFiltersJson: text("intent_filters_json"),
})

export const appFiles = sqliteTable("app_files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appId: integer("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  runId: integer("run_id")
    .notNull()
    .references(() => analysisRuns.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  kind: text("kind").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  compressedSizeBytes: integer("compressed_size_bytes").notNull(),
  sha256: text("sha256"),
})

export const appIcons = sqliteTable("app_icons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appId: integer("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  runId: integer("run_id")
    .notNull()
    .references(() => analysisRuns.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  storedPath: text("stored_path").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  density: text("density"),
})

export const appScreenshots = sqliteTable("app_screenshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appId: integer("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  sourceUrl: text("source_url"),
  storedPath: text("stored_path"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const appRelations = relations(apps, ({ many, one }) => ({
  artifacts: many(apkArtifacts),
  currentArtifact: one(apkArtifacts, {
    fields: [apps.currentArtifactId],
    references: [apkArtifacts.id],
  }),
  analysisRuns: many(analysisRuns),
}))

export const artifactRelations = relations(apkArtifacts, ({ one }) => ({
  app: one(apps, {
    fields: [apkArtifacts.appId],
    references: [apps.id],
  }),
}))

export const analysisRunRelations = relations(analysisRuns, ({ one }) => ({
  app: one(apps, {
    fields: [analysisRuns.appId],
    references: [apps.id],
  }),
  artifact: one(apkArtifacts, {
    fields: [analysisRuns.artifactId],
    references: [apkArtifacts.id],
  }),
}))
