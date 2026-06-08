import { describe, expect, it } from "vitest"

import { detectSdks } from "@/lib/apk/sdk-detector"
import type { ApkFileEntry } from "@/lib/apk/types"

const baseFile = {
  compressedSizeBytes: 0,
  kind: "dex",
  sha256: null,
  sizeBytes: 0,
} satisfies Omit<ApkFileEntry, "path">

describe("SDK detector", () => {
  it("detects SDKs from paths and strings", () => {
    const detections = detectSdks(
      [
        {
          ...baseFile,
          path: "classes.dex/com/google/firebase/FirebaseApp",
        },
        {
          ...baseFile,
          path: "classes2.dex/com/appsflyer/AppsFlyerLib",
        },
      ],
      ["com.facebook.FacebookSdk"]
    )

    expect(detections.map((detection) => detection.name)).toEqual([
      "Firebase",
      "Meta/Facebook SDK",
      "AppsFlyer",
    ])
  })

  it("deduplicates by SDK name", () => {
    const detections = detectSdks([
      {
        ...baseFile,
        path: "firebase-common.properties",
      },
      {
        ...baseFile,
        path: "com/google/firebase/FirebaseApp",
      },
    ])

    expect(detections).toHaveLength(1)
    expect(detections[0]?.name).toBe("Firebase")
  })
})
