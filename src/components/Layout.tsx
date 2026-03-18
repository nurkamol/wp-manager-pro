import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { useState, useEffect } from 'react'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/useTheme'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { AlertTriangle, X } from 'lucide-react'

const isPlainPermalinks =
  typeof window !== 'undefined' &&
  window.wpManagerPro?.permalinks?.isPlain === true

export function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [showPermalinkWarn, setShowPermalinkWarn] = useState(isPlainPermalinks)
  const { theme, preference, toggle } = useTheme()
  const { isMobile, isTablet } = useBreakpoint()

  // Auto-collapse on tablet, restore on desktop
  useEffect(() => {
    if (isTablet) setCollapsed(true)
    else if (!isMobile) setCollapsed(false)
  }, [isTablet, isMobile])

  return (
    <TooltipProvider>
      <div className={`wmp-app flex h-screen overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-50'}`}>
        {/* Sidebar — hidden on mobile */}
        {!isMobile && (
          <Sidebar
            collapsed={collapsed}
            onToggle={() => setCollapsed(!collapsed)}
            theme={theme}
            preference={preference}
            onToggleTheme={toggle}
          />
        )}

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
          {/* Extra bottom padding on mobile to clear the bottom nav */}
          <div className={`flex-1 overflow-y-auto ${isMobile ? 'pb-14' : ''}`}>
            <Outlet />
          </div>
        </main>

        {/* Bottom nav — mobile only */}
        {isMobile && (
          <BottomNav theme={theme} preference={preference} onToggleTheme={toggle} />
        )}
      </div>
      <Toaster position={isMobile ? 'top-center' : 'bottom-right'} richColors theme={theme} />
    </TooltipProvider>
  )
}
