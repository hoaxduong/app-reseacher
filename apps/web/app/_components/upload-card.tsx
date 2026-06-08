"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { FileArchiveIcon, UploadIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useForm, useWatch, type Resolver } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod/v4"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Progress } from "@workspace/ui/components/progress"

const uploadSchema = z.object({
  apk: z
    .custom<FileList>()
    .refine((files) => files instanceof FileList && files.length === 1, {
      message: "Choose one APK or XAPK file.",
    })
    .refine(
      (files) => {
        const name = files?.[0]?.name.toLowerCase()
        return name?.endsWith(".apk") || name?.endsWith(".xapk")
      },
      {
        message: "Only .apk and .xapk files are supported.",
      }
    ),
})

type UploadForm = z.infer<typeof uploadSchema>

type UploadResponse = {
  app: {
    packageName: string | null
  } | null
  artifact: {
    sha256: string
  } | null
}

async function uploadApk({
  file,
}: {
  file: File
}) {
  const formData = new FormData()
  formData.append("apk", file)

  const response = await fetch("/api/upload", {
    body: formData,
    method: "POST",
  })

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string }
    throw new Error(payload.error ?? "Unable to upload APK.")
  }

  return (await response.json()) as UploadResponse
}

export function UploadCard({
  description = "Retains the APK locally, computes hashes, and runs static analysis. XAPK uploads are unpacked and analyzed from the best APK inside the bundle.",
  title = "Upload Owned APK or XAPK",
}: {
  description?: string
  title?: string
}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const form = useForm<UploadForm>({
    resolver: zodResolver(uploadSchema as never) as Resolver<UploadForm>,
  })
  const mutation = useMutation({
    mutationFn: uploadApk,
    onError(error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.")
    },
    async onSuccess(data) {
      await queryClient.invalidateQueries({ queryKey: ["apps"] })

      if (data.app?.packageName && data.artifact?.sha256) {
        toast.success("APK analyzed.")
        router.push(
          `/apps/${encodeURIComponent(data.app.packageName)}/versions/${data.artifact.sha256}`
        )
      } else {
        toast.warning("APK analyzed, but no package name was extracted.")
      }
    },
  })

  const selectedFile = useWatch({
    control: form.control,
    name: "apk",
  })?.[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((values) => {
            const file = values.apk[0]
            if (file) {
              mutation.mutate({ file })
            }
          })}
        >
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.apk}>
              <FieldLabel htmlFor="apk-file">Package file</FieldLabel>
              <Input
                id="apk-file"
                type="file"
                accept=".apk,.xapk,application/vnd.android.package-archive"
                aria-invalid={!!form.formState.errors.apk}
                {...form.register("apk")}
              />
              <FieldDescription>
                `.apks`, `.apkm`, and `.aab` bundles are rejected in this MVP.
              </FieldDescription>
              <FieldError errors={[form.formState.errors.apk]} />
            </Field>
          </FieldGroup>
          {selectedFile && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <FileArchiveIcon data-icon="inline-start" />
              <span className="min-w-0 truncate">{selectedFile.name}</span>
              <span className="text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
          )}
          {mutation.isPending && <Progress value={68} />}
          <Button disabled={mutation.isPending} type="submit">
            <UploadIcon data-icon="inline-start" />
            {mutation.isPending ? "Analyzing..." : "Upload and Analyze"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
