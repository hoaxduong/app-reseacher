import { listAppSummaries, listRecentRuns } from "@/lib/apps"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json({
    apps: listAppSummaries(),
    recentRuns: listRecentRuns(),
  })
}
