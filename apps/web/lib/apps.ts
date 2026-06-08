import "server-only"

import { unlink } from "node:fs/promises"

import { and, desc, eq } from "drizzle-orm"

import {
  analysisRuns,
  appCertificates,
  appComponents,
  appFiles,
  appIcons,
  appPermissions,
  appResources,
  appScreenshots,
  appSdks,
  appStrings,
  appVersions,
  apps,
  apkArtifacts,
} from "@/lib/db/schema"
import { analyzeArtifact } from "@/lib/apk/analyzer"
import type { UploadedApk } from "@/lib/apk/types"
import { getDb } from "@/lib/db/client"
import { resolveMediaPath } from "@/lib/storage"

function now() {
  return new Date()
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function artifactDto(
  artifact: typeof apkArtifacts.$inferSelect | null | undefined
) {
  if (!artifact) {
    return null
  }

  return {
    md5: artifact.md5,
    originalFilename: artifact.originalFilename,
    sha1: artifact.sha1,
    sha256: artifact.sha256,
    sizeBytes: artifact.sizeBytes,
    source: artifact.source,
    uploadedAt: artifact.uploadedAt.toISOString(),
  }
}

function appDto(app: typeof apps.$inferSelect) {
  return {
    apkPureUrl: app.apkPureUrl,
    createdAt: app.createdAt.toISOString(),
    displayName: app.displayName,
    packageName: app.packageName,
    sourceType: app.sourceType,
    status: app.status,
    updatedAt: app.updatedAt.toISOString(),
  }
}

function getAppSummaryById(appId: number) {
  const db = getDb()
  const app = db.select().from(apps).where(eq(apps.id, appId)).get()

  if (!app || app.sourceType !== "upload") {
    return null
  }

  const currentArtifact = app.currentArtifactId
    ? db
        .select()
        .from(apkArtifacts)
        .where(eq(apkArtifacts.id, app.currentArtifactId))
        .get()
    : null
  const latestRun = db
    .select()
    .from(analysisRuns)
    .where(eq(analysisRuns.appId, app.id))
    .orderBy(desc(analysisRuns.startedAt))
    .limit(1)
    .get()
  const icon = latestRun
    ? db
        .select()
        .from(appIcons)
        .where(eq(appIcons.runId, latestRun.id))
        .limit(1)
        .get()
    : null

  return {
    ...appDto(app),
    currentArtifact: artifactDto(currentArtifact),
    iconUrl: icon ? `/api/media/${icon.storedPath}` : null,
    latestRun: latestRun
      ? {
          completedAt: latestRun.completedAt?.toISOString() ?? null,
          durationMs: latestRun.durationMs,
          errorCount: parseJson<unknown[]>(latestRun.errorJson, []).length,
          id: latestRun.id,
          status: latestRun.status,
        }
      : null,
  }
}

function getUploadResultByArtifactId(artifactId: number) {
  const db = getDb()
  const artifact = db
    .select()
    .from(apkArtifacts)
    .where(eq(apkArtifacts.id, artifactId))
    .get()

  if (!artifact) {
    return {
      app: null,
      artifact: null,
    }
  }

  return {
    app: getAppSummaryById(artifact.appId),
    artifact: artifactDto(artifact),
  }
}

export async function createAppFromUploadedApk(upload: UploadedApk) {
  const db = getDb()
  const duplicate = db
    .select({
      artifactId: apkArtifacts.id,
    })
    .from(apkArtifacts)
    .where(eq(apkArtifacts.sha256, upload.hashes.sha256))
    .get()

  if (duplicate) {
    return getUploadResultByArtifactId(duplicate.artifactId)
  }

  const app = db
    .insert(apps)
    .values({
      createdAt: now(),
      displayName: upload.originalFilename.replace(/\.(xapk|apk)$/i, ""),
      sourceType: "upload",
      status: "analyzing",
      updatedAt: now(),
    })
    .returning()
    .get()

  const artifact = db
    .insert(apkArtifacts)
    .values({
      appId: app.id,
      md5: upload.hashes.md5,
      originalFilename: upload.originalFilename,
      sha1: upload.hashes.sha1,
      sha256: upload.hashes.sha256,
      sizeBytes: upload.sizeBytes,
      source: "upload",
      storedPath: upload.path,
      uploadedAt: now(),
    })
    .returning()
    .get()

  db.update(apps)
    .set({
      currentArtifactId: artifact.id,
      status: "analyzing",
      updatedAt: now(),
    })
    .where(eq(apps.id, app.id))
    .run()

  await analyzeArtifact({
    appId: app.id,
    artifactId: artifact.id,
    makeCurrent: true,
  })

  return getUploadResultByArtifactId(artifact.id)
}

export function listAppSummaries() {
  const db = getDb()
  const rows = db
    .select()
    .from(apps)
    .where(eq(apps.sourceType, "upload"))
    .orderBy(desc(apps.updatedAt))
    .all()

  return rows
    .map((app) => getAppSummaryById(app.id))
    .filter((app) => app !== null)
}

export function listRecentRuns() {
  const db = getDb()
  return db
    .select({
      artifactSha256: apkArtifacts.sha256,
      displayName: apps.displayName,
      durationMs: analysisRuns.durationMs,
      id: analysisRuns.id,
      packageName: apps.packageName,
      startedAt: analysisRuns.startedAt,
      status: analysisRuns.status,
      summaryJson: analysisRuns.summaryJson,
    })
    .from(analysisRuns)
    .innerJoin(apps, eq(analysisRuns.appId, apps.id))
    .leftJoin(apkArtifacts, eq(analysisRuns.artifactId, apkArtifacts.id))
    .where(eq(apps.sourceType, "upload"))
    .orderBy(desc(analysisRuns.startedAt))
    .limit(8)
    .all()
    .map((run) => ({
      artifactSha256: run.artifactSha256,
      displayName: run.displayName,
      durationMs: run.durationMs,
      id: run.id,
      packageName: run.packageName,
      startedAt: run.startedAt.toISOString(),
      status: run.status,
      summary: parseJson<Record<string, number>>(run.summaryJson, {}),
    }))
}

export function getCurrentAppVersion(packageName: string) {
  const db = getDb()
  const app = db
    .select()
    .from(apps)
    .where(eq(apps.packageName, packageName))
    .get()

  if (!app || app.sourceType !== "upload" || !app.currentArtifactId) {
    return null
  }

  const artifact = db
    .select()
    .from(apkArtifacts)
    .where(eq(apkArtifacts.id, app.currentArtifactId))
    .get()

  if (!artifact) {
    return null
  }

  return {
    packageName: app.packageName,
    sha256: artifact.sha256,
  }
}

export function getAppVersionDetail(packageName: string, sha256: string) {
  const db = getDb()
  const app = db
    .select()
    .from(apps)
    .where(eq(apps.packageName, packageName))
    .get()

  if (!app || app.sourceType !== "upload") {
    return null
  }

  const artifact = db
    .select()
    .from(apkArtifacts)
    .where(and(eq(apkArtifacts.appId, app.id), eq(apkArtifacts.sha256, sha256)))
    .get()

  if (!artifact) {
    return null
  }

  const run = db
    .select()
    .from(analysisRuns)
    .where(
      and(eq(analysisRuns.appId, app.id), eq(analysisRuns.artifactId, artifact.id))
    )
    .orderBy(desc(analysisRuns.startedAt))
    .limit(1)
    .get()

  if (!run) {
    return {
      app: appDto(app),
      artifact: artifactDto(artifact),
      certificates: [],
      components: [],
      errors: [],
      files: [],
      icons: [],
      permissions: [],
      resources: [],
      run: null,
      screenshots: db
        .select()
        .from(appScreenshots)
        .where(eq(appScreenshots.appId, app.id))
        .all()
        .map((screenshot) => ({
          ...screenshot,
          createdAt: screenshot.createdAt.toISOString(),
        })),
      sdks: [],
      strings: [],
      version: null,
    }
  }

  const version = db
    .select()
    .from(appVersions)
    .where(and(eq(appVersions.appId, app.id), eq(appVersions.runId, run.id)))
    .limit(1)
    .get()

  return {
    app: appDto(app),
    artifact: artifactDto(artifact),
    certificates: db
      .select()
      .from(appCertificates)
      .where(eq(appCertificates.runId, run.id))
      .all(),
    components: db
      .select()
      .from(appComponents)
      .where(eq(appComponents.runId, run.id))
      .all()
      .map((component) => ({
        ...component,
        intentFilters: parseJson<string[]>(component.intentFiltersJson, []),
      })),
    errors: parseJson<Array<{ message: string; tool?: string }>>(
      run.errorJson,
      []
    ),
    files: db
      .select()
      .from(appFiles)
      .where(eq(appFiles.runId, run.id))
      .all(),
    icons: db
      .select()
      .from(appIcons)
      .where(eq(appIcons.runId, run.id))
      .all()
      .map((icon) => ({ ...icon, url: `/api/media/${icon.storedPath}` })),
    permissions: db
      .select()
      .from(appPermissions)
      .where(eq(appPermissions.runId, run.id))
      .all(),
    resources: db
      .select()
      .from(appResources)
      .where(eq(appResources.runId, run.id))
      .limit(1500)
      .all(),
    run: {
      ...run,
      completedAt: run.completedAt?.toISOString() ?? null,
      errors: parseJson<Array<{ message: string; tool?: string }>>(
        run.errorJson,
        []
      ),
      startedAt: run.startedAt.toISOString(),
      summary: parseJson<Record<string, number>>(run.summaryJson, {}),
      toolVersions: parseJson<Record<string, string>>(run.toolVersions, {}),
    },
    screenshots: db
      .select()
      .from(appScreenshots)
      .where(eq(appScreenshots.appId, app.id))
      .all()
      .map((screenshot) => ({
        ...screenshot,
        createdAt: screenshot.createdAt.toISOString(),
      })),
    sdks: db.select().from(appSdks).where(eq(appSdks.runId, run.id)).all(),
    strings: db
      .select()
      .from(appStrings)
      .where(eq(appStrings.runId, run.id))
      .limit(1500)
      .all(),
    version: version ?? null,
  }
}

export async function reanalyzeAppVersion(packageName: string, sha256: string) {
  const db = getDb()
  const app = db
    .select()
    .from(apps)
    .where(eq(apps.packageName, packageName))
    .get()

  if (!app || app.sourceType !== "upload") {
    return null
  }

  const artifact = db
    .select()
    .from(apkArtifacts)
    .where(and(eq(apkArtifacts.appId, app.id), eq(apkArtifacts.sha256, sha256)))
    .get()

  if (!artifact) {
    return null
  }

  const running = db
    .select({ id: analysisRuns.id })
    .from(analysisRuns)
    .where(
      and(
        eq(analysisRuns.appId, app.id),
        eq(analysisRuns.artifactId, artifact.id),
        eq(analysisRuns.status, "running")
      )
    )
    .limit(1)
    .get()

  if (running) {
    return {
      conflict: true as const,
    }
  }

  const result = await analyzeArtifact({
    appId: app.id,
    artifactId: artifact.id,
    makeCurrent: app.currentArtifactId === artifact.id,
  })

  return {
    conflict: false as const,
    runId: result.runId,
  }
}

function collectStoredFilePaths(appId: number) {
  const db = getDb()
  const filePaths = new Set<string>()

  for (const artifact of db
    .select({ storedPath: apkArtifacts.storedPath })
    .from(apkArtifacts)
    .where(eq(apkArtifacts.appId, appId))
    .all()) {
    filePaths.add(artifact.storedPath)
  }

  for (const icon of db
    .select({ storedPath: appIcons.storedPath })
    .from(appIcons)
    .where(eq(appIcons.appId, appId))
    .all()) {
    filePaths.add(resolveMediaPath(icon.storedPath))
  }

  for (const screenshot of db
    .select({ storedPath: appScreenshots.storedPath })
    .from(appScreenshots)
    .where(eq(appScreenshots.appId, appId))
    .all()) {
    if (screenshot.storedPath) {
      filePaths.add(resolveMediaPath(screenshot.storedPath))
    }
  }

  return [...filePaths]
}

async function deleteStoredFiles(paths: string[]) {
  const warnings: string[] = []

  await Promise.all(
    paths.map(async (path) => {
      try {
        await unlink(path)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          warnings.push(
            `Unable to delete ${path}: ${
              error instanceof Error ? error.message : String(error)
            }`
          )
        }
      }
    })
  )

  return warnings
}

async function deleteAppById(appId: number) {
  const db = getDb()
  const storedFilePaths = collectStoredFilePaths(appId)

  db.delete(apps).where(eq(apps.id, appId)).run()

  return {
    warnings: await deleteStoredFiles(storedFilePaths),
  }
}

export async function deleteAppByPackageName(packageName: string) {
  const app = getDb()
    .select()
    .from(apps)
    .where(eq(apps.packageName, packageName))
    .get()

  if (!app || app.sourceType !== "upload") {
    return null
  }

  return deleteAppById(app.id)
}

export async function deleteUnidentifiedAppByArtifactSha256(sha256: string) {
  const db = getDb()
  const artifact = db
    .select()
    .from(apkArtifacts)
    .where(eq(apkArtifacts.sha256, sha256))
    .get()

  if (!artifact) {
    return null
  }

  const app = db.select().from(apps).where(eq(apps.id, artifact.appId)).get()

  if (!app || app.sourceType !== "upload" || app.packageName) {
    return null
  }

  return deleteAppById(app.id)
}
