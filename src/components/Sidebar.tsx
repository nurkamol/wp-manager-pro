import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Puzzle, Palette, FolderOpen, Database,
  Server, Construction, Users, Bug, Image, StickyNote,
  ChevronLeft, ChevronRight, ExternalLink, Settings, RotateCcw,
  Sun, Moon, Monitor, Shield, Activity, Code2, ArrowLeftRight, Mail, HardDrive,
  PanelLeftClose, PanelLeftOpen, Gauge, Clock, Images, FileEdit, Terminal, Keyboard, RefreshCw, ScanLine, Briefcase, Webhook,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getConfig, getBranding, api } from '@/lib/api'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Theme, ThemePreference } from '@/hooks/useTheme'
import { useWpAdminSidebar } from '@/hooks/useWpAdminSidebar'
import { useCommandPalette } from '@/components/CommandPalette'

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
      { to: '/updates', icon: RefreshCw, label: 'Update Manager' },
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
      { to: '/dev-tools', icon: Terminal, label: 'Dev Tools' },
      { to: '/images', icon: Image, label: 'Image Tools' },
      { to: '/media-manager', icon: Images, label: 'Media Manager' },
      { to: '/performance', icon: Gauge, label: 'Performance' },
      { to: '/cron', icon: Clock, label: 'Cron Manager' },
      { to: '/content-tools', icon: FileEdit, label: 'Content Tools' },
      { to: '/notes', icon: StickyNote, label: 'Notes' },
    ],
  },
  {
    label: 'Developer',
    items: [
      { to: '/developer', icon: Webhook, label: 'Dev Utilities' },
    ],
  },
  {
    label: 'Pro',
    items: [
      { to: '/snippets', icon: Code2, label: 'Code Snippets' },
      { to: '/redirects', icon: ArrowLeftRight, label: 'Redirects' },
      { to: '/email', icon: Mail, label: 'Email / SMTP' },
      { to: '/audit-log', icon: Activity, label: 'Audit Log' },
      { to: '/agency', icon: Briefcase, label: 'Agency Tools' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/system', icon: Server, label: 'System Info' },
      { to: '/security', icon: Shield, label: 'Security' },
      { to: '/security-scanner', icon: ScanLine, label: 'Security Scanner' },
      { to: '/reset', icon: RotateCcw, label: 'Reset Tools' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  theme: Theme
  preference: ThemePreference
  onToggleTheme: () => void
}

function getEnvBadgeClass(type: string): string {
  if (type === 'production') return 'bg-red-500/20 text-red-300 ring-1 ring-red-500/40'
  if (type === 'staging') return 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40'
  if (type === 'development') return 'bg-green-500/20 text-green-300 ring-1 ring-green-500/40'
  if (type === 'local') return 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40'
  return 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40'
}

function getEnvDotClass(type: string): string {
  if (type === 'production') return 'bg-red-400'
  if (type === 'staging') return 'bg-orange-400'
  if (type === 'development') return 'bg-green-400'
  if (type === 'local') return 'bg-blue-400'
  return 'bg-purple-400'
}

const themeIcon = (pref: ThemePreference, size: string) => {
  if (pref === 'dark') return <Sun className={size} />
  if (pref === 'auto') return <Monitor className={size} />
  return <Moon className={size} />
}

const themeLabel = (pref: ThemePreference) => {
  if (pref === 'light') return 'Dark mode'
  if (pref === 'dark') return 'Auto (system)'
  return 'Light mode'
}

export function Sidebar({ collapsed, onToggle, theme, preference, onToggleTheme }: SidebarProps) {
  const config = getConfig()
  const branding = getBranding()
  const { hidden: wpSidebarHidden, toggle: toggleWpSidebar } = useWpAdminSidebar()
  const { open: openCommandPalette } = useCommandPalette()
  const pluginName = branding.pluginName || 'WP Manager Pro'
  // Split: first word(s) = main label, last word = sub-badge (e.g. "WP Manager" + "Pro")
  const nameParts = pluginName.split(' ')
  const nameSub  = nameParts.length > 1 ? nameParts.pop()! : ''
  const nameMain = nameParts.join(' ')

  const { data: envData } = useQuery<{ type: string; source: string; custom: string }>({
    queryKey: ['dev-tools-environment'],
    queryFn: () => api.get('/dev-tools/environment'),
    staleTime: 60000,
  })

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
              {envData?.type && (
                <span className={cn('inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider leading-none', getEnvBadgeClass(envData.type))}>
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', getEnvDotClass(envData.type))} />
                  {envData.type}
                </span>
              )}
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
                  aria-label={themeLabel(preference)}
                >
                  {themeIcon(preference, 'w-3.5 h-3.5')}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {themeLabel(preference)}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={openCommandPalette}
                  className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors shrink-0"
                  aria-label="Open command palette"
                >
                  <Keyboard className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Command Palette (⌘K)
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
                aria-label={themeLabel(preference)}
              >
                {themeIcon(preference, 'w-4 h-4')}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {themeLabel(preference)}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={openCommandPalette}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                aria-label="Open command palette"
              >
                <Keyboard className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Command Palette (⌘K)
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </aside>
  )
}
