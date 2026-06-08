export type AnalysisStatus = "running" | "completed" | "needs_tooling" | "failed"

export type ApkHashes = {
  md5: string
  sha1: string
  sha256: string
}

export type UploadedApk = {
  originalFilename: string
  path: string
  sizeBytes: number
  hashes: ApkHashes
}

export type ApkFileKind =
  | "manifest"
  | "dex"
  | "resource"
  | "asset"
  | "native_library"
  | "certificate"
  | "resource_table"
  | "metadata"
  | "unknown"

export type ApkFileEntry = {
  compressedSizeBytes: number
  kind: ApkFileKind
  path: string
  sha256: string | null
  sizeBytes: number
}

export type AppVersionInfo = {
  compileSdk?: string
  minSdk?: string
  packageName?: string
  targetSdk?: string
  versionCode?: string
  versionName?: string
}

export type AppPermissionInfo = {
  name: string
  protectionLevel?: string
  source: string
}

export type AppComponentInfo = {
  exported?: string
  intentFilters?: string[]
  name: string
  permission?: string
  type: "activity" | "service" | "receiver" | "provider"
}

export type AppResourceInfo = {
  name: string
  path?: string
  type: string
  value?: string
}

export type AppCertificateInfo = {
  issuer?: string
  pem?: string
  serialNumber?: string
  sha1?: string
  sha256?: string
  subject?: string
  validFrom?: string
  validTo?: string
}

export type SdkDetection = {
  confidence: number
  evidence: string
  name: string
}

export type ExtractedIcon = {
  density?: string
  path: string
  sizeBytes: number
  storedPath: string
}

export type ApkAnalysisResult = {
  certificates: AppCertificateInfo[]
  components: AppComponentInfo[]
  errors: Array<{ message: string; tool?: string }>
  files: ApkFileEntry[]
  icons: ExtractedIcon[]
  permissions: AppPermissionInfo[]
  resources: AppResourceInfo[]
  sdks: SdkDetection[]
  strings: string[]
  toolVersions: Record<string, string>
  version: AppVersionInfo
}
