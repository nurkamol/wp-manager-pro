import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Puzzle, Palette, Database, Menu, X,
  FolderOpen, Users, Construction, Bug, Image, StickyNote,
  Server, Shield, Activity, Code2, ArrowLeftRight, Mail, HardDrive,
  Gauge, Clock, Images, FileEdit, Terminal, RefreshCw, ScanLine,
  Briefcase, Webhook, RotateCcw, Settings,
} from 'lucide-react'
import type { Theme, ThemePreference } from '@/hooks/useTheme'
import { NotificationBell } from '@/components/NotificationPanel'

const MORE_ITEMS = [
  { to: '/file-manager',    icon: FolderOpen,    label: 'File Manager' },
  { to: '/users',           icon: Users,         label: 'Users' },
  { to: '/updates',         icon: RefreshCw,     label: 'Update Manager' },
  { to: '/backup',          icon: HardDrive,     label: 'DB Backup' },
  { to: '/maintenance',     icon: Construction,  label: 'Maintenance' },
  { to: '/debug',           icon: Bug,           label: 'Debug Tools' },
  { to: '/dev-tools',       icon: Terminal,      label: 'Dev Tools' },
  { to: '/images',          icon: Image,         label: 'Image Tools' },
  { to: '/media-manager',   icon: Images,        label: 'Media Manager' },
  { to: '/performance',     icon: Gauge,         label: 'Performance' },
  { to: '/cron',            icon: Clock,         label: 'Cron Manager' },
  { to: '/content-tools',   icon: FileEdit,      label: 'Content Tools' },
  { to: '/notes',           icon: StickyNote,    label: 'Notes' },
  { to: '/developer',       icon: Webhook,       label: 'Dev Utilities' },
  { to: '/snippets',        icon: Code2,         label: 'Code Snippets' },
  { to: '/redirects',       icon: ArrowLeftRight,label: 'Redirects' },
  { to: '/email',           icon: Mail,          label: 'Email / SMTP' },
  { to: '/audit-log',       icon: Activity,      label: 'Audit Log' },
  { to: '/agency',          icon: Briefcase,     label: 'Agency Tools' },
  { to: '/system',          icon: Server,        label: 'System Info' },
  { to: '/security',        icon: Shield,        label: 'Security' },
  { to: '/security-scanner',icon: ScanLine,      label: 'Security Scanner' },
  { to: '/reset',           icon: RotateCcw,     label: 'Reset Tools' },
  { to: '/settings',        icon: Settings,      label: 'Settings' },
]

const PRIMARY_ITEMS = [
  { to: '/',        icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/plugins', icon: Puzzle,          label: 'Plugins' },
  { to: '/themes',  icon: Palette,         label: 'Themes' },
  { to: '/database',icon: Database,        label: 'Database' },
]

interface BottomNavProps {
  theme: Theme
  preference: ThemePreference
  onToggleTheme: () => void
}

export function BottomNav({ theme }: BottomNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()

  const handleMoreNav = (to: string) => {
    navigate(to)
    setDrawerOpen(false)
  }

  return (
    <>
      {/* Drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* More drawer — slides up from bottom */}
      <div className={cn(
        'fixed bottom-14 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700/50 transition-transform duration-300',
        drawerOpen ? 'translate-y-0' : 'translate-y-full'
      )}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
          <span className="text-sm font-semibold text-white">All Pages</span>
          <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto max-h-[60vh] p-3">
          <div className="grid grid-cols-3 gap-2">
            {MORE_ITEMS.map((item) => (
              <button
                key={item.to}
                onClick={() => handleMoreNav(item.to)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white transition-colors"
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] leading-tight text-center">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 h-14 bg-slate-900 border-t border-slate-700/50 flex items-center">
        <div className="flex w-full">
          {PRIMARY_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors',
                isActive ? 'text-blue-400' : 'text-slate-400 hover:text-white'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {/* Notifications */}
          <div className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] text-slate-400">
            <div className="relative flex items-center justify-center">
              <NotificationBell collapsed={true} />
            </div>
            <span>Alerts</span>
          </div>

          {/* More */}
          <button
            onClick={() => setDrawerOpen(v => !v)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors',
              drawerOpen ? 'text-blue-400' : 'text-slate-400 hover:text-white'
            )}
          >
            <Menu className="w-5 h-5" />
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  )
}
