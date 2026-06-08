import { deleteAppByPackageName } from "@/lib/apps"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ packageName: string }> }
) {
  const { packageName } = await context.params
  const result = await deleteAppByPackageName(packageName)

  if (!result) {
    return Response.json({ error: "App not found." }, { status: 404 })
  }

  return Response.json(result)
}
