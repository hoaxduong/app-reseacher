import { describe, expect, it } from "vitest"

import {
  assertApkFilename,
  assertUploadSize,
  isUnsafeZipPath,
  UploadValidationError,
} from "@/lib/apk/validators"

describe("APK validation", () => {
  it("accepts APK and XAPK filenames", () => {
    expect(() => assertApkFilename("sample.apk")).not.toThrow()
    expect(() => assertApkFilename("sample.xapk")).not.toThrow()
    expect(() => assertApkFilename("sample.apkm")).toThrow(UploadValidationError)
    expect(() => assertApkFilename("sample.apks")).toThrow(UploadValidationError)
    expect(() => assertApkFilename("sample.aab")).toThrow(UploadValidationError)
    expect(() => assertApkFilename("sample.zip")).toThrow(UploadValidationError)
  })

  it("rejects empty and oversized APKs", () => {
    expect(() => assertUploadSize(1, 10)).not.toThrow()
    expect(() => assertUploadSize(0, 10)).toThrow(UploadValidationError)
    expect(() => assertUploadSize(11, 10)).toThrow(UploadValidationError)
  })

  it("detects unsafe zip paths", () => {
    expect(isUnsafeZipPath("res/drawable/icon.png")).toBe(false)
    expect(isUnsafeZipPath("../evil")).toBe(true)
    expect(isUnsafeZipPath("/absolute")).toBe(true)
    expect(isUnsafeZipPath("res/../evil")).toBe(true)
  })
})
