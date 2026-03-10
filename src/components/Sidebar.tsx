import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Puzzle, Palette, FolderOpen, Database,
  Server, Construction, Users, Bug, Image, StickyNote,
  ChevronLeft, ChevronRight, ExternalLink, Settings, RotateCcw,
  Sun, Moon, Shield, Activity, Code2, ArrowLeftRight, Mail, HardDrive,
  PanelLeftClose, PanelLeftOpen, Gauge,
} from 'lucide-react'
import { getConfig, getBranding } from '@/lib/api'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Theme } from '@/hooks/useTheme'
import { useWpAdminSidebar } from '@/hooks/useWpAdminSidebar'

type NavItem = {
  to: string
  icon: React.ElementType
  label: string
  end?: boolean
}

type NavGroup = {
  label: string | null
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/plugins', icon: Puzzle, label: 'Plugins' },
      { to: '/themes', icon: Palette, label: 'Themes' },
      { to: '/file-manager', icon: FolderOpen, label: 'File Manager' },
      { to: '/users', icon: Users, label: 'Users' },
    ],
  },
  {
    label: 'Database',
    items: [
      { to: '/database', icon: Database, label: 'Database' },
      { to: '/backup', icon: HardDrive, label: 'DB Backup' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/maintenance', icon: Construction, label: 'Maintenance' },
      { to: '/debug', icon: Bug, label: 'Debug Tools' },
      { to: '/images', icon: Image, label: 'Image Tools' },
      { to: '/performance', icon: Gauge, label: 'Performance' },
      { to: '/notes', icon: StickyNote, label: 'Notes' },
    ],
  },
  {
    label: 'Pro',
    items: [
      { to: '/snippets', icon: Code2, label: 'Code Snippets' },
      { to: '/redirects', icon: ArrowLeftRight, label: 'Redirects' },
      { to: '/email', icon: Mail, label: 'Email / SMTP' },
      { to: '/audit-log', icon: Activity, label: 'Audit Log' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/system', icon: Server, label: 'System Info' },
      { to: '/security', icon: Shield, label: 'Security' },
      { to: '/reset', icon: RotateCcw, label: 'Reset Tools' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  theme: Theme
  onToggleTheme: () => void
}

export function Sidebar({ collapsed, onToggle, theme, onToggleTheme }: SidebarProps) {
  const config = getConfig()
  const branding = getBranding()
  const { hidden: wpSidebarHidden, toggle: toggleWpSidebar } = useWpAdminSidebar()
  const pluginName = branding.pluginName || 'WP Manager Pro'
  // Split: first word(s) = main label, last word = sub-badge (e.g. "WP Manager" + "Pro")
  const nameParts = pluginName.split(' ')
  const nameSub  = nameParts.length > 1 ? nameParts.pop()! : ''
  const nameMain = nameParts.join(' ')

  return (
    <aside
      className={cn(
        'flex flex-col bg-slate-900 text-white transition-all duration-300 shrink-0',
        collapsed ? 'w-14' : 'w-60'
      )}
    >
      {/* Logo / Header */}
      <div className={cn(
        'flex items-center h-14 border-b border-slate-700/50 shrink-0',
        collapsed ? 'justify-center px-0' : 'px-4 justify-between'
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt={pluginName} className="w-full h-full object-cover" />
              ) : (
                <Settings className="w-4 h-4 text-white" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">{nameMain}</p>
              {nameSub && <p className="text-[10px] text-slate-400">{nameSub}</p>}
            </div>
          </div>
        )}

        {collapsed ? (
          <button
            onClick={onToggle}
            title="Expand sidebar"
            className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center hover:bg-blue-400 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
        ) : (
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleWpSidebar}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                >
                  {wpSidebarHidden
                    ? <PanelLeftOpen className="w-4 h-4" />
                    : <PanelLeftClose className="w-4 h-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {wpSidebarHidden ? 'Show WP menu' : 'Hide WP menu'}
              </TooltipContent>
            </Tooltip>
            <button
              onClick={onToggle}
              title="Collapse sidebar"
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={gi} className={cn(gi > 0 && (collapsed ? 'mt-4' : ''))}>
            {/* Group label (expanded only) */}
            {!collapsed && gi > 0 && group.label && (
              <div className="px-4 pt-3 pb-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  {group.label}
                </span>
              </div>
            )}

            <ul className={cn(collapsed ? 'space-y-1 px-2' : 'space-y-0.5 px-2')}>
              {group.items.map((item) => (
                <li key={item.to}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <NavLink
                          to={item.to}
                          end={item.end}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center justify-center w-full h-8 rounded-md transition-colors border',
                              isActive
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-slate-800/70 border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700/80 hover:border-slate-600'
                            )
                          }
                        >
                          <item.icon className="w-[18px] h-[18px]" />
                        </NavLink>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                        )
                      }
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed ? (
        <div className="p-3 border-t border-slate-700/50 shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <img
              src={config.user.avatar}
              alt={config.user.name}
              className="w-7 h-7 rounded-full border border-slate-600 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{config.user.name}</p>
              <p className="text-[10px] text-slate-400 truncate">{config.user.email}</p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleTheme}
                  className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors shrink-0"
                  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center justify-between">
            <a
              href={config.adminUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              WP Admin
            </a>
            <span className="text-[10px] text-slate-600">v{config.version}</span>
          </div>
        </div>
      ) : (
        <div className="pb-3 border-t border-slate-700/50 shrink-0 flex flex-col items-center gap-1 pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <img
                src={config.user.avatar}
                alt={config.user.name}
                className="w-7 h-7 rounded-full border border-slate-600 cursor-pointer"
              />
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              <p className="font-medium">{config.user.name}</p>
              <p className="text-muted-foreground">{config.user.email}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleWpSidebar}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
              >
                {wpSidebarHidden
                  ? <PanelLeftOpen className="w-4 h-4" />
                  : <PanelLeftClose className="w-4 h-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {wpSidebarHidden ? 'Show WP menu' : 'Hide WP menu'}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleTheme}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </aside>
  )
}
