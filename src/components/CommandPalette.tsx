import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
  type KeyboardEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { api, getConfig } from '@/lib/api'
import {
  LayoutDashboard, Puzzle, Palette, FolderOpen, Database,
  Server, Construction, Users, Bug, Image, StickyNote,
  Settings, RotateCcw, Shield, Activity, Code2, ArrowLeftRight, Mail, HardDrive,
  Gauge, Clock, Images, FileEdit, Terminal, Search, Zap, Trash2,
  WifiOff, Archive, Briefcase, RefreshCw, Webhook, ScanLine, User, FileText, LayoutGrid,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  type: 'plugin' | 'user' | 'note' | 'audit' | 'option'
  label: string
  subtitle: string
  route: string
  icon: string
  group: 'Search Results'
  id: string
}

function searchResultIcon(icon: string) {
  switch (icon) {
    case 'puzzle':   return Puzzle
    case 'user':     return User
    case 'note':     return StickyNote
    case 'activity': return Activity
    case 'settings': return Settings
    default:         return FileText
  }
}

interface NavItem {
  id: string
  label: string
  icon: React.ElementType
  route: string
  group: 'Navigation'
}

interface ActionItem {
  id: string
  label: string
  icon: React.ElementType
  group: 'Quick Actions'
  action: () => Promise<void>
}

type PaletteItem = NavItem | ActionItem | SearchResult

// ── Navigation items (mirrors sidebar navGroups) ─────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',     label: 'Dashboard',      icon: LayoutDashboard, route: '/',              group: 'Navigation' },
  { id: 'plugins',       label: 'Plugins',         icon: Puzzle,          route: '/plugins',        group: 'Navigation' },
  { id: 'themes',        label: 'Themes',          icon: Palette,         route: '/themes',         group: 'Navigation' },
  { id: 'file-manager',  label: 'File Manager',    icon: FolderOpen,      route: '/file-manager',   group: 'Navigation' },
  { id: 'users',         label: 'Users',           icon: Users,           route: '/users',          group: 'Navigation' },
  { id: 'database',      label: 'Database',        icon: Database,        route: '/database',       group: 'Navigation' },
  { id: 'backup',        label: 'DB Backup',       icon: HardDrive,       route: '/backup',         group: 'Navigation' },
  { id: 'maintenance',   label: 'Maintenance',     icon: Construction,    route: '/maintenance',    group: 'Navigation' },
  { id: 'debug',         label: 'Debug Tools',     icon: Bug,             route: '/debug',          group: 'Navigation' },
  { id: 'dev-tools',     label: 'Dev Tools',       icon: Terminal,        route: '/dev-tools',      group: 'Navigation' },
  { id: 'images',        label: 'Image Tools',     icon: Image,           route: '/images',         group: 'Navigation' },
  { id: 'media-manager', label: 'Media Manager',   icon: Images,          route: '/media-manager',  group: 'Navigation' },
  { id: 'performance',   label: 'Performance',     icon: Gauge,           route: '/performance',    group: 'Navigation' },
  { id: 'cron',          label: 'Cron Manager',    icon: Clock,           route: '/cron',           group: 'Navigation' },
  { id: 'content-tools', label: 'Content Tools',   icon: FileEdit,        route: '/content-tools',  group: 'Navigation' },
  { id: 'post-types',    label: 'Post Types',      icon: LayoutGrid,      route: '/post-types',     group: 'Navigation' },
  { id: 'notes',         label: 'Notes',           icon: StickyNote,      route: '/notes',          group: 'Navigation' },
  { id: 'snippets',      label: 'Code Snippets',   icon: Code2,           route: '/snippets',       group: 'Navigation' },
  { id: 'redirects',     label: 'Redirects',       icon: ArrowLeftRight,  route: '/redirects',      group: 'Navigation' },
  { id: 'email',         label: 'Email / SMTP',    icon: Mail,            route: '/email',          group: 'Navigation' },
  { id: 'audit-log',     label: 'Audit Log',       icon: Activity,        route: '/audit-log',      group: 'Navigation' },
  { id: 'system',        label: 'System Info',     icon: Server,          route: '/system',         group: 'Navigation' },
  { id: 'security',         label: 'Security',          icon: Shield,        route: '/security',          group: 'Navigation' },
  { id: 'security-scanner', label: 'Security Scanner',   icon: ScanLine,      route: '/security-scanner',  group: 'Navigation' },
  { id: 'update-manager',   label: 'Update Manager',     icon: RefreshCw,     route: '/updates',           group: 'Navigation' },
  { id: 'agency',           label: 'Agency Tools',       icon: Briefcase,     route: '/agency',            group: 'Navigation' },
  { id: 'developer',        label: 'Developer Utilities',icon: Webhook,       route: '/developer',         group: 'Navigation' },
  { id: 'reset',            label: 'Reset Tools',        icon: RotateCcw,     route: '/reset',             group: 'Navigation' },
  { id: 'settings',         label: 'Settings',           icon: Settings,      route: '/settings',          group: 'Navigation' },
]

