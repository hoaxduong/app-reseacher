import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { tmpdir } from "node:os"

import Database from "better-sqlite3"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { afterEach, describe, expect, it, vi } from "vitest"

import * as dbSchema from "@/lib/db/schema"

type DbGlobal = typeof globalThis & {
  __apkResearcherDb?: {
    sqlite?: {
      close: () => void
    }
  }
}

const testRoots: string[] = []

function migrateTestDatabase(path: string) {
  const sqlite = new Database(path)

  try {
    sqlite.pragma("foreign_keys = ON")
    migrate(drizzle(sqlite, { schema: dbSchema }), {
      migrationsFolder: resolve(process.cwd(), "drizzle"),
    })
  } finally {
    sqlite.close()
  }
}

function resetDbGlobal() {
  const state = (globalThis as DbGlobal).__apkResearcherDb
  state?.sqlite?.close()
  ;(globalThis as DbGlobal).__apkResearcherDb = undefined
}

async function prepareTestEnvironment() {
  vi.resetModules()
  resetDbGlobal()

  const root = await mkdtemp(join(tmpdir(), "app-researcher-"))
  const storageRoot = join(root, "storage")
  const dbPath = join(root, "test.sqlite")
  testRoots.push(root)
  process.env.APK_RESEARCHER_DB_PATH = dbPath
  process.env.APK_RESEARCHER_STORAGE_DIR = storageRoot

  await mkdir(join(storageRoot, "media"), { recursive: true })
  migrateTestDatabase(dbPath)

  return {
    dbPath,
    root,
    storageRoot,
  }
}

function mockAnalyzerDependencies({
  packageName,
  versionCode = "1",
  versionName = "1.0",
}: {
  packageName: string
  versionCode?: string
  versionName?: string
}) {
  vi.doMock("@/lib/apk/zip", () => ({
    extractBestIcon: vi.fn(async () => null),
    readDexStrings: vi.fn(async () => []),
    readZipInventory: vi.fn(async () => []),
  }))
  const runCli = vi.fn(async (_command: string, args: string[]) => {
    const subcommand = args[1]

    if (subcommand === "badging") {
      return {
        code: 0,
        stderr: "",
        stdout: `
package: name='${packageName}' versionCode='${versionCode}' versionName='${versionName}' compileSdkVersion='35'
sdkVersion:'23'
targetSdkVersion:'35'
application-label:'Example App'
`,
        timedOut: false,
      }
    }

    return {
      code: 0,
      stderr: "",
      stdout: "",
      timedOut: false,
    }
  })

  vi.doMock("@/lib/apk/cli", () => {
    class MissingToolError extends Error {
      constructor(readonly tool: string) {
        super(`${tool} is missing.`)
      }
    }

    return {
      MissingToolError,
      getToolVersion: vi.fn(async (_command: string, args: string[]) =>
        args[0] === "version" ? "aapt2 test" : "apksigner test"
      ),
      runCli,
    }
  })

  return { runCli }
}

async function createUpload(root: string, sha256: string) {
  const path = join(root, `${sha256}.apk`)
  await writeFile(path, sha256)

  return {
    hashes: {
      md5: `${sha256}-md5`,
      sha1: `${sha256}-sha1`,
      sha256,
    },
    originalFilename: `${sha256}.apk`,
    path,
    sizeBytes: sha256.length,
  }
}

async function loadDb() {
  const [{ getDb }, schema] = await Promise.all([
    import("@/lib/db/client"),
    import("@/lib/db/schema"),
  ])

  return {
    db: getDb(),
    schema,
  }
}

afterEach(async () => {
  resetDbGlobal()
  vi.resetModules()
  vi.clearAllMocks()

  await Promise.all(
    testRoots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  )
})

