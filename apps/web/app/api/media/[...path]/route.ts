import { readFile } from "node:fs/promises"
import { extname } from "node:path"

import { resolveMediaPath } from "@/lib/storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const contentTypes: Record<string, string> = {
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await context.params
    const mediaPath = path.join("/")

    if (!mediaPath.startsWith("icons/")) {
      return Response.json({ error: "Media path is not allowed." }, { status: 403 })
    }

    const absolutePath = resolveMediaPath(mediaPath)
    const body = await readFile(absolutePath)

    return new Response(body, {
      headers: {
        "Content-Type":
          contentTypes[extname(absolutePath).toLowerCase()] ??
          "application/octet-stream",
      },
    })
  } catch {
    return Response.json({ error: "Media not found." }, { status: 404 })
  }
}
