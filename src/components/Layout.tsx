import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useState } from 'react'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/useTheme'

export function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const { theme, toggle } = useTheme()

  return (
    <TooltipProvider>
      <div className={`wmp-app flex h-screen overflow-hidden ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} theme={theme} onToggleTheme={toggle} />
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster position="bottom-right" richColors theme={theme} />
    </TooltipProvider>
  )
}
