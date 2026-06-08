import { getConfig } from "@/lib/config"
import { readUploadedApk } from "@/lib/apk/upload"
import { UploadValidationError } from "@/lib/apk/validators"
import { createAppFromUploadedApk } from "@/lib/apps"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const upload = await readUploadedApk(request, getConfig().maxUploadBytes)
    const result = await createAppFromUploadedApk(upload)
    return Response.json(result, { status: 201 })
  } catch (error) {
    const status = error instanceof UploadValidationError ? error.status : 500
    const message = error instanceof Error ? error.message : String(error)

    return Response.json({ error: message }, { status })
  }
}
