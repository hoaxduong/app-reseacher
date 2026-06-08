import "server-only"

import { createWriteStream } from "node:fs"
import { rename, unlink } from "node:fs/promises"
import { Readable, Transform } from "node:stream"
import { pipeline } from "node:stream/promises"

import Busboy from "busboy"

import type { UploadedApk } from "@/lib/apk/types"
import { createUploadHashers, hashFile } from "@/lib/apk/hash"
import {
  assertApkFilename,
  assertUploadSize,
  UploadValidationError,
} from "@/lib/apk/validators"
import { createTempApkPath, getFileSize, getStoredApkPath } from "@/lib/storage"
import { extractApkFromXapk, validateApkZip } from "@/lib/apk/zip"

export async function readUploadedApk(
  request: Request,
  maxUploadBytes: number
): Promise<UploadedApk> {
  const contentType = request.headers.get("content-type")
  if (!contentType?.includes("multipart/form-data")) {
    throw new UploadValidationError("Expected multipart form data.")
  }

  if (!request.body) {
    throw new UploadValidationError("Upload body is missing.")
  }

  const tempPath = await createTempApkPath()
  let originalFilename = ""
  let sizeBytes = 0
  let uploadError: Error | null = null
  let extractedApkTempPath: string | null = null
  const hashers = createUploadHashers()
  const fileWrites: Promise<void>[] = []

  await new Promise<void>((resolve, reject) => {
    const busboy = Busboy({
      headers: { "content-type": contentType },
      limits: {
        fileSize: maxUploadBytes,
        files: 1,
      },
    })

    busboy.on("file", (_field, file, info) => {
      try {
        assertApkFilename(info.filename)
        originalFilename = info.filename
      } catch (error) {
        uploadError = error instanceof Error ? error : new Error(String(error))
        file.resume()
        return
      }

      file.on("limit", () => {
        uploadError = new UploadValidationError(
          `The uploaded APK exceeds the ${Math.floor(maxUploadBytes / 1024 / 1024)} MB limit.`,
          413
        )
      })

      const hashingStream = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          sizeBytes += chunk.length
          hashers.md5.update(chunk)
          hashers.sha1.update(chunk)
          hashers.sha256.update(chunk)
          callback(null, chunk)
        },
      })

      fileWrites.push(pipeline(file, hashingStream, createWriteStream(tempPath)))
    })

    busboy.on("filesLimit", () => {
      uploadError = new UploadValidationError("Upload one APK at a time.")
    })
    busboy.on("error", reject)
    busboy.on("finish", async () => {
      try {
        await Promise.all(fileWrites)
        resolve()
      } catch (error) {
        reject(error)
      }
    })

    Readable.fromWeb(
      request.body as unknown as Parameters<typeof Readable.fromWeb>[0]
    ).pipe(busboy)
  })

  try {
    if (uploadError) {
      throw uploadError
    }

    if (!originalFilename) {
      throw new UploadValidationError("No APK file was provided.")
    }

    assertUploadSize(sizeBytes, maxUploadBytes)

    const isXapk = originalFilename.toLowerCase().endsWith(".xapk")
    const analysisTempPath = isXapk ? await createTempApkPath() : tempPath
    extractedApkTempPath = isXapk ? analysisTempPath : null

    if (isXapk) {
      await extractApkFromXapk(tempPath, analysisTempPath, maxUploadBytes)
      await unlink(tempPath).catch(() => undefined)
      await validateApkZip(analysisTempPath, maxUploadBytes)
    } else {
      await validateApkZip(tempPath, maxUploadBytes)
    }

    const hashes = isXapk
      ? await hashFile(analysisTempPath)
      : {
          md5: hashers.md5.digest("hex"),
          sha1: hashers.sha1.digest("hex"),
          sha256: hashers.sha256.digest("hex"),
        }
    const storedPath = await getStoredApkPath(hashes.sha256)

    try {
      await rename(analysisTempPath, storedPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        await unlink(analysisTempPath)
      } else {
        throw error
      }
    }

    return {
      hashes,
      originalFilename,
      path: storedPath,
      sizeBytes: await getFileSize(storedPath),
    }
  } catch (error) {
    await unlink(tempPath).catch(() => undefined)
    if (extractedApkTempPath) {
      await unlink(extractedApkTempPath).catch(() => undefined)
    }
    throw error
  }
}
