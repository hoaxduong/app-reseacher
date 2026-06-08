"use client"

import * as React from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ClockIcon,
  DatabaseIcon,
  FileSearchIcon,
  MoreHorizontalIcon,
  PackageIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { UploadCard } from "@/app/_components/upload-card"
import type {
  AppSummary,
  RecentRun,
  WorkbenchData,
} from "@/app/_components/app-types"
import { useWorkbenchStore } from "@/store/workbench-store"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

type MutationResponse = {
  warnings?: string[]
}

async function fetchApps() {
  const response = await fetch("/api/apps")

  if (!response.ok) {
    throw new Error("Unable to load apps.")
  }

  return (await response.json()) as WorkbenchData
}

async function mutateApp(url: string, method: "DELETE" | "POST") {
  const response = await fetch(url, { method })
  const payload = (await response.json().catch(() => ({}))) as
    | MutationResponse
    | { error?: string }

  if (!response.ok) {
    throw new Error("error" in payload ? payload.error : "Request failed.")
  }

  return payload as MutationResponse
}

function appVersionHref(
  packageName: string | null | undefined,
  sha256: string | null | undefined
) {
  if (!packageName || !sha256) {
    return null
  }

  return `/apps/${encodeURIComponent(packageName)}/versions/${sha256}`
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) {
    return "No APK"
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function statusVariant(status: string) {
  if (status === "failed") {
    return "destructive" as const
  }

  if (status === "ready" || status === "completed") {
    return "default" as const
  }

  if (status === "needs_tooling") {
    return "outline" as const
  }

  return "secondary" as const
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={statusVariant(status)}>
      {status.replaceAll("_", " ")}
    </Badge>
  )
}

