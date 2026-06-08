import "server-only"

import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"

import type { ApkHashes } from "@/lib/apk/types"

export async function hashFile(path: string): Promise<ApkHashes> {
  const md5 = createHash("md5")
  const sha1 = createHash("sha1")
  const sha256 = createHash("sha256")

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(path)
    stream.on("data", (chunk) => {
      md5.update(chunk)
      sha1.update(chunk)
      sha256.update(chunk)
    })
    stream.on("error", reject)
    stream.on("end", resolve)
  })

  return {
    md5: md5.digest("hex"),
    sha1: sha1.digest("hex"),
    sha256: sha256.digest("hex"),
  }
}

export function createUploadHashers() {
  return {
    md5: createHash("md5"),
    sha1: createHash("sha1"),
    sha256: createHash("sha256"),
  }
}
