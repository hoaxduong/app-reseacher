import { notFound, redirect } from "next/navigation"

import { getCurrentAppVersion } from "@/lib/apps"

export const dynamic = "force-dynamic"

export default async function AppRedirectPage({
  params,
}: {
  params: Promise<{ packageName: string }>
}) {
  const { packageName } = await params
  const currentVersion = getCurrentAppVersion(packageName)

  if (!currentVersion?.packageName) {
    notFound()
  }

  redirect(
    `/apps/${encodeURIComponent(currentVersion.packageName)}/versions/${currentVersion.sha256}`
  )
}
