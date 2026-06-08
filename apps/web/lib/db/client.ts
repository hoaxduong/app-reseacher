import "server-only"

import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"

import Database from "better-sqlite3"
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3"

import * as schema from "@/lib/db/schema"
import { getConfig } from "@/lib/config"

type DatabaseState = {
  db: BetterSQLite3Database<typeof schema>
  sqlite: Database.Database
}

declare global {
  var __apkResearcherDb: DatabaseState | undefined
}

function initializeDatabase(path: string) {
  const absolutePath = resolve(/*turbopackIgnore: true*/ process.cwd(), path)
  mkdirSync(dirname(absolutePath), { recursive: true })

  const sqlite = new Database(absolutePath)
  sqlite.pragma("journal_mode = WAL")
  sqlite.pragma("foreign_keys = ON")
  const db = drizzle(sqlite, { schema })

  return {
    db,
    sqlite,
  }
}

export function getDb() {
  globalThis.__apkResearcherDb ??= initializeDatabase(getConfig().dbPath)
  return globalThis.__apkResearcherDb.db
}