function AppCard({ app }: { app: AppSummary }) {
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const queryClient = useQueryClient()
  const inspectHref = appVersionHref(
    app.packageName,
    app.currentArtifact?.sha256
  )
  const deleteUrl = app.packageName
    ? `/api/apps/${encodeURIComponent(app.packageName)}`
    : app.currentArtifact
      ? `/api/apps/unidentified/${app.currentArtifact.sha256}`
      : null
  const reanalyzeUrl = inspectHref
    ? `/api/apps/${encodeURIComponent(app.packageName!)}/versions/${app.currentArtifact!.sha256}/reanalyze`
    : null
  const canReanalyze = !!reanalyzeUrl && app.status !== "analyzing"
  const canDelete = !!deleteUrl
  const reanalyzeMutation = useMutation({
    mutationFn: () => mutateApp(reanalyzeUrl!, "POST"),
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: ["apps"] })
      toast.success("App version re-analyzed.")
    },
    onError(error) {
      toast.error(error instanceof Error ? error.message : "Re-analysis failed.")
    },
  })
  const deleteMutation = useMutation({
    mutationFn: () => mutateApp(deleteUrl!, "DELETE"),
    async onSuccess(result) {
      await queryClient.invalidateQueries({ queryKey: ["apps"] })
      setDeleteOpen(false)
      if (result.warnings?.length) {
        toast.warning("App deleted with file cleanup warnings.")
      } else {
        toast.success("App deleted.")
      }
    },
    onError(error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.")
    },
  })

  return (
    <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
              {app.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={app.iconUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <PackageIcon />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-base">
                {app.displayName}
              </CardTitle>
              <CardDescription className="truncate">
                {app.packageName ?? "No package yet"}
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-start gap-1">
              <StatusBadge status={app.status} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={`Open actions for ${app.displayName}`}
                    size="sm"
                    variant="outline"
                  >
                    <MoreHorizontalIcon data-icon="inline-start" />
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    {reanalyzeUrl && (
                      <>
                        <DropdownMenuItem
                          disabled={!canReanalyze || reanalyzeMutation.isPending}
                          onSelect={(event) => {
                            event.preventDefault()
                            if (canReanalyze) {
                              reanalyzeMutation.mutate()
                            }
                          }}
                        >
                          <RefreshCwIcon />
                          Re-analyze
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem
                      disabled={!canDelete}
                      variant="destructive"
                      onSelect={(event) => {
                        event.preventDefault()
                        if (canDelete) {
                          setDeleteOpen(true)
                        }
                      }}
                    >
                      <Trash2Icon />
                      Delete app
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Source</span>
              <span className="font-medium">{app.sourceType}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Artifact</span>
              <span className="font-medium">
                {formatBytes(app.currentArtifact?.sizeBytes)}
              </span>
            </div>
          </div>
          {app.currentArtifact && (
            <div className="min-w-0 rounded-lg bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
              <div className="truncate">sha256:{app.currentArtifact.sha256}</div>
            </div>
          )}
          <div className={canDelete ? "grid grid-cols-2 gap-2" : ""}>
            {inspectHref ? (
              <Button asChild variant="outline">
                <Link href={inspectHref}>
                  Inspect
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
            ) : (
              <Button disabled variant="outline">
                Inspect
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            )}
            {canDelete && (
              <Button
                disabled={deleteMutation.isPending}
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2Icon data-icon="inline-start" />
                Delete app
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete app</DialogTitle>
          <DialogDescription>
            This removes the app, every retained APK version, analysis output,
            icons, and screenshots from local storage.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            disabled={deleteMutation.isPending}
            variant="outline"
            onClick={() => setDeleteOpen(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={!canDelete || deleteMutation.isPending}
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
          >
            <Trash2Icon data-icon="inline-start" />
            {deleteMutation.isPending ? "Deleting..." : "Delete app"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RecentRunsTable({ runs }: { runs: RecentRun[] }) {
  if (runs.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <ClockIcon />
          <EmptyTitle>No analysis runs</EmptyTitle>
          <EmptyDescription>
            Upload an APK to populate the run history.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>App</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Facts</TableHead>
          <TableHead>Started</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => {
          const href = appVersionHref(run.packageName, run.artifactSha256)

          return (
            <TableRow key={run.id}>
              <TableCell>
                {href ? (
                  <Link href={href} className="font-medium hover:underline">
                    {run.displayName}
                  </Link>
                ) : (
                  <span className="font-medium">{run.displayName}</span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={run.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {Object.entries(run.summary)
                  .slice(0, 3)
                  .map(([key, value]) => `${value} ${key}`)
                  .join(", ") || "Pending"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(run.startedAt)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export function Workbench({ initialData }: { initialData: WorkbenchData }) {
  const query = useWorkbenchStore((state) => state.query)
  const setQuery = useWorkbenchStore((state) => state.setQuery)
  const statusFilter = useWorkbenchStore((state) => state.statusFilter)
  const setStatusFilter = useWorkbenchStore((state) => state.setStatusFilter)
  const { data = initialData } = useQuery({
    initialData,
    queryFn: fetchApps,
    queryKey: ["apps"],
  })

  const filteredApps = data.apps.filter((app) => {
    const searchable = [
      app.displayName,
      app.packageName,
      app.currentArtifact?.sha256,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    return (
      searchable.includes(query.toLowerCase()) &&
      (statusFilter === "all" || app.status === statusFilter)
    )
  })

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 md:px-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex max-w-3xl flex-col gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileSearchIcon />
              Static APK Research
            </div>
            <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
              App Researcher
            </h1>
            <p className="text-muted-foreground">
              Upload owned APK and XAPK files, extract static Android app
              metadata, retain artifacts locally, and inspect package signals.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 rounded-lg border px-4 py-3 text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Apps</span>
              <span className="font-semibold">{data.apps.length}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Ready</span>
              <span className="font-semibold">
                {data.apps.filter((app) => app.status === "ready").length}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Runs</span>
              <span className="font-semibold">{data.recentRuns.length}</span>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,520px)_1fr]">
          <UploadCard />
          <Card>
            <CardHeader>
              <CardTitle>Upload-first MVP</CardTitle>
              <CardDescription>
                Apps are created from owned APK or XAPK uploads so every record has
                hashes, file inventory, and analysis output.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Uploading the package file is the source of truth for permissions,
              components, resources, strings, certificates, hashes, and SDK
              signals.
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Apps</h2>
              <p className="text-sm text-muted-foreground">
                APK-backed research records from retained local artifacts.
              </p>
            </div>
            <FieldGroup className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_180px]">
              <Field>
                <FieldLabel htmlFor="app-search">Search</FieldLabel>
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="app-search"
                    className="pl-9"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Name, package, hash"
                  />
                </div>
              </Field>
              <Field>
                <FieldLabel>Status</FieldLabel>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="ready">Ready</SelectItem>
                      <SelectItem value="needs_tooling">Needs tooling</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </div>

          {filteredApps.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredApps.map((app) => (
                <AppCard
                  key={
                    app.packageName ??
                    app.currentArtifact?.sha256 ??
                    app.displayName
                  }
                  app={app}
                />
              ))}
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <DatabaseIcon />
                <EmptyTitle>No matching apps</EmptyTitle>
                <EmptyDescription>
                  Adjust the filters or create an app from an APK.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>

        <Separator />

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Recent Runs</h2>
              <p className="text-sm text-muted-foreground">
                Last analyzer executions and degraded-mode outcomes.
              </p>
            </div>
            <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
              <CheckCircle2Icon />
              <span>Missing tools are tracked as `needs_tooling`.</span>
            </div>
          </div>
          {data.apps.some((app) => app.status === "needs_tooling") && (
            <div className="flex gap-2 rounded-lg border px-3 py-2 text-sm text-muted-foreground">
              <AlertTriangleIcon />
              <span>
                Configure `APK_RESEARCHER_AAPT2_PATH` and
                `APK_RESEARCHER_APKSIGNER_PATH` for full manifest and certificate
                extraction.
              </span>
            </div>
          )}
          <RecentRunsTable runs={data.recentRuns} />
        </section>
      </div>
    </main>
  )
}
