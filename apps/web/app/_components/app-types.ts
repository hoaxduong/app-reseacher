export type ArtifactDto = {
  md5: string
  originalFilename: string
  sha1: string
  sha256: string
  sizeBytes: number
  source: string
  uploadedAt: string
}

export type AppSummary = {
  apkPureUrl: string | null
  createdAt: string
  currentArtifact: ArtifactDto | null
  displayName: string
  iconUrl: string | null
  latestRun: {
    completedAt: string | null
    durationMs: number | null
    errorCount: number
    id: number
    status: string
  } | null
  packageName: string | null
  sourceType: "upload" | "apkpure"
  status: "draft" | "analyzing" | "ready" | "needs_tooling" | "failed"
  updatedAt: string
}

export type RecentRun = {
  artifactSha256: string | null
  displayName: string
  durationMs: number | null
  id: number
  packageName: string | null
  startedAt: string
  status: string
  summary: Record<string, number>
}

export type WorkbenchData = {
  apps: AppSummary[]
  recentRuns: RecentRun[]
}

export type AppDetail = {
  app: {
    apkPureUrl: string | null
    createdAt: string
    displayName: string
    packageName: string | null
    sourceType: "upload" | "apkpure"
    status: "draft" | "analyzing" | "ready" | "needs_tooling" | "failed"
    updatedAt: string
  }
  artifact: ArtifactDto | null
  certificates: Array<{
    issuer: string | null
    serialNumber: string | null
    sha1: string | null
    sha256: string | null
    subject: string | null
    validFrom: string | null
    validTo: string | null
  }>
  components: Array<{
    exported: string | null
    intentFilters: string[]
    name: string
    permission: string | null
    type: string
  }>
  errors: Array<{ message: string; tool?: string }>
  files: Array<{
    compressedSizeBytes: number
    kind: string
    path: string
    sha256: string | null
    sizeBytes: number
  }>
  icons: Array<{
    density: string | null
    path: string
    sizeBytes: number
    url: string
  }>
  permissions: Array<{
    name: string
    protectionLevel: string | null
    source: string
  }>
  resources: Array<{
    name: string
    path: string | null
    type: string
    value: string | null
  }>
  run: {
    completedAt: string | null
    durationMs: number | null
    errors: Array<{ message: string; tool?: string }>
    startedAt: string
    status: string
    summary: Record<string, number>
    toolVersions: Record<string, string>
  } | null
  screenshots: Array<{
    createdAt: string
    sourceUrl: string | null
    storedPath: string | null
  }>
  sdks: Array<{
    confidence: number
    evidence: string
    name: string
  }>
  strings: Array<{
    source: string
    value: string
  }>
  version: {
    compileSdk: string | null
    minSdk: string | null
    targetSdk: string | null
    versionCode: string | null
    versionName: string | null
  } | null
}
