export class UploadValidationError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message)
    this.name = "UploadValidationError"
  }
}

const blockedApkLikeExtensions = new Set([".apkm", ".apks", ".aab"])

export function assertApkFilename(filename: string) {
  const lower = filename.toLowerCase()

  for (const extension of blockedApkLikeExtensions) {
    if (lower.endsWith(extension)) {
      throw new UploadValidationError(
        `${extension.toUpperCase()} files are not supported in the MVP. Upload a .apk or .xapk file.`
      )
    }
  }

  if (!lower.endsWith(".apk") && !lower.endsWith(".xapk")) {
    throw new UploadValidationError("Only .apk and .xapk files are supported.")
  }
}

export function assertUploadSize(sizeBytes: number, maxBytes: number) {
  if (sizeBytes <= 0) {
    throw new UploadValidationError("The uploaded APK is empty.")
  }

  if (sizeBytes > maxBytes) {
    throw new UploadValidationError(
      `The uploaded APK exceeds the ${Math.floor(maxBytes / 1024 / 1024)} MB limit.`,
      413
    )
  }
}

export function isUnsafeZipPath(path: string) {
  return (
    path.startsWith("/") ||
    path.startsWith("\\") ||
    path.includes("\0") ||
    path.split(/[\\/]/).includes("..")
  )
}
