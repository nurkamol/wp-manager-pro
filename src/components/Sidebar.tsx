import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Puzzle, Palette, FolderOpen, Database, Server,
  Construction, Users, Bug, Image, StickyNote, ChevronLeft, ChevronRight,
  ExternalLink, Settings
} from 'lucide-react'
import { getConfig } from '@/lib/api'
import { useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/plugins', icon: Puzzle, label: 'Plugins' },
  { to: '/themes', icon: Palette, label: 'Themes' },
  { to: '/file-manager', icon: FolderOpen, label: 'File Manager' },
  { to: '/database', icon: Database, label: 'Database' },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/maintenance', icon: Construction, label: 'Maintenance' },
  { to: '/debug', icon: Bug, label: 'Debug Tools' },
  { to: '/images', icon: Image, label: 'Image Tools' },
  { to: '/notes', icon: StickyNote, label: 'Notes' },
  { to: '/system', icon: Server, label: 'System Info' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const config = getConfig()

  return (
    <aside
      className={cn(
        'flex flex-col bg-slate-900 text-white transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center h-16 border-b border-slate-700/50 px-4 shrink-0',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">WP Manager</p>
              <p className="text-[10px] text-slate-400">Pro</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Settings className="w-4 h-4 text-white" />
          </div>
        )}
        <button
          onClick={onToggle}
          className={cn(
            'p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors',
            collapsed && 'hidden'
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Toggle button when collapsed */}
      {collapsed && (
        <button
          onClick={onToggle}
          className="p-3 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors flex justify-center"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => (
            <li key={item.to}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center justify-center w-full h-10 rounded-md transition-colors',
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                        )
                      }
                    >
                      <item.icon className="w-4.5 h-4.5" />
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">
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
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-slate-700/50 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <img
              src={config.user.avatar}
              alt={config.user.name}
              className="w-8 h-8 rounded-full border border-slate-600"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{config.user.name}</p>
              <p className="text-[10px] text-slate-400 truncate">{config.user.email}</p>
            </div>
          </div>
          <a
            href={config.adminUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            WordPress Admin
          </a>
        </div>
      )}

      {/* Version badge */}
      {!collapsed && (
        <div className="px-4 pb-3">
          <span className="text-[10px] text-slate-600">v{config.version}</span>
        </div>
      )}
    </aside>
  )
}
