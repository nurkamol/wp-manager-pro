import { useState, useEffect } from 'react'

const STORAGE_KEY = 'wmp-wp-sidebar-hidden'

export function useWpAdminSidebar() {
  const [hidden, setHidden] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
  })

  useEffect(() => {
    let style = document.getElementById('wmp-wp-sidebar-style') as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = 'wmp-wp-sidebar-style'
      document.head.appendChild(style)
    }

    if (hidden) {
      style.textContent = `
        #adminmenumain, #adminmenuback { display: none !important; }
        #wpcontent, #wpfooter { margin-left: 0 !important; transition: margin-left 0.3s; }
      `
    } else {
      style.textContent = ''
    }

    try { localStorage.setItem(STORAGE_KEY, String(hidden)) } catch {}
  }, [hidden])

  return { hidden, toggle: () => setHidden(h => !h) }
}
