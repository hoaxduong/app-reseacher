import { deleteUnidentifiedAppByArtifactSha256 } from "@/lib/apps"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ sha256: string }> }
) {
  const { sha256 } = await context.params
  const result = await deleteUnidentifiedAppByArtifactSha256(sha256)

  if (!result) {
    return Response.json({ error: "Unidentified app not found." }, { status: 404 })
  }

  return Response.json(result)
}
