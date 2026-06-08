import { describe, expect, it } from "vitest"

import {
  mergePermissions,
  parseAaptBadging,
  parseAaptPermissions,
  parseAaptResources,
  parseAaptStrings,
  parseApkSignerCertificates,
} from "@/lib/apk/parsers"

describe("APK parser helpers", () => {
  it("parses aapt badging output", () => {
    const parsed = parseAaptBadging(`
package: name='com.example.app' versionCode='42' versionName='2.1.0' compileSdkVersion='35'
sdkVersion:'23'
targetSdkVersion:'35'
application-label:'Example App'
application-icon-320:'res/mipmap-xhdpi/ic_launcher.png'
uses-permission: name='android.permission.INTERNET'
launchable-activity: name='com.example.MainActivity' label='Example' icon=''
`)

    expect(parsed.label).toBe("Example App")
    expect(parsed.version).toMatchObject({
      compileSdk: "35",
      minSdk: "23",
      packageName: "com.example.app",
      targetSdk: "35",
      versionCode: "42",
      versionName: "2.1.0",
    })
    expect(parsed.iconPaths).toEqual(["res/mipmap-xhdpi/ic_launcher.png"])
    expect(parsed.permissions[0]?.name).toBe("android.permission.INTERNET")
    expect(parsed.components[0]?.name).toBe("com.example.MainActivity")
  })

  it("parses and merges permissions", () => {
    const fromDump = parseAaptPermissions(`
uses-permission: name='android.permission.CAMERA'
uses-permission: name='android.permission.INTERNET'
`)
    const merged = mergePermissions(fromDump, [
      { name: "android.permission.CAMERA", source: "badging" },
    ])

    expect(merged.map((permission) => permission.name)).toEqual([
      "android.permission.CAMERA",
      "android.permission.INTERNET",
    ])
    expect(merged[0]?.source).toBe("badging")
  })

  it("extracts resource and string output", () => {
    expect(
      parseAaptResources("resource 0x7f010001 com.example:string/app_name: Example")
    ).toEqual([
      {
        name: "app_name",
        type: "string",
        value: "Example",
      },
    ])
    expect(parseAaptStrings("Example\n\ncom.example.Api\n")).toEqual([
      "Example",
      "com.example.Api",
    ])
  })

  it("parses apksigner certificate output", () => {
    const certificates = parseApkSignerCertificates(`
Signer #1 certificate DN: CN=Example
Signer #1 certificate SHA-256 digest: aa:bb
Signer #1 certificate SHA-1 digest: cc:dd
Signer #1 certificate serial number: 01
Signer #1 certificate valid from: Jan 1, 2024
Signer #1 certificate valid until: Jan 1, 2034
-----BEGIN CERTIFICATE-----
abc
-----END CERTIFICATE-----
`)

    expect(certificates[0]).toMatchObject({
      pem: "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----",
      serialNumber: "01",
      sha1: "cc:dd",
      sha256: "aa:bb",
      subject: "CN=Example",
      validTo: "Jan 1, 2034",
    })
  })
})
