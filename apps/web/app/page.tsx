import { Workbench } from "@/app/_components/workbench"
import { listAppSummaries, listRecentRuns } from "@/lib/apps"

export const dynamic = "force-dynamic"

export default function Page() {
  return (
    <Workbench
      initialData={{
        apps: listAppSummaries(),
        recentRuns: listRecentRuns(),
      }}
    />
  )
}
