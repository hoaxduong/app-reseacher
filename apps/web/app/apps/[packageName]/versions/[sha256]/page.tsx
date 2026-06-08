import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import { AppTabs } from "@/app/_components/app-tabs"
import { getAppVersionDetail } from "@/lib/apps"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

function statusVariant(status: string) {
  if (status === "failed") {
    return "destructive" as const
  }

  if (status === "ready") {
    return "default" as const
  }

  if (status === "needs_tooling") {
    return "outline" as const
  }

  return "secondary" as const
}

export const dynamic = "force-dynamic"

export default async function AppVersionPage({
  params,
}: {
  params: Promise<{ packageName: string; sha256: string }>
}) {
  const { packageName, sha256 } = await params
  const detail = getAppVersionDetail(packageName, sha256)

  if (!detail) {
    notFound()
  }

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-3">
            <Button asChild variant="ghost" className="w-fit">
              <Link href="/">
                <ArrowLeftIcon data-icon="inline-start" />
                Apps
              </Link>
            </Button>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold">
                  {detail.app.displayName}
                </h1>
                <Badge variant={statusVariant(detail.app.status)}>
                  {detail.app.status.replaceAll("_", " ")}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {detail.app.packageName ?? "No package identifier extracted yet."}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                sha256:{detail.artifact?.sha256}
              </p>
            </div>
          </div>
        </div>
        <AppTabs detail={detail} />
      </div>
    </main>
  )
}
