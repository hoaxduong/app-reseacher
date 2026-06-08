import "server-only"

import { eq } from "drizzle-orm"

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
import { detectSdks } from "@/lib/apk/sdk-detector"
import type {
  AnalysisStatus,
  ApkAnalysisResult,
  AppComponentInfo,
  AppPermissionInfo,
  AppResourceInfo,
  AppVersionInfo,
} from "@/lib/apk/types"
import { getConfig } from "@/lib/config"
import { getDb } from "@/lib/db/client"
import { getToolVersion, MissingToolError, runCli } from "@/lib/apk/cli"
import {
  mergeComponents,
  mergePermissions,
  parseAaptBadging,
  parseAaptPermissions,
  parseAaptResources,
  parseAaptStrings,
  parseAaptXmltreeComponents,
  parseApkSignerCertificates,
} from "@/lib/apk/parsers"
import { extractBestIcon, readDexStrings, readZipInventory } from "@/lib/apk/zip"

type AnalyzeArtifactInput = {
  appId: number
  artifactId: number
  makeCurrent?: boolean
}

function now() {
  return new Date()
}

function json(value: unknown) {
  return JSON.stringify(value)
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function parseResourcesFromFiles(files: Array<{ path: string }>): AppResourceInfo[] {
  return files
    .filter((file) => file.path.startsWith("res/"))
    .map((file) => {
      const parts = file.path.split("/")
      const type = parts[1]?.split("-")[0] ?? "resource"
      const name = parts.at(-1) ?? file.path

      return {
        name,
        path: file.path,
        type,
      }
    })
    .slice(0, 2000)
}

async function runAaptDump(
  subcommand: string,
  apkPath: string,
  errors: ApkAnalysisResult["errors"],
  options: string[] = []
) {
  const config = getConfig()

  try {
    const result = await runCli(
      config.aapt2Path,
      ["dump", subcommand, ...options, apkPath],
      config.analysisTimeoutMs
    )

    if (result.code !== 0 || result.timedOut) {
      errors.push({
        message:
          result.stderr.trim() ||
          `aapt2 dump ${subcommand} exited with code ${result.code}.`,
        tool: "aapt2",
      })
    }

    return result.stdout
  } catch (error) {
    if (error instanceof MissingToolError) {
      throw error
    }

    errors.push({
      message: error instanceof Error ? error.message : String(error),
      tool: "aapt2",
    })
    return ""
  }
}

async function runApkSigner(
  apkPath: string,
  errors: ApkAnalysisResult["errors"]
) {
  const config = getConfig()

  try {
    const result = await runCli(
      config.apkSignerPath,
      ["verify", "--print-certs", "--print-certs-pem", apkPath],
      config.analysisTimeoutMs
    )

    if (result.code !== 0 || result.timedOut) {
      errors.push({
        message:
          result.stderr.trim() ||
          `apksigner exited with code ${result.code}.`,
        tool: "apksigner",
      })
    }

    return `${result.stdout}\n${result.stderr}`
  } catch (error) {
    if (error instanceof MissingToolError) {
      throw error
    }

    errors.push({
      message: error instanceof Error ? error.message : String(error),
      tool: "apksigner",
    })
    return ""
  }
}

function mergeVersion(
  base: AppVersionInfo,
  updates: AppVersionInfo
): AppVersionInfo {
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    ),
  }
}

