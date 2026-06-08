import "server-only"

import { createHash } from "node:crypto"
import { createWriteStream } from "node:fs"
import { pipeline } from "node:stream/promises"

import yauzl from "yauzl"

import type { ApkFileEntry, ApkFileKind } from "@/lib/apk/types"
import { getFileSize, getIconOutputPath } from "@/lib/storage"
import { isUnsafeZipPath, UploadValidationError } from "@/lib/apk/validators"

const MAX_ENTRY_HASH_BYTES = 2 * 1024 * 1024
const MAX_DEX_STRING_SCAN_BYTES = 8 * 1024 * 1024
const MAX_UNCOMPRESSED_RATIO = 12

function openZip(path: string) {
  return new Promise<yauzl.ZipFile>((resolve, reject) => {
    yauzl.open(path, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) {
        reject(error ?? new Error("Unable to open APK."))
        return
      }

      resolve(zip)
    })
  })
}

function openEntryStream(zip: yauzl.ZipFile, entry: yauzl.Entry) {
  return new Promise<NodeJS.ReadableStream>((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(error ?? new Error(`Unable to read ${entry.fileName}.`))
        return
      }

      resolve(stream)
    })
  })
}

export function classifyApkEntry(path: string): ApkFileKind {
  const lower = path.toLowerCase()

  if (path === "AndroidManifest.xml") {
    return "manifest"
  }

  if (lower.endsWith(".dex")) {
    return "dex"
  }

  if (path === "resources.arsc") {
    return "resource_table"
  }

  if (lower.startsWith("meta-inf/")) {
    if (/\.(rsa|dsa|ec|sf)$/.test(lower)) {
      return "certificate"
    }
    return "metadata"
  }

  if (lower.startsWith("res/")) {
    return "resource"
  }

  if (lower.startsWith("assets/")) {
    return "asset"
  }

  if (lower.startsWith("lib/") && lower.endsWith(".so")) {
    return "native_library"
  }

  return "unknown"
}

export async function validateApkZip(path: string, maxBytes: number) {
  const zip = await openZip(path)
  const archiveSize = await getFileSize(path)

  return new Promise<void>((resolve, reject) => {
    let hasManifest = false
    let totalUncompressedSize = 0

    zip.readEntry()
    zip.on("entry", (entry) => {
      if (isUnsafeZipPath(entry.fileName)) {
        zip.close()
        reject(new UploadValidationError("The APK contains an unsafe ZIP path."))
        return
      }

      if (entry.fileName === "AndroidManifest.xml") {
        hasManifest = true
      }

      totalUncompressedSize += entry.uncompressedSize
      if (
        totalUncompressedSize >
        Math.max(maxBytes, archiveSize) * MAX_UNCOMPRESSED_RATIO
      ) {
        zip.close()
        reject(new UploadValidationError("The APK expands too much to inspect safely."))
        return
      }

      zip.readEntry()
    })
    zip.on("error", reject)
    zip.on("end", () => {
      if (!hasManifest) {
        reject(new UploadValidationError("The APK does not contain AndroidManifest.xml."))
        return
      }

      resolve()
    })
  })
}

function scoreXapkApkCandidate(path: string) {
  const lower = path.toLowerCase()
  let score = 0

  if (lower === "base.apk") {
    score += 100
  }
  if (lower.endsWith("/base.apk")) {
    score += 90
  }
  if (!lower.includes("config.") && !lower.includes("split_config.")) {
    score += 30
  }
  if (!lower.includes("/")) {
    score += 10
  }

  return score
}

export async function extractApkFromXapk(
  xapkPath: string,
  outputPath: string,
  maxBytes: number
) {
  const zip = await openZip(xapkPath)
  const archiveSize = await getFileSize(xapkPath)

  return new Promise<{ entryPath: string }>((resolve, reject) => {
    let totalUncompressedSize = 0
    const candidates: yauzl.Entry[] = []

    zip.readEntry()
    zip.on("entry", (entry) => {
      if (isUnsafeZipPath(entry.fileName)) {
        zip.close()
        reject(new UploadValidationError("The XAPK contains an unsafe ZIP path."))
        return
      }

      totalUncompressedSize += entry.uncompressedSize
      if (
        totalUncompressedSize >
        Math.max(maxBytes, archiveSize) * MAX_UNCOMPRESSED_RATIO
      ) {
        zip.close()
        reject(new UploadValidationError("The XAPK expands too much to inspect safely."))
        return
      }

      if (!entry.fileName.endsWith("/") && entry.fileName.toLowerCase().endsWith(".apk")) {
        candidates.push(entry)
      }

      zip.readEntry()
    })
    zip.on("error", reject)
    zip.on("end", async () => {
      try {
        const candidate = candidates
          .sort((a, b) => {
            const scoreDelta =
              scoreXapkApkCandidate(b.fileName) -
              scoreXapkApkCandidate(a.fileName)

            return scoreDelta || b.uncompressedSize - a.uncompressedSize
          })[0]

        if (!candidate) {
          reject(new UploadValidationError("The XAPK does not contain an APK file."))
          return
        }

        const extractionZip = await openZip(xapkPath)
        extractionZip.readEntry()
        extractionZip.on("entry", async (entry) => {
          try {
            if (entry.fileName !== candidate.fileName) {
              extractionZip.readEntry()
              return
            }

            const stream = await openEntryStream(extractionZip, entry)
            await pipeline(stream, createWriteStream(outputPath))
            extractionZip.close()
            resolve({ entryPath: candidate.fileName })
          } catch (error) {
            reject(error)
          }
        })
        extractionZip.on("error", reject)
        extractionZip.on("end", () =>
          reject(new Error(`Entry ${candidate.fileName} was not found.`))
        )
      } catch (error) {
        reject(error)
      }
    })
  })
}

