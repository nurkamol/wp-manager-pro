import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useState } from 'react'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/useTheme'
import { AlertTriangle, X } from 'lucide-react'

const isPlainPermalinks =
  typeof window !== 'undefined' &&
  window.wpManagerPro?.permalinks?.isPlain === true

export function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [showPermalinkWarn, setShowPermalinkWarn] = useState(isPlainPermalinks)
  const { theme, toggle } = useTheme()

  return (
    <TooltipProvider>
      <div className={`wmp-app flex h-screen overflow-hidden ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} theme={theme} onToggleTheme={toggle} />
        <main className="flex-1 flex flex-col overflow-hidden">
          {showPermalinkWarn && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm flex-shrink-0">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong>Plain Permalinks detected.</strong> WP Manager Pro requires pretty permalinks (e.g. "Post name") to communicate with the WordPress REST API.{' '}
                <a
                  href={typeof window !== 'undefined' ? `${window.wpManagerPro?.adminUrl || ''}options-permalink.php` : '#'}
                  className="underline font-medium"
                  target="_parent"
                >
                  Fix in Settings → Permalinks
                </a>
              </span>
              <button
                className="ml-auto flex-shrink-0 opacity-60 hover:opacity-100"
                onClick={() => setShowPermalinkWarn(false)}
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster position="bottom-right" richColors theme={theme} />
    </TooltipProvider>
  )
}
