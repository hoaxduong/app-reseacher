import type { ApkFileEntry, SdkDetection } from "@/lib/apk/types"

type SdkRule = {
  confidence: number
  match: RegExp
  name: string
}

const sdkRules: SdkRule[] = [
  {
    confidence: 90,
    match: /com\/google\/firebase|firebase-/i,
    name: "Firebase",
  },
  {
    confidence: 85,
    match: /com\/google\/android\/gms|play-services/i,
    name: "Google Play services",
  },
  {
    confidence: 85,
    match: /com[/.]facebook[/.]|facebook-android-sdk/i,
    name: "Meta/Facebook SDK",
  },
  {
    confidence: 80,
    match: /com\/adjust\/sdk/i,
    name: "Adjust",
  },
  {
    confidence: 80,
    match: /com\/appsflyer/i,
    name: "AppsFlyer",
  },
  {
    confidence: 75,
    match: /com\/braze|appboy/i,
    name: "Braze",
  },
  {
    confidence: 75,
    match: /com\/onesignal/i,
    name: "OneSignal",
  },
  {
    confidence: 75,
    match: /com\/bugsnag/i,
    name: "Bugsnag",
  },
  {
    confidence: 75,
    match: /com\/crashlytics|fabric/i,
    name: "Crashlytics",
  },
  {
    confidence: 70,
    match: /com\/amplitude/i,
    name: "Amplitude",
  },
]

export function detectSdks(files: ApkFileEntry[], strings: string[] = []) {
  const evidence = [
    ...files.map((file) => file.path),
    ...strings.slice(0, 4000),
  ]
  const detections = new Map<string, SdkDetection>()

  for (const item of evidence) {
    for (const rule of sdkRules) {
      if (!rule.match.test(item)) {
        continue
      }

      const existing = detections.get(rule.name)
      if (!existing || rule.confidence > existing.confidence) {
        detections.set(rule.name, {
          confidence: rule.confidence,
          evidence: item.slice(0, 300),
          name: rule.name,
        })
      }
    }
  }

  return [...detections.values()].sort((a, b) => b.confidence - a.confidence)
}
