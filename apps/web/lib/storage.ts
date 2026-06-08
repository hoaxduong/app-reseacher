import "server-only"

import { mkdir, stat } from "node:fs/promises"
import { basename, extname, join, normalize, resolve } from "node:path"
import { randomUUID } from "node:crypto"

import { getConfig } from "@/lib/config"

export type StoragePaths = {
  apkDir: string
  iconDir: string
  mediaDir: string
  tempDir: string
}

export function getStoragePaths(): StoragePaths {
  const root = getConfig().absoluteStorageDir

  return {
    apkDir: join(root, "apks"),
    iconDir: join(root, "media", "icons"),
    mediaDir: join(root, "media"),
    tempDir: join(root, "tmp"),
  }
}

export async function ensureStorage() {
  const paths = getStoragePaths()
  await Promise.all([
    mkdir(paths.apkDir, { recursive: true }),
    mkdir(paths.iconDir, { recursive: true }),
    mkdir(paths.tempDir, { recursive: true }),
  ])
  return paths
}

export async function createTempApkPath() {
  const paths = await ensureStorage()
  return join(paths.tempDir, `${Date.now()}-${randomUUID()}.apk`)
}

export async function getStoredApkPath(sha256: string) {
  const paths = await ensureStorage()
  return join(paths.apkDir, `${sha256}.apk`)
}

export async function getIconOutputPath(artifactSha256: string, apkPath: string) {
  const paths = await ensureStorage()
  const extension = extname(apkPath).toLowerCase() || ".png"
  const filename = `${artifactSha256}-${basename(apkPath, extension)
    .replaceAll(/[^a-zA-Z0-9._-]/g, "-")
    .slice(0, 80)}${extension}`

  return {
    absolutePath: join(paths.iconDir, filename),
    storedPath: `icons/${filename}`,
  }
}

export function resolveMediaPath(mediaPath: string) {
  const { mediaDir } = getStoragePaths()
  const normalized = normalize(mediaPath).replace(/^(\.\.(\/|\\|$))+/, "")
  const absolutePath = resolve(mediaDir, normalized)
  const mediaRoot = resolve(mediaDir)

  if (!absolutePath.startsWith(mediaRoot)) {
    throw new Error("Invalid media path")
  }

  return absolutePath
}

export async function getFileSize(path: string) {
  return (await stat(path)).size
}
