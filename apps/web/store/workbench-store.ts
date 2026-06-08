"use client"

import { create } from "zustand"

type WorkbenchStatusFilter = "all" | "ready" | "needs_tooling" | "failed"

type WorkbenchState = {
  query: string
  setQuery: (query: string) => void
  setStatusFilter: (statusFilter: WorkbenchStatusFilter) => void
  statusFilter: WorkbenchStatusFilter
}

export const useWorkbenchStore = create<WorkbenchState>()((set) => ({
  query: "",
  setQuery: (query) => set({ query }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  statusFilter: "all",
}))