export async function analyzeArtifact(input: AnalyzeArtifactInput) {
  const db = getDb()
  const config = getConfig()
  const startedAt = now()
  const run = db
    .insert(analysisRuns)
    .values({
      appId: input.appId,
      artifactId: input.artifactId,
      startedAt,
      status: "running",
    })
    .returning({ id: analysisRuns.id })
    .get()

  const artifact = db
    .select()
    .from(apkArtifacts)
    .where(eq(apkArtifacts.id, input.artifactId))
    .get()

  if (!artifact) {
    throw new Error(`Artifact ${input.artifactId} was not found.`)
  }

  db.update(apps)
    .set({ status: "analyzing", updatedAt: now() })
    .where(eq(apps.id, input.appId))
    .run()

  const result: ApkAnalysisResult = {
    certificates: [],
    components: [],
    errors: [],
    files: [],
    icons: [],
    permissions: [],
    resources: [],
    sdks: [],
    strings: [],
    toolVersions: {},
    version: {},
  }

  let status: AnalysisStatus = "completed"
  let displayName: string | undefined

  try {
    result.files = await readZipInventory(artifact.storedPath)
    const dexStrings = await readDexStrings(artifact.storedPath, result.files)
    result.strings = uniqueStrings(dexStrings)
    result.resources = parseResourcesFromFiles(result.files)

    const aapt2Version = await getToolVersion(
      config.aapt2Path,
      ["version"],
      config.analysisTimeoutMs
    )

    if (!aapt2Version) {
      status = "needs_tooling"
      result.errors.push({
        message: "aapt2 is not configured or was not found on PATH.",
        tool: "aapt2",
      })
    } else {
      result.toolVersions.aapt2 = aapt2Version
      const badging = parseAaptBadging(
        await runAaptDump("badging", artifact.storedPath, result.errors)
      )
      result.version = mergeVersion(result.version, badging.version)
      result.permissions = mergePermissions(result.permissions, badging.permissions)
      result.components = mergeComponents(result.components, badging.components)

      result.permissions = mergePermissions(
        result.permissions,
        parseAaptPermissions(
          await runAaptDump("permissions", artifact.storedPath, result.errors)
        )
      )
      result.resources = [
        ...result.resources,
        ...parseAaptResources(
          await runAaptDump("resources", artifact.storedPath, result.errors)
        ),
      ].slice(0, 3000)
      result.strings = uniqueStrings([
        ...result.strings,
        ...parseAaptStrings(
          await runAaptDump("strings", artifact.storedPath, result.errors)
        ),
        ...parseAaptStrings(
          await runAaptDump(
            "xmlstrings",
            artifact.storedPath,
            result.errors,
            ["--file", "AndroidManifest.xml"]
          )
        ),
      ]).slice(0, 7000)
      result.components = mergeComponents(
        result.components,
        parseAaptXmltreeComponents(
          await runAaptDump(
            "xmltree",
            artifact.storedPath,
            result.errors,
            ["--file", "AndroidManifest.xml"]
          )
        ) as AppComponentInfo[]
      )

      const icon = await extractBestIcon(
        artifact.storedPath,
        artifact.sha256,
        result.files,
        badging.iconPaths
      )
      if (icon) {
        result.icons.push(icon)
      }

      displayName = badging.label
    }

    const apkSignerVersion = await getToolVersion(
      config.apkSignerPath,
      ["--version"],
      config.analysisTimeoutMs
    )

    if (!apkSignerVersion) {
      status = "needs_tooling"
      result.errors.push({
        message: "apksigner is not configured or was not found on PATH.",
        tool: "apksigner",
      })
    } else {
      result.toolVersions.apksigner = apkSignerVersion
      result.certificates = parseApkSignerCertificates(
        await runApkSigner(artifact.storedPath, result.errors)
      )
    }

    result.sdks = detectSdks(result.files, result.strings)

    persistAnalysisFacts({
      appId: input.appId,
      artifactId: input.artifactId,
      result,
      runId: run.id,
    })

    const completedAt = now()
    db.update(analysisRuns)
      .set({
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        errorJson: result.errors.length ? json(result.errors) : null,
        status,
        summaryJson: json({
          certificates: result.certificates.length,
          components: result.components.length,
          files: result.files.length,
          permissions: result.permissions.length,
          resources: result.resources.length,
          sdks: result.sdks.length,
          strings: result.strings.length,
        }),
        toolVersions: json(result.toolVersions),
      })
      .where(eq(analysisRuns.id, run.id))
      .run()

    const finalAppId = finalizeAnalyzedApp({
      appId: input.appId,
      artifactId: input.artifactId,
      displayName,
      makeCurrent: input.makeCurrent ?? true,
      packageName: result.version.packageName,
      runId: run.id,
      status: status === "completed" ? "ready" : "needs_tooling",
    })

    return {
      appId: finalAppId,
      runId: run.id,
    }
  } catch (error) {
    const completedAt = now()
    const message = error instanceof Error ? error.message : String(error)
    result.errors.push({ message })

    db.update(analysisRuns)
      .set({
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        errorJson: json(result.errors),
        status: "failed",
        summaryJson: json({ files: result.files.length }),
        toolVersions: json(result.toolVersions),
      })
      .where(eq(analysisRuns.id, run.id))
      .run()

    db.update(apps)
      .set({ status: "failed", updatedAt: now() })
      .where(eq(apps.id, input.appId))
      .run()
  }

  return {
    appId: input.appId,
    runId: run.id,
  }
}

function finalizeAnalyzedApp({
  appId,
  artifactId,
  displayName,
  makeCurrent,
  packageName,
  runId,
  status,
}: {
  appId: number
  artifactId: number
  displayName: string | undefined
  makeCurrent: boolean
  packageName: string | undefined
  runId: number
  status: "ready" | "needs_tooling"
}) {
  const db = getDb()
  const existingApp = packageName
    ? db.select().from(apps).where(eq(apps.packageName, packageName)).get()
    : null
  const updateValues = {
    ...(displayName ? { displayName } : {}),
    ...(makeCurrent ? { currentArtifactId: artifactId } : {}),
    ...(packageName ? { packageName } : {}),
    status,
    updatedAt: now(),
  }

  if (existingApp && existingApp.id !== appId) {
    moveRunToApp({
      artifactId,
      fromAppId: appId,
      runId,
      toAppId: existingApp.id,
    })

    db.update(apps).set(updateValues).where(eq(apps.id, existingApp.id)).run()
    db.delete(apps).where(eq(apps.id, appId)).run()

    return existingApp.id
  }

  db.update(apps).set(updateValues).where(eq(apps.id, appId)).run()
  return appId
}

