import type {
  AppCertificateInfo,
  AppComponentInfo,
  AppPermissionInfo,
  AppResourceInfo,
  AppVersionInfo,
} from "@/lib/apk/types"

const attributePattern = /([\w.-]+)='([^']*)'/g

export function parseAaptAttributes(line: string) {
  const attributes: Record<string, string> = {}

  for (const match of line.matchAll(attributePattern)) {
    attributes[match[1]!] = match[2]!
  }

  return attributes
}

export function parseAaptBadging(output: string) {
  const version: AppVersionInfo = {}
  const permissions = new Map<string, AppPermissionInfo>()
  const components: AppComponentInfo[] = []
  const iconPaths: string[] = []
  let label: string | undefined

  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith("package:")) {
      const attrs = parseAaptAttributes(line)
      version.packageName = attrs.name
      version.versionCode = attrs.versionCode
      version.versionName = attrs.versionName
      version.compileSdk = attrs.compileSdkVersion
    } else if (line.startsWith("sdkVersion:")) {
      version.minSdk = line.match(/'([^']+)'/)?.[1]
    } else if (line.startsWith("targetSdkVersion:")) {
      version.targetSdk = line.match(/'([^']+)'/)?.[1]
    } else if (line.startsWith("uses-permission:")) {
      const name = parseAaptAttributes(line).name
      if (name) {
        permissions.set(name, { name, source: "aapt2 badging" })
      }
    } else if (line.startsWith("application-label:")) {
      label = line.match(/'([^']*)'/)?.[1]
    } else if (line.startsWith("application-icon-")) {
      const icon = line.match(/'([^']*)'/)?.[1]
      if (icon) {
        iconPaths.push(icon)
      }
    } else if (line.startsWith("launchable-activity:")) {
      const attrs = parseAaptAttributes(line)
      if (attrs.name) {
        components.push({
          name: attrs.name,
          type: "activity",
        })
      }
    }
  }

  return {
    components,
    iconPaths,
    label,
    permissions: [...permissions.values()],
    version,
  }
}

export function parseAaptPermissions(output: string) {
  const permissions = new Map<string, AppPermissionInfo>()

  for (const line of output.split(/\r?\n/)) {
    const name = parseAaptAttributes(line).name ?? line.match(/:\s*(\S+)/)?.[1]
    if (!name?.startsWith("android.permission.")) {
      continue
    }

    permissions.set(name, {
      name,
      source: "aapt2 permissions",
    })
  }

  return [...permissions.values()]
}

export function parseAaptStrings(output: string) {
  return [...new Set(output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))]
    .filter((line) => line.length > 1 && line.length < 500)
    .slice(0, 5000)
}

export function parseAaptResources(output: string): AppResourceInfo[] {
  const resources: AppResourceInfo[] = []

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(
      /resource\s+0x[0-9a-f]+\s+[^:]+:([^/]+)\/([^:]+):\s*(.*)$/i
    )
    if (!match) {
      continue
    }

    resources.push({
      name: match[2] ?? "resource",
      type: match[1] ?? "resource",
      value: match[3]?.slice(0, 500),
    })
  }

  return resources.slice(0, 2000)
}

function indentation(line: string) {
  return line.match(/^\s*/)?.[0].length ?? 0
}

export function parseAaptXmltreeComponents(output: string): AppComponentInfo[] {
  const components: AppComponentInfo[] = []
  let current: (AppComponentInfo & { depth: number }) | null = null
  let inIntentFilterDepth: number | null = null

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim()
    const depth = indentation(rawLine)
    const element = line.match(/^E:\s+(activity|service|receiver|provider|intent-filter)\b/)?.[1]

    if (element === "intent-filter" && current) {
      inIntentFilterDepth = depth
      current.intentFilters ??= []
      continue
    }

    if (
      element === "activity" ||
      element === "service" ||
      element === "receiver" ||
      element === "provider"
    ) {
      if (current?.name) {
        components.push(current)
      }
      current = {
        depth,
        name: "",
        type: element,
      }
      inIntentFilterDepth = null
      continue
    }

    if (current && depth <= current.depth && line.startsWith("E:")) {
      if (current.name) {
        components.push(current)
      }
      current = null
      inIntentFilterDepth = null
      continue
    }

    if (!current) {
      continue
    }

    const attrValue = line.match(/Raw:\s+"([^"]+)"/)?.[1] ?? line.match(/=\(.*\)"([^"]+)"/)?.[1]

    if (line.includes("android:name") && attrValue) {
      if (inIntentFilterDepth !== null && depth > inIntentFilterDepth) {
        current.intentFilters ??= []
        current.intentFilters.push(attrValue)
      } else {
        current.name = attrValue
      }
    } else if (line.includes("android:exported") && attrValue) {
      current.exported = attrValue
    } else if (line.includes("android:permission") && attrValue) {
      current.permission = attrValue
    }
  }

  if (current?.name) {
    components.push(current)
  }

  return components
}

export function mergePermissions(
  ...groups: AppPermissionInfo[][]
): AppPermissionInfo[] {
  const merged = new Map<string, AppPermissionInfo>()

  for (const group of groups) {
    for (const permission of group) {
      merged.set(permission.name, {
        ...merged.get(permission.name),
        ...permission,
      })
    }
  }

  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function mergeComponents(
  ...groups: AppComponentInfo[][]
): AppComponentInfo[] {
  const merged = new Map<string, AppComponentInfo>()

  for (const group of groups) {
    for (const component of group) {
      merged.set(`${component.type}:${component.name}`, {
        ...merged.get(`${component.type}:${component.name}`),
        ...component,
      })
    }
  }

  return [...merged.values()].sort((a, b) => a.type.localeCompare(b.type))
}

export function parseApkSignerCertificates(output: string) {
  const certificates: AppCertificateInfo[] = []
  let current: AppCertificateInfo | null = null
  let pemLines: string[] | null = null

  for (const line of output.split(/\r?\n/)) {
    const signerMatch = line.match(/^Signer #\d+ certificate DN:\s*(.*)$/)
    if (signerMatch) {
      if (current) {
        current.pem = pemLines?.join("\n")
        certificates.push(current)
      }
      current = { subject: signerMatch[1] }
      pemLines = null
      continue
    }

    if (!current) {
      continue
    }

    const mappings: Array<[keyof AppCertificateInfo, RegExp]> = [
      ["issuer", /^Signer #\d+ certificate issuer DN:\s*(.*)$/],
      ["serialNumber", /^Signer #\d+ certificate serial number:\s*(.*)$/],
      ["validFrom", /^Signer #\d+ certificate valid from:\s*(.*)$/],
      ["validTo", /^Signer #\d+ certificate valid until:\s*(.*)$/],
      ["sha256", /^Signer #\d+ certificate SHA-256 digest:\s*(.*)$/],
      ["sha1", /^Signer #\d+ certificate SHA-1 digest:\s*(.*)$/],
    ]

    for (const [key, pattern] of mappings) {
      const match = line.match(pattern)
      if (match) {
        current[key] = match[1]
      }
    }

    if (line.includes("BEGIN CERTIFICATE")) {
      pemLines = [line]
    } else if (pemLines) {
      pemLines.push(line)
      if (line.includes("END CERTIFICATE")) {
        current.pem = pemLines.join("\n")
        pemLines = null
      }
    }
  }

  if (current) {
    current.pem = current.pem ?? pemLines?.join("\n")
    certificates.push(current)
  }

  return certificates
}
