"use client"

import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"
import { Sun, Moon } from "lucide-react"

interface ThemeToggleProps {
  className?: string
  showLabel?: boolean
}

const emptySubscribe = () => () => {}

export function ThemeToggle({ className = "", showLabel = false }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )

  if (!mounted) {
    return (
      <button
        type="button"
        className={`size-9 rounded-xl border border-border/60 bg-card/80 backdrop-blur-xs text-muted-foreground flex items-center justify-center transition-all ${className}`}
        aria-label="Toggle theme"
      >
        <span className="size-4" />
      </button>
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`size-9 rounded-xl border border-border/60 bg-card/80 backdrop-blur-xs text-foreground hover:bg-muted flex items-center justify-center transition-all cursor-pointer shadow-xs ${className}`}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="size-4.5 text-warning transition-transform hover:rotate-45" />
      ) : (
        <Moon className="size-4.5 text-primary transition-transform hover:-rotate-12" />
      )}
      {showLabel && (
        <span className="text-xs font-medium ml-2">
          {isDark ? "Light Mode" : "Dark Mode"}
        </span>
      )}
    </button>
  )
}