async function hashZipEntry(zip: yauzl.ZipFile, entry: yauzl.Entry) {
  const stream = await openEntryStream(zip, entry)
  const hash = createHash("sha256")

  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => hash.update(chunk))
    stream.on("error", reject)
    stream.on("end", resolve)
  })

  return hash.digest("hex")
}

export async function readZipInventory(path: string): Promise<ApkFileEntry[]> {
  const zip = await openZip(path)
  const files: ApkFileEntry[] = []

  return new Promise((resolve, reject) => {
    zip.readEntry()
    zip.on("entry", async (entry) => {
      try {
        if (entry.fileName.endsWith("/")) {
          zip.readEntry()
          return
        }

        files.push({
          compressedSizeBytes: entry.compressedSize,
          kind: classifyApkEntry(entry.fileName),
          path: entry.fileName,
          sha256:
            entry.uncompressedSize <= MAX_ENTRY_HASH_BYTES
              ? await hashZipEntry(zip, entry)
              : null,
          sizeBytes: entry.uncompressedSize,
        })

        zip.readEntry()
      } catch (error) {
        reject(error)
      }
    })
    zip.on("error", reject)
    zip.on("end", () => resolve(files))
  })
}

function iconCandidateScore(path: string) {
  const lower = path.toLowerCase()
  let score = 0

  if (lower.includes("ic_launcher")) {
    score += 50
  }
  if (lower.includes("mipmap")) {
    score += 20
  }
  if (lower.includes("xxxhdpi")) {
    score += 18
  } else if (lower.includes("xxhdpi")) {
    score += 15
  } else if (lower.includes("xhdpi")) {
    score += 12
  } else if (lower.includes("hdpi")) {
    score += 9
  } else if (lower.includes("mdpi")) {
    score += 6
  }
  if (/\.(png|webp)$/.test(lower)) {
    score += 10
  }

  return score
}

export function pickIconCandidate(
  files: ApkFileEntry[],
  aaptIconPaths: string[] = []
) {
  const aaptCandidates = files.filter((file) => aaptIconPaths.includes(file.path))

  if (aaptCandidates.length > 0) {
    return aaptCandidates.sort((a, b) => b.sizeBytes - a.sizeBytes)[0]
  }

  return files
    .filter((file) => {
      const lower = file.path.toLowerCase()
      return (
        file.kind === "resource" &&
        lower.includes("launcher") &&
        /\.(png|webp)$/.test(lower)
      )
    })
    .sort((a, b) => iconCandidateScore(b.path) - iconCandidateScore(a.path))[0]
}

export async function extractEntryToFile(
  apkPath: string,
  entryPath: string,
  outputPath: string
) {
  const zip = await openZip(apkPath)

  return new Promise<void>((resolve, reject) => {
    zip.readEntry()
    zip.on("entry", async (entry) => {
      try {
        if (entry.fileName !== entryPath) {
          zip.readEntry()
          return
        }

        const stream = await openEntryStream(zip, entry)
        await pipeline(stream, createWriteStream(outputPath))
        zip.close()
        resolve()
      } catch (error) {
        reject(error)
      }
    })
    zip.on("error", reject)
    zip.on("end", () => reject(new Error(`Entry ${entryPath} was not found.`)))
  })
}

export async function extractBestIcon(
  apkPath: string,
  artifactSha256: string,
  files: ApkFileEntry[],
  aaptIconPaths: string[] = []
) {
  const candidate = pickIconCandidate(files, aaptIconPaths)

  if (!candidate) {
    return null
  }

  const output = await getIconOutputPath(artifactSha256, candidate.path)
  await extractEntryToFile(apkPath, candidate.path, output.absolutePath)

  const density = candidate.path.match(/-(mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi)/)?.[1]

  return {
    density,
    path: candidate.path,
    sizeBytes: candidate.sizeBytes,
    storedPath: output.storedPath,
  }
}

export async function readDexStrings(apkPath: string, files: ApkFileEntry[]) {
  const dexFiles = files
    .filter(
      (file) =>
        file.kind === "dex" && file.sizeBytes <= MAX_DEX_STRING_SCAN_BYTES
    )
    .slice(0, 4)
  const strings = new Set<string>()

  for (const dexFile of dexFiles) {
    const zip = await openZip(apkPath)

    await new Promise<void>((resolve, reject) => {
      zip.readEntry()
      zip.on("entry", async (entry) => {
        try {
          if (entry.fileName !== dexFile.path) {
            zip.readEntry()
            return
          }

          const stream = await openEntryStream(zip, entry)
          stream.on("data", (chunk: Buffer) => {
            const text = chunk.toString("latin1")
            for (const match of text.matchAll(/[ -~]{5,160}/g)) {
              const value = match[0]?.trim()
              if (
                value &&
                /[./_$-]/.test(value) &&
                !value.includes("\u0000")
              ) {
                strings.add(value)
              }
            }
          })
          stream.on("error", reject)
          stream.on("end", () => {
            zip.close()
            resolve()
          })
        } catch (error) {
          reject(error)
        }
      })
      zip.on("error", reject)
      zip.on("end", resolve)
    })
  }

  return [...strings].slice(0, 2500)
}
