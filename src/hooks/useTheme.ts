import { useState, useEffect } from 'react'

export type ThemePreference = 'light' | 'dark' | 'auto'
export type Theme = 'light' | 'dark'

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(preference: ThemePreference): Theme {
  return preference === 'auto' ? getSystemTheme() : preference
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    return (localStorage.getItem('wmp-theme') as ThemePreference) || 'auto'
  })

  const [effective, setEffective] = useState<Theme>(() => resolveTheme(
    (localStorage.getItem('wmp-theme') as ThemePreference) || 'auto'
  ))

  // Apply dark class and track effective theme
  useEffect(() => {
    const root = document.getElementById('wp-manager-pro-root')

    const apply = (pref: ThemePreference) => {
      const resolved = resolveTheme(pref)
      setEffective(resolved)
      if (root) {
        root.classList.toggle('dark', resolved === 'dark')
      }
    }

    apply(preference)
    localStorage.setItem('wmp-theme', preference)

    if (preference !== 'auto') return

    // Listen for OS theme changes when in auto mode
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => apply('auto')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [preference])

  const toggle = () =>
    setPreference(p => p === 'light' ? 'dark' : p === 'dark' ? 'auto' : 'light')

  return { theme: effective, preference, toggle }
}
