import "@workspace/ui/globals.css"
import type { Metadata } from "next"
import Script from "next/script"
import { ThemeProvider } from "@/components/theme-provider"
import { Providers } from "@/app/providers"

export const metadata: Metadata = {
  title: "App Researcher",
  description:
    "Upload owned APK and XAPK files, extract static Android app metadata, retain artifacts locally, and inspect package signals.",
}

const themeInitScript = `
(() => {
  try {
    const storedTheme = localStorage.getItem("theme");
    const theme = storedTheme === "light" || storedTheme === "dark" || storedTheme === "system" ? storedTheme : "system";
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const resolvedTheme = theme === "system" ? systemTheme : theme;
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
    root.style.colorScheme = resolvedTheme;
  } catch {}
})();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="font-sans antialiased"
    >
      <body>
        <ThemeProvider>
          <Providers>{children}</Providers>
        </ThemeProvider>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </body>
    </html>
  )
}
