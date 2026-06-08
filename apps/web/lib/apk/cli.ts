import "server-only"

import { spawn } from "node:child_process"

export type CliResult = {
  code: number | null
  stderr: string
  stdout: string
  timedOut: boolean
}

export class MissingToolError extends Error {
  constructor(readonly tool: string) {
    super(`${tool} is not configured or was not found on PATH.`)
    this.name = "MissingToolError"
  }
}

export async function runCli(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    })

    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let timedOut = false

    const timeout = setTimeout(() => {
      timedOut = true
      child.kill("SIGKILL")
    }, timeoutMs)

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk))
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk))
    child.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timeout)
      if (error.code === "ENOENT") {
        reject(new MissingToolError(command))
        return
      }
      reject(error)
    })
    child.on("close", (code) => {
      clearTimeout(timeout)
      resolve({
        code,
        stderr: Buffer.concat(stderr).toString("utf8"),
        stdout: Buffer.concat(stdout).toString("utf8"),
        timedOut,
      })
    })
  })
}

export async function getToolVersion(
  command: string,
  args: string[],
  timeoutMs: number
) {
  try {
    const result = await runCli(command, args, timeoutMs)
    const output = `${result.stdout}\n${result.stderr}`.trim()
    return output.split(/\r?\n/)[0] || "available"
  } catch (error) {
    if (error instanceof MissingToolError) {
      return null
    }
    return "available"
  }
}