describe("app service", () => {
  it("creates an app version and resolves it by package and sha", async () => {
    const { root } = await prepareTestEnvironment()
    mockAnalyzerDependencies({ packageName: "com.example.app" })
    const {
      createAppFromUploadedApk,
      getAppVersionDetail,
      getCurrentAppVersion,
      listAppSummaries,
    } = await import("@/lib/apps")

    const result = await createAppFromUploadedApk(
      await createUpload(root, "sha-a")
    )

    expect(result.app?.packageName).toBe("com.example.app")
    expect(result.artifact?.sha256).toBe("sha-a")
    expect(getCurrentAppVersion("com.example.app")).toEqual({
      packageName: "com.example.app",
      sha256: "sha-a",
    })
    expect(getAppVersionDetail("com.example.app", "sha-a")?.version).toMatchObject({
      versionCode: "1",
      versionName: "1.0",
    })
    expect(listAppSummaries()).toHaveLength(1)
  })

  it("reuses a duplicate artifact hash", async () => {
    const { root } = await prepareTestEnvironment()
    mockAnalyzerDependencies({ packageName: "com.example.app" })
    const { createAppFromUploadedApk } = await import("@/lib/apps")
    const { db, schema } = await loadDb()

    await createAppFromUploadedApk(await createUpload(root, "sha-a"))
    await createAppFromUploadedApk(await createUpload(root, "sha-a"))

    expect(db.select().from(schema.apps).all()).toHaveLength(1)
    expect(db.select().from(schema.apkArtifacts).all()).toHaveLength(1)
    expect(db.select().from(schema.analysisRuns).all()).toHaveLength(1)
  })

  it("attaches a new hash for the same package as another app version", async () => {
    const { root } = await prepareTestEnvironment()
    mockAnalyzerDependencies({ packageName: "com.example.app" })
    const {
      createAppFromUploadedApk,
      getAppVersionDetail,
      getCurrentAppVersion,
    } = await import("@/lib/apps")
    const { db, schema } = await loadDb()

    await createAppFromUploadedApk(await createUpload(root, "sha-a"))
    await createAppFromUploadedApk(await createUpload(root, "sha-b"))

    const rows = db.select().from(schema.apps).all()
    const artifacts = db.select().from(schema.apkArtifacts).all()

    expect(rows).toHaveLength(1)
    expect(artifacts).toHaveLength(2)
    expect(new Set(artifacts.map((artifact) => artifact.appId))).toEqual(
      new Set([rows[0]?.id])
    )
    expect(getCurrentAppVersion("com.example.app")?.sha256).toBe("sha-b")
    expect(getAppVersionDetail("com.example.app", "sha-a")?.artifact?.sha256).toBe(
      "sha-a"
    )
    expect(getAppVersionDetail("com.example.app", "sha-b")?.artifact?.sha256).toBe(
      "sha-b"
    )
  })

  it("passes required manifest file flags for aapt2 XML dumps", async () => {
    const { root } = await prepareTestEnvironment()
    const { runCli } = mockAnalyzerDependencies({
      packageName: "com.example.app",
    })
    const { createAppFromUploadedApk } = await import("@/lib/apps")

    await createAppFromUploadedApk(await createUpload(root, "sha-a"))

    expect(runCli).toHaveBeenCalledWith(
      "aapt2",
      ["dump", "xmlstrings", "--file", "AndroidManifest.xml", expect.any(String)],
      expect.any(Number)
    )
    expect(runCli).toHaveBeenCalledWith(
      "aapt2",
      ["dump", "xmltree", "--file", "AndroidManifest.xml", expect.any(String)],
      expect.any(Number)
    )
  })

  it("deletes a package app and removes retained files", async () => {
    const { root, storageRoot } = await prepareTestEnvironment()
    const { deleteAppByPackageName } = await import("@/lib/apps")
    const { db, schema } = await loadDb()
    const artifactPath = join(root, "artifact.apk")
    const screenshotPath = join(storageRoot, "media", "screenshots", "screen.png")

    await mkdir(join(storageRoot, "media", "screenshots"), { recursive: true })
    await writeFile(artifactPath, "apk")
    await writeFile(screenshotPath, "screen")

    const app = db
      .insert(schema.apps)
      .values({
        createdAt: new Date(),
        displayName: "Example",
        packageName: "com.example.app",
        sourceType: "upload",
        status: "ready",
        updatedAt: new Date(),
      })
      .returning()
      .get()
    const artifact = db
      .insert(schema.apkArtifacts)
      .values({
        appId: app.id,
        md5: "md5",
        originalFilename: "artifact.apk",
        sha1: "sha1",
        sha256: "sha-a",
        sizeBytes: 3,
        source: "upload",
        storedPath: artifactPath,
        uploadedAt: new Date(),
      })
      .returning()
      .get()

    db.update(schema.apps)
      .set({ currentArtifactId: artifact.id })
      .where(eq(schema.apps.id, app.id))
      .run()
    db.insert(schema.appScreenshots)
      .values({
        appId: app.id,
        createdAt: new Date(),
        storedPath: "screenshots/screen.png",
      })
      .run()

    const result = await deleteAppByPackageName("com.example.app")

    expect(result?.warnings).toEqual([])
    expect(db.select().from(schema.apps).all()).toHaveLength(0)
    await expect(access(artifactPath)).rejects.toThrow()
    await expect(access(screenshotPath)).rejects.toThrow()
  })

  it("deletes an unidentified app by artifact sha", async () => {
    const { root } = await prepareTestEnvironment()
    const { deleteUnidentifiedAppByArtifactSha256 } = await import("@/lib/apps")
    const { db, schema } = await loadDb()
    const artifactPath = join(root, "unidentified.apk")

    await writeFile(artifactPath, "apk")
    const app = db
      .insert(schema.apps)
      .values({
        createdAt: new Date(),
        displayName: "Unidentified",
        sourceType: "upload",
        status: "failed",
        updatedAt: new Date(),
      })
      .returning()
      .get()
    db.insert(schema.apkArtifacts)
      .values({
        appId: app.id,
        md5: "md5",
        originalFilename: "unidentified.apk",
        sha1: "sha1",
        sha256: "sha-missing-package",
        sizeBytes: 3,
        source: "upload",
        storedPath: artifactPath,
        uploadedAt: new Date(),
      })
      .run()

    const result = await deleteUnidentifiedAppByArtifactSha256(
      "sha-missing-package"
    )

    expect(result?.warnings).toEqual([])
    expect(db.select().from(schema.apps).all()).toHaveLength(0)
    await expect(access(artifactPath)).rejects.toThrow()
  })

  it("rejects re-analysis while a selected version is already running", async () => {
    await prepareTestEnvironment()
    const { reanalyzeAppVersion } = await import("@/lib/apps")
    const { db, schema } = await loadDb()
    const app = db
      .insert(schema.apps)
      .values({
        createdAt: new Date(),
        displayName: "Example",
        packageName: "com.example.app",
        sourceType: "upload",
        status: "analyzing",
        updatedAt: new Date(),
      })
      .returning()
      .get()
    const artifact = db
      .insert(schema.apkArtifacts)
      .values({
        appId: app.id,
        md5: "md5",
        originalFilename: "artifact.apk",
        sha1: "sha1",
        sha256: "sha-a",
        sizeBytes: 3,
        source: "upload",
        storedPath: join(process.cwd(), "artifact.apk"),
        uploadedAt: new Date(),
      })
      .returning()
      .get()

    db.insert(schema.analysisRuns)
      .values({
        appId: app.id,
        artifactId: artifact.id,
        startedAt: new Date(),
        status: "running",
      })
      .run()

    await expect(
      reanalyzeAppVersion("com.example.app", "sha-a")
    ).resolves.toEqual({ conflict: true })
  })

  it("re-analyzes the selected version without making older artifacts current", async () => {
    await prepareTestEnvironment()
    const analyzeArtifact = vi.fn(
      async (input: { appId: number; artifactId: number; makeCurrent?: boolean }) => ({
        appId: input.appId,
        runId: 123,
      })
    )
    vi.doMock("@/lib/apk/analyzer", () => ({ analyzeArtifact }))
    const { reanalyzeAppVersion } = await import("@/lib/apps")
    const { db, schema } = await loadDb()
    const app = db
      .insert(schema.apps)
      .values({
        createdAt: new Date(),
        displayName: "Example",
        packageName: "com.example.app",
        sourceType: "upload",
        status: "ready",
        updatedAt: new Date(),
      })
      .returning()
      .get()
    const olderArtifact = db
      .insert(schema.apkArtifacts)
      .values({
        appId: app.id,
        md5: "md5-a",
        originalFilename: "old.apk",
        sha1: "sha1-a",
        sha256: "sha-a",
        sizeBytes: 3,
        source: "upload",
        storedPath: join(process.cwd(), "old.apk"),
        uploadedAt: new Date(),
      })
      .returning()
      .get()
    const currentArtifact = db
      .insert(schema.apkArtifacts)
      .values({
        appId: app.id,
        md5: "md5-b",
        originalFilename: "new.apk",
        sha1: "sha1-b",
        sha256: "sha-b",
        sizeBytes: 3,
        source: "upload",
        storedPath: join(process.cwd(), "new.apk"),
        uploadedAt: new Date(),
      })
      .returning()
      .get()

    db.update(schema.apps)
      .set({ currentArtifactId: currentArtifact.id })
      .where(eq(schema.apps.id, app.id))
      .run()

    await expect(
      reanalyzeAppVersion("com.example.app", "sha-a")
    ).resolves.toEqual({ conflict: false, runId: 123 })
    expect(analyzeArtifact).toHaveBeenCalledWith({
      appId: app.id,
      artifactId: olderArtifact.id,
      makeCurrent: false,
    })
  })
})
