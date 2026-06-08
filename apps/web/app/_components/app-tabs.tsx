"use client"

import * as React from "react"
import {
  BadgeCheckIcon,
  BoxesIcon,
  FileCode2Icon,
  FileTextIcon,
  FingerprintIcon,
  KeyRoundIcon,
  LayoutGridIcon,
  ListTreeIcon,
  PackageIcon,
  ShieldIcon,
} from "lucide-react"

import type { AppDetail } from "@/app/_components/app-types"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { Input } from "@workspace/ui/components/input"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) {
    return "0 B"
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function EmptyTable({
  description,
  icon,
  title,
}: {
  description: string
  icon: React.ReactNode
  title: string
}) {
  return (
    <Empty>
      <EmptyHeader>
        {icon}
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function KeyValueGrid({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border px-3 py-2">
          <div className="text-xs font-medium text-muted-foreground">
            {item.label}
          </div>
          <div className="mt-1 min-w-0 truncate text-sm">{item.value ?? "N/A"}</div>
        </div>
      ))}
    </div>
  )
}

export function AppTabs({ detail }: { detail: AppDetail }) {
  const [resourceQuery, setResourceQuery] = React.useState("")
  const [stringQuery, setStringQuery] = React.useState("")
  const filteredResources = detail.resources.filter((resource) =>
    [resource.name, resource.type, resource.value, resource.path]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(resourceQuery.toLowerCase())
  )
  const filteredStrings = detail.strings.filter((item) =>
    item.value.toLowerCase().includes(stringQuery.toLowerCase())
  )

  return (
    <Tabs defaultValue="overview">
      <ScrollArea className="w-full">
        <TabsList variant="line" className="min-w-max">
          <TabsTrigger value="overview">
            <BadgeCheckIcon data-icon="inline-start" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="manifest">
            <FileTextIcon data-icon="inline-start" />
            Manifest
          </TabsTrigger>
          <TabsTrigger value="permissions">
            <ShieldIcon data-icon="inline-start" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="components">
            <ListTreeIcon data-icon="inline-start" />
            Components
          </TabsTrigger>
          <TabsTrigger value="sdks">
            <BoxesIcon data-icon="inline-start" />
            SDKs
          </TabsTrigger>
          <TabsTrigger value="resources">
            <LayoutGridIcon data-icon="inline-start" />
            Resources
          </TabsTrigger>
          <TabsTrigger value="strings">
            <FileCode2Icon data-icon="inline-start" />
            Strings
          </TabsTrigger>
          <TabsTrigger value="certs">
            <KeyRoundIcon data-icon="inline-start" />
            Certs
          </TabsTrigger>
          <TabsTrigger value="files">
            <PackageIcon data-icon="inline-start" />
            Files
          </TabsTrigger>
        </TabsList>
      </ScrollArea>

      <TabsContent value="overview" className="flex flex-col gap-4">
        <KeyValueGrid
          items={[
            { label: "Artifact", value: detail.artifact?.originalFilename },
            { label: "Size", value: formatBytes(detail.artifact?.sizeBytes) },
            { label: "MD5", value: detail.artifact?.md5 },
            { label: "SHA-1", value: detail.artifact?.sha1 },
            { label: "SHA-256", value: detail.artifact?.sha256 },
            { label: "Run status", value: detail.run?.status ?? "No run" },
          ]}
        />
        {detail.icons.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Extracted Icons</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {detail.icons.map((icon) => (
                <div
                  key={icon.path}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={icon.url} alt="" className="size-10 rounded-md" />
                  <div className="min-w-0 text-sm">
                    <div className="truncate font-medium">{icon.path}</div>
                    <div className="text-muted-foreground">
                      {icon.density ?? "density unknown"}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        {detail.errors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Analyzer Notes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {detail.errors.map((error, index) => (
                <div key={index} className="rounded-lg border px-3 py-2 text-sm">
                  <Badge variant="outline">{error.tool ?? "system"}</Badge>
                  <span className="ml-2 text-muted-foreground">
                    {error.message}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="manifest">
        <KeyValueGrid
          items={[
            { label: "Version name", value: detail.version?.versionName },
            { label: "Version code", value: detail.version?.versionCode },
            { label: "Min SDK", value: detail.version?.minSdk },
            { label: "Target SDK", value: detail.version?.targetSdk },
            { label: "Compile SDK", value: detail.version?.compileSdk },
            {
              label: "Tool versions",
              value: Object.entries(detail.run?.toolVersions ?? {})
                .map(([tool, version]) => `${tool}: ${version}`)
                .join(" | "),
            },
          ]}
        />
      </TabsContent>

      <TabsContent value="permissions">
        {detail.permissions.length === 0 ? (
          <EmptyTable
            icon={<ShieldIcon />}
            title="No permissions"
            description="Permission extraction requires a valid APK and aapt2."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.permissions.map((permission) => (
                <TableRow key={permission.name}>
                  <TableCell className="font-mono">{permission.name}</TableCell>
                  <TableCell>{permission.source}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      <TabsContent value="components">
        {detail.components.length === 0 ? (
          <EmptyTable
            icon={<ListTreeIcon />}
            title="No components"
            description="Component extraction requires manifest decoding."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Exported</TableHead>
                <TableHead>Permission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.components.map((component) => (
                <TableRow key={`${component.type}:${component.name}`}>
                  <TableCell>
                    <Badge variant="outline">{component.type}</Badge>
                  </TableCell>
                  <TableCell className="font-mono">{component.name}</TableCell>
                  <TableCell>{component.exported ?? "unknown"}</TableCell>
                  <TableCell className="font-mono">
                    {component.permission ?? "none"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      <TabsContent value="sdks">
        {detail.sdks.length === 0 ? (
          <EmptyTable
            icon={<BoxesIcon />}
            title="No SDK signals"
            description="No known SDK patterns were detected in files or strings."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SDK</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.sdks.map((sdk) => (
                <TableRow key={sdk.name}>
                  <TableCell className="font-medium">{sdk.name}</TableCell>
                  <TableCell>{sdk.confidence}%</TableCell>
                  <TableCell className="max-w-[520px] truncate font-mono text-muted-foreground">
                    {sdk.evidence}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      <TabsContent value="resources" className="flex flex-col gap-3">
        <Input
          value={resourceQuery}
          onChange={(event) => setResourceQuery(event.target.value)}
          placeholder="Filter resources"
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Value or path</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredResources.map((resource, index) => (
              <TableRow key={`${resource.type}:${resource.name}:${index}`}>
                <TableCell>{resource.type}</TableCell>
                <TableCell className="font-mono">{resource.name}</TableCell>
                <TableCell className="max-w-[640px] truncate text-muted-foreground">
                  {resource.value ?? resource.path ?? "N/A"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TabsContent>

      <TabsContent value="strings" className="flex flex-col gap-3">
        <Input
          value={stringQuery}
          onChange={(event) => setStringQuery(event.target.value)}
          placeholder="Filter strings"
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStrings.map((item, index) => (
              <TableRow key={`${item.source}:${index}`}>
                <TableCell>{item.source}</TableCell>
                <TableCell className="max-w-[760px] truncate font-mono text-muted-foreground">
                  {item.value}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TabsContent>

      <TabsContent value="certs">
        {detail.certificates.length === 0 ? (
          <EmptyTable
            icon={<FingerprintIcon />}
            title="No certificates"
            description="Certificate extraction requires apksigner."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Issuer</TableHead>
                <TableHead>SHA-256</TableHead>
                <TableHead>Valid until</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.certificates.map((certificate, index) => (
                <TableRow key={`${certificate.sha256}:${index}`}>
                  <TableCell className="max-w-[360px] truncate">
                    {certificate.subject ?? "unknown"}
                  </TableCell>
                  <TableCell className="max-w-[360px] truncate">
                    {certificate.issuer ?? "unknown"}
                  </TableCell>
                  <TableCell className="font-mono">
                    {certificate.sha256 ?? "unknown"}
                  </TableCell>
                  <TableCell>{certificate.validTo ?? "unknown"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      <TabsContent value="files">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kind</TableHead>
              <TableHead>Path</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>SHA-256</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.files.map((file) => (
              <TableRow key={file.path}>
                <TableCell>
                  <Badge variant="secondary">{file.kind}</Badge>
                </TableCell>
                <TableCell className="max-w-[520px] truncate font-mono">
                  {file.path}
                </TableCell>
                <TableCell>{formatBytes(file.sizeBytes)}</TableCell>
                <TableCell className="font-mono text-muted-foreground">
                  {file.sha256 ?? "large entry"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TabsContent>
    </Tabs>
  )
}
