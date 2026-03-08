import { useState, useEffect } from 'react'

export type Theme = 'light' | 'dark'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('wmp-theme') as Theme) || 'light'
  })

  useEffect(() => {
    const root = document.getElementById('wp-manager-pro-root')
    if (root) {
      if (theme === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
    localStorage.setItem('wmp-theme', theme)
  }, [theme])

  const toggle = () => setThemeState(t => (t === 'light' ? 'dark' : 'light'))

  return { theme, toggle }
}
