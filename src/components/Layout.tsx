import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useState } from 'react'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export function Layout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <TooltipProvider>
      <div className="wmp-app flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster position="bottom-right" richColors />
    </TooltipProvider>
  )
}
