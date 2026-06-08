import { getAppVersionDetail } from "@/lib/apps"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ packageName: string; sha256: string }> }
) {
  const { packageName, sha256 } = await context.params
  const app = getAppVersionDetail(packageName, sha256)

  if (!app) {
    return Response.json({ error: "App version not found." }, { status: 404 })
  }

  return Response.json({ app })
}