function moveRunToApp({
  artifactId,
  fromAppId,
  runId,
  toAppId,
}: {
  artifactId: number
  fromAppId: number
  runId: number
  toAppId: number
}) {
  const db = getDb()

  db.update(apkArtifacts)
    .set({ appId: toAppId })
    .where(eq(apkArtifacts.id, artifactId))
    .run()
  db.update(analysisRuns)
    .set({ appId: toAppId })
    .where(eq(analysisRuns.id, runId))
    .run()
  db.update(appVersions)
    .set({ appId: toAppId })
    .where(eq(appVersions.runId, runId))
    .run()
  db.update(appPermissions)
    .set({ appId: toAppId })
    .where(eq(appPermissions.runId, runId))
    .run()
  db.update(appSdks)
    .set({ appId: toAppId })
    .where(eq(appSdks.runId, runId))
    .run()
  db.update(appResources)
    .set({ appId: toAppId })
    .where(eq(appResources.runId, runId))
    .run()
  db.update(appStrings)
    .set({ appId: toAppId })
    .where(eq(appStrings.runId, runId))
    .run()
  db.update(appCertificates)
    .set({ appId: toAppId })
    .where(eq(appCertificates.runId, runId))
    .run()
  db.update(appComponents)
    .set({ appId: toAppId })
    .where(eq(appComponents.runId, runId))
    .run()
  db.update(appFiles)
    .set({ appId: toAppId })
    .where(eq(appFiles.runId, runId))
    .run()
  db.update(appIcons)
    .set({ appId: toAppId })
    .where(eq(appIcons.runId, runId))
    .run()
  db.update(appScreenshots)
    .set({ appId: toAppId })
    .where(eq(appScreenshots.appId, fromAppId))
    .run()
}

function insertChunks<T>(items: T[], insert: (chunk: T[]) => void) {
  for (let index = 0; index < items.length; index += 250) {
    insert(items.slice(index, index + 250))
  }
}

function persistAnalysisFacts({
  appId,
  artifactId,
  result,
  runId,
}: {
  appId: number
  artifactId: number
  result: ApkAnalysisResult
  runId: number
}) {
  const db = getDb()

  db.insert(appVersions)
    .values({
      appId,
      artifactId,
      compileSdk: result.version.compileSdk,
      minSdk: result.version.minSdk,
      runId,
      targetSdk: result.version.targetSdk,
      versionCode: result.version.versionCode,
      versionName: result.version.versionName,
    })
    .run()

  insertChunks(result.permissions, (chunk: AppPermissionInfo[]) => {
    db.insert(appPermissions)
      .values(
        chunk.map((permission) => ({
          name: permission.name,
          appId,
          protectionLevel: permission.protectionLevel,
          runId,
          source: permission.source,
        }))
      )
      .run()
  })

  insertChunks(result.sdks, (chunk) => {
    db.insert(appSdks)
      .values(
        chunk.map((sdk) => ({
          confidence: sdk.confidence,
          evidence: sdk.evidence,
          name: sdk.name,
          appId,
          runId,
        }))
      )
      .run()
  })

  insertChunks(result.resources, (chunk) => {
    db.insert(appResources)
      .values(
        chunk.map((resource) => ({
          name: resource.name,
          path: resource.path,
          appId,
          runId,
          type: resource.type,
          value: resource.value,
        }))
      )
      .run()
  })

  insertChunks(result.strings, (chunk) => {
    db.insert(appStrings)
      .values(
        chunk.map((value) => ({
          appId,
          runId,
          source: value.includes("/") || value.includes(".") ? "dex" : "aapt2",
          value,
        }))
      )
      .run()
  })

  insertChunks(result.certificates, (chunk) => {
    db.insert(appCertificates)
      .values(
        chunk.map((certificate) => ({
          issuer: certificate.issuer,
          appId,
          pem: certificate.pem,
          runId,
          serialNumber: certificate.serialNumber,
          sha1: certificate.sha1,
          sha256: certificate.sha256,
          subject: certificate.subject,
          validFrom: certificate.validFrom,
          validTo: certificate.validTo,
        }))
      )
      .run()
  })

  insertChunks(result.components, (chunk) => {
    db.insert(appComponents)
      .values(
        chunk.map((component) => ({
          exported: component.exported,
          appId,
          intentFiltersJson: component.intentFilters?.length
            ? json(component.intentFilters)
            : null,
          name: component.name,
          permission: component.permission,
          runId,
          type: component.type,
        }))
      )
      .run()
  })

  insertChunks(result.files, (chunk) => {
    db.insert(appFiles)
      .values(
        chunk.map((file) => ({
          compressedSizeBytes: file.compressedSizeBytes,
          appId,
          kind: file.kind,
          path: file.path,
          runId,
          sha256: file.sha256,
          sizeBytes: file.sizeBytes,
        }))
      )
      .run()
  })

  insertChunks(result.icons, (chunk) => {
    db.insert(appIcons)
      .values(
        chunk.map((icon) => ({
          density: icon.density,
          appId,
          path: icon.path,
          runId,
          sizeBytes: icon.sizeBytes,
          storedPath: icon.storedPath,
        }))
      )
      .run()
  })
}
