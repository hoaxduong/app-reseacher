import { reanalyzeAppVersion } from "@/lib/apps"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  _request: Request,
  context: { params: Promise<{ packageName: string; sha256: string }> }
) {
  const { packageName, sha256 } = await context.params
  const result = await reanalyzeAppVersion(packageName, sha256)

  if (!result) {
    return Response.json({ error: "App version not found." }, { status: 404 })
  }

  if (result.conflict) {
    return Response.json(
      { error: "This app version is already being analyzed." },
      { status: 409 }
    )
  }

  return Response.json({ runId: result.runId })
}
