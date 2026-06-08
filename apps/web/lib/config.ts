import "server-only"

import { resolve } from "node:path"

const DEFAULT_STORAGE_DIR = "./.data"
const DEFAULT_DB_PATH = "./.data/app-researcher.sqlite"
const DEFAULT_MAX_UPLOAD_MB = 200
const DEFAULT_ANALYSIS_TIMEOUT_MS = 30_000

function readPositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function getConfig() {
  const storageDir =
    process.env.APK_RESEARCHER_STORAGE_DIR ?? DEFAULT_STORAGE_DIR
  const maxUploadMb = readPositiveInteger(
    process.env.APK_RESEARCHER_MAX_UPLOAD_MB,
    DEFAULT_MAX_UPLOAD_MB
  )

  return {
    analysisTimeoutMs: readPositiveInteger(
      process.env.APK_RESEARCHER_ANALYSIS_TIMEOUT_MS,
      DEFAULT_ANALYSIS_TIMEOUT_MS
    ),
    aapt2Path: process.env.APK_RESEARCHER_AAPT2_PATH || "aapt2",
    apkSignerPath: process.env.APK_RESEARCHER_APKSIGNER_PATH || "apksigner",
    dbPath: process.env.APK_RESEARCHER_DB_PATH ?? DEFAULT_DB_PATH,
    maxUploadBytes: maxUploadMb * 1024 * 1024,
    maxUploadMb,
    storageDir,
    absoluteStorageDir: resolve(
      /*turbopackIgnore: true*/ process.cwd(),
      storageDir
    ),
  }
}