// ── Recent pages helpers ──────────────────────────────────────────────────────

const RECENT_KEY = 'wmp-recent-pages'
const RECENT_MAX = 5

function getRecentPages(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  } catch {
    return []
  }
}

function addRecentPage(routeId: string) {
  const recent = getRecentPages().filter(id => id !== routeId)
  recent.unshift(routeId)
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, RECENT_MAX)))
}

// ── Context ───────────────────────────────────────────────────────────────────

interface CommandPaletteContextValue {
  open: () => void
  close: () => void
  isOpen: boolean
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null)

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) throw new Error('useCommandPalette must be used inside CommandPaletteProvider')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const open  = useCallback(() => setIsOpen(true),  [])
  const close = useCallback(() => setIsOpen(false), [])

  // Read shortcut preference from localStorage (set in Settings)
  // Default: Cmd/Ctrl+Shift+P to avoid conflict with WordPress's native Cmd+K palette
  const getShortcut = () => {
    try { return localStorage.getItem('wmp-palette-shortcut') || 'shift+p' } catch { return 'shift+p' }
  }

  // Global keyboard listener — matches the configured shortcut
  useEffect(() => {
    function handler(e: globalThis.KeyboardEvent) {
      const shortcut = getShortcut()
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const key = e.key.toLowerCase()
      const matches =
        (shortcut === 'shift+p' && e.shiftKey && key === 'p') ||
        (shortcut === 'shift+k' && e.shiftKey && key === 'k') ||
        (shortcut === 'k'       && !e.shiftKey && key === 'k')
      if (matches) {
        e.preventDefault()
        e.stopPropagation()
        setIsOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler, true) // capture phase beats WP
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  return (
    <CommandPaletteContext.Provider value={{ open, close, isOpen }}>
      {children}
    </CommandPaletteContext.Provider>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CommandPalette() {
  const { isOpen, close } = useCommandPalette()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)
  const config   = getConfig()

  // Debounce query by 300ms for data search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const { data: searchData, isFetching: searchFetching } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: () => api.get(`/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length >= 2,
    staleTime: 10_000,
    retry: false,
  })

  // Build Quick Actions (need navigate + close in scope)
  const quickActions: ActionItem[] = [
    {
      id: 'flush-cache',
      label: 'Flush Object Cache',
      icon: Zap,
      group: 'Quick Actions',
      action: async () => {
        await api.post('/performance/object-cache/flush', {})
        toast.success('Object cache flushed')
      },
    },
    {
      id: 'toggle-maintenance',
      label: 'Toggle Maintenance Mode',
      icon: Construction,
      group: 'Quick Actions',
      action: async () => {
        const current = await api.get<{ enabled: boolean }>('/maintenance')
        await api.post('/maintenance/toggle', { enabled: !current.enabled })
        toast.success(`Maintenance mode ${current.enabled ? 'disabled' : 'enabled'}`)
      },
    },
    {
      id: 'clear-error-log',
      label: 'Clear Error Log',
      icon: Trash2,
      group: 'Quick Actions',
      action: async () => {
        await api.post('/debug/clear-log', {})
        toast.success('Error log cleared')
      },
    },
    {
      id: 'purge-transients',
      label: 'Purge Expired Transients',
      icon: WifiOff,
      group: 'Quick Actions',
      action: async () => {
        await api.post('/performance/transients/purge-expired', {})
        toast.success('Expired transients purged')
      },
    },
    {
      id: 'create-backup',
      label: 'Create Backup',
      icon: Archive,
      group: 'Quick Actions',
      action: async () => {
        await api.post('/backup/create', {})
        toast.success('Backup created successfully')
      },
    },
  ]

  // Get recent items
  const recentIds = getRecentPages()
  const recentItems: NavItem[] = recentIds
    .map(id => NAV_ITEMS.find(n => n.id === id))
    .filter((n): n is NavItem => Boolean(n))

  // Build filtered list
  const q = query.toLowerCase().trim()

  // Map API search results to palette items
  const rawResults = Array.isArray((searchData as any)?.results) ? (searchData as any).results : []
  const searchItems: SearchResult[] = rawResults.map((r: any, i: number) => ({
    ...r,
    group: 'Search Results' as const,
    id: `search-${r.type}-${i}`,
  }))

  let items: PaletteItem[]

  if (!q) {
    const recentSection = recentItems.length > 0
      ? recentItems.map(n => ({ ...n, group: 'Recent' as const })) as (NavItem & { group: 'Recent' })[]
      : []
    items = [...recentSection, ...NAV_ITEMS, ...quickActions] as PaletteItem[]
  } else {
    const matchedNav     = NAV_ITEMS.filter(n => n.label.toLowerCase().includes(q) || n.route.toLowerCase().includes(q))
    const matchedActions = quickActions.filter(a => a.label.toLowerCase().includes(q))
    items = [...searchItems, ...matchedNav, ...matchedActions]
  }

  // Reset active index when items change
  useEffect(() => {
    setActiveIndex(0)
  }, [query, isOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function activate(item: PaletteItem) {
    const group = item.group as string
    if (group === 'Navigation' || group === 'Recent') {
      const navItem = item as NavItem
      addRecentPage(navItem.id)
      navigate(navItem.route)
      close()
    } else if (group === 'Search Results') {
      navigate((item as SearchResult).route)
      close()
    } else {
      const actionItem = item as ActionItem
      close()
      actionItem.action().catch((err: Error) => toast.error(err.message || 'Action failed'))
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (items[activeIndex]) activate(items[activeIndex])
    } else if (e.key === 'Escape') {
      close()
    }
  }

  // Group items for display
  const grouped: { group: string; items: { item: PaletteItem; index: number }[] }[] = []
  items.forEach((item, index) => {
    const g = item.group as string
    let section = grouped.find(s => s.group === g)
    if (!section) {
      section = { group: g, items: [] }
      grouped.push(section)
    }
    section.items.push({ item, index })
  })

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && close()}>
      <DialogContent
        className="p-0 gap-0 max-w-xl overflow-hidden [&>button.absolute]:hidden"
        style={{ top: '20%', transform: 'translateX(-50%)' }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, plugins, users, notes…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
          />
          <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 font-mono">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-96 overflow-y-auto py-2">
          {items.length === 0 && !searchFetching && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No results for "{query}"
            </div>
          )}
          {searchFetching && q.length >= 2 && (
            <div className="px-4 py-3 flex items-center gap-2 text-xs text-slate-400">
              <RefreshCw className="w-3 h-3 animate-spin" /> Searching data…
            </div>
          )}

          {grouped.map(section => (
            <div key={section.group}>
              <div className="px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {section.group}
                </span>
              </div>
              {section.items.map(({ item, index }) => {
                const isSearch = (item.group as string) === 'Search Results'
                const Icon = isSearch
                  ? searchResultIcon((item as SearchResult).icon)
                  : (item as NavItem | ActionItem).icon
                const isActive = index === activeIndex
                return (
                  <button
                    key={item.id}
                    data-index={index}
                    onClick={() => activate(item)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 mx-1 rounded-md text-sm transition-colors text-left',
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    )}
                    style={{ width: 'calc(100% - 8px)' }}
                  >
                    <span className={cn(
                      'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
                      isActive
                        ? 'bg-blue-100 dark:bg-blue-800/50 text-blue-600 dark:text-blue-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    )}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{item.label}</span>
                      {isSearch && (item as SearchResult).subtitle && (
                        <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {(item as SearchResult).subtitle}
                        </span>
                      )}
                    </span>
                    {((item.group as string) === 'Navigation' || (item.group as string) === 'Recent') && (
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {(item as NavItem).route === '/' ? '/' : (item as NavItem).route.replace('/', '')}
                      </span>
                    )}
                    {isSearch && (
                      <span className={cn(
                        'text-[9px] font-semibold uppercase tracking-wide shrink-0 px-1.5 py-0.5 rounded',
                        isActive ? 'bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      )}>
                        {(item as SearchResult).type}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <kbd className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 font-mono">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 font-mono">↵</kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 font-mono">Esc</kbd>
            close
          </span>
          <span className="ml-auto">
            {config.version && `WP Manager Pro v${config.version}`}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
