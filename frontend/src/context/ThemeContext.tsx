/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react"

export type Theme = "dark" | "light"

interface ThemeContextType {
  theme: Theme
  isDark: boolean
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark"
    const saved = localStorage.getItem("cloudforge_theme")
    if (saved === "light" || saved === "dark") return saved
    return "dark"
  })

  useEffect(() => {
    const root = document.documentElement
    const body = document.body

    if (theme === "dark") {
      root.classList.add("dark")
      root.classList.remove("light")
      if (body) {
        body.classList.add("dark")
        body.classList.remove("light")
      }
      root.style.colorScheme = "dark"
    } else {
      root.classList.add("light")
      root.classList.remove("dark")
      if (body) {
        body.classList.add("light")
        body.classList.remove("dark")
      }
      root.style.colorScheme = "light"
    }

    root.setAttribute("data-theme", theme)
    if (body) {
      body.setAttribute("data-theme", theme)
    }

    localStorage.setItem("cloudforge_theme", theme)
  }, [theme])

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"))
  }

  const setTheme = (next: Theme) => {
    setThemeState(next)
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === "dark",
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
