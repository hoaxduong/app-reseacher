"use client"

import * as React from "react"

const MEDIA_QUERY = "(prefers-color-scheme: dark)"
const THEME_CLASS_NAMES = ["light", "dark"] as const

type ResolvedTheme = (typeof THEME_CLASS_NAMES)[number]
type Theme = ResolvedTheme | "system"
type ThemeAttribute = "class" | `data-${string}`

type ThemeProviderProps = React.PropsWithChildren<{
  attribute?: ThemeAttribute
  defaultTheme?: Theme
  disableTransitionOnChange?: boolean
  enableSystem?: boolean
  storageKey?: string
}>

type ThemeContextValue = {
  resolvedTheme: ResolvedTheme
  setTheme: React.Dispatch<React.SetStateAction<Theme>>
  systemTheme: ResolvedTheme
  theme: Theme
  themes: Theme[]
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(
  undefined
)

function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark" || value === "system"
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light"
  }

  return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light"
}

function getStoredTheme(storageKey: string, defaultTheme: Theme) {
  if (typeof window === "undefined") {
    return defaultTheme
  }

  try {
    const theme = window.localStorage.getItem(storageKey)

    return isTheme(theme) ? theme : defaultTheme
  } catch {
    return defaultTheme
  }
}

function disableTransitions() {
  const style = document.createElement("style")
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{transition:none!important}"
    )
  )
  document.head.appendChild(style)

  return () => {
    window.getComputedStyle(document.body)
    window.setTimeout(() => {
      style.remove()
    }, 1)
  }
}

function applyTheme({
  attribute,
  disableTransitionOnChange,
  resolvedTheme,
}: {
  attribute: ThemeAttribute
  disableTransitionOnChange: boolean
  resolvedTheme: ResolvedTheme
}) {
  if (typeof document === "undefined") {
    return
  }

  const cleanUpTransitions = disableTransitionOnChange
    ? disableTransitions()
    : undefined
  const root = document.documentElement

  if (attribute === "class") {
    root.classList.remove(...THEME_CLASS_NAMES)
    root.classList.add(resolvedTheme)
  } else {
    root.setAttribute(attribute, resolvedTheme)
  }

  root.style.colorScheme = resolvedTheme
  cleanUpTransitions?.()
}

const fallbackThemeContext: ThemeContextValue = {
  resolvedTheme: "light",
  setTheme: () => {},
  systemTheme: "light",
  theme: "system",
  themes: ["light", "dark", "system"],
}

function ThemeProvider({
  attribute = "class",
  children,
  defaultTheme = "system",
  disableTransitionOnChange = false,
  enableSystem = true,
  storageKey = "theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(() =>
    getStoredTheme(storageKey, defaultTheme)
  )
  const [systemTheme, setSystemTheme] =
    React.useState<ResolvedTheme>(getSystemTheme)
  const resolvedTheme =
    theme === "system" && enableSystem ? systemTheme : theme === "dark"
      ? "dark"
      : "light"

  const setTheme = React.useCallback<
    React.Dispatch<React.SetStateAction<Theme>>
  >(
    (value) => {
      setThemeState((currentTheme) => {
        const nextTheme =
          typeof value === "function" ? value(currentTheme) : value
        const normalizedTheme = isTheme(nextTheme) ? nextTheme : defaultTheme

        try {
          window.localStorage.setItem(storageKey, normalizedTheme)
        } catch {
          // Ignore storage failures; the in-memory theme still updates.
        }

        return normalizedTheme
      })
    },
    [defaultTheme, storageKey]
  )

  React.useEffect(() => {
    applyTheme({
      attribute,
      disableTransitionOnChange,
      resolvedTheme,
    })
  }, [attribute, disableTransitionOnChange, resolvedTheme])

  React.useEffect(() => {
    if (!enableSystem) {
      return
    }

    const mediaQuery = window.matchMedia(MEDIA_QUERY)
    const onChange = () => {
      setSystemTheme(getSystemTheme())
    }

    onChange()
    mediaQuery.addEventListener("change", onChange)

    return () => {
      mediaQuery.removeEventListener("change", onChange)
    }
  }, [enableSystem])

  React.useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== storageKey) {
        return
      }

      setThemeState(isTheme(event.newValue) ? event.newValue : defaultTheme)
    }

    window.addEventListener("storage", onStorage)

    return () => {
      window.removeEventListener("storage", onStorage)
    }
  }, [defaultTheme, storageKey])

  const themes = React.useMemo<Theme[]>(
    () => (enableSystem ? ["light", "dark", "system"] : ["light", "dark"]),
    [enableSystem]
  )
  const value = React.useMemo<ThemeContextValue>(
    () => ({
      resolvedTheme,
      setTheme,
      systemTheme,
      theme,
      themes,
    }),
    [resolvedTheme, setTheme, systemTheme, theme, themes]
  )

  return React.createElement(ThemeContext.Provider, { value }, children)
}

function useTheme() {
  return React.useContext(ThemeContext) ?? fallbackThemeContext
}

export { ThemeProvider, useTheme }
export type { Theme, ThemeProviderProps }
