import { useState, useRef, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  Search, Power, Trash2, Download, RefreshCw, AlertTriangle,
  Star, Upload, Package, ArrowUpCircle, CheckCircle2, History,
  X, CheckSquare, Square, Minus, FileArchive, ChevronDown,
  ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, Info,
} from 'lucide-react'
import { stripHtml, truncate } from '@/lib/utils'

interface Plugin {
  file: string
  name: string
  version: string
  description: string
  author: string
  active: boolean
  has_update: boolean
}

interface WpPlugin {
  slug: string
  name: string
  version: string
  short_description: string
  author: string
  rating: number
  num_ratings: number
  downloaded: number
  icon: string
}

interface QueueItem {
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  message?: string
}

// ── Health Check types ────────────────────────────────────────────────────────

type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown'

interface HealthIssue {
  type: string
  level: 'info' | 'warning' | 'critical'
  message: string
  cvss?: number | null
  cve?: string | null
}

interface PluginHealth {
  file: string
  slug: string
  name: string
  version: string
  active: boolean
  status: HealthStatus
  issues: HealthIssue[]
  wporg: {
    rating: number | null
    num_ratings: number | null
    active_installs: number | null
    last_updated: string | null
    tested: string | null
  } | null
}

interface HealthData {
  summary: { total: number; critical: number; warning: number; unknown: number; healthy: number; cached_at: string }
  plugins: PluginHealth[]
}

const STATUS_CONFIG: Record<HealthStatus, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  critical: { icon: ShieldX,        color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-900/20',    label: 'Critical' },
  warning:  { icon: ShieldAlert,    color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-900/20', label: 'Warning'  },
  unknown:  { icon: ShieldQuestion, color: 'text-slate-400',  bg: 'bg-slate-50 dark:bg-slate-800',   label: 'Unknown'  },
  healthy:  { icon: ShieldCheck,    color: 'text-green-500',  bg: 'bg-green-50 dark:bg-green-900/20', label: 'Healthy'  },
}

const ISSUE_LEVEL_COLOR: Record<string, string> = {
  critical: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  warning:  'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  info:     'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
}

function HealthCheck() {
  const [filter, setFilter] = useState<HealthStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const { data, isLoading, isFetching, refetch } = useQuery<HealthData>({
    queryKey: ['plugins-health'],
    queryFn: () => api.get('/plugins/health'),
    staleTime: Infinity, // only refetch on manual trigger
    retry: false,
  })

  function handleRescan() {
    refetch()
    // bust the server cache
    api.get('/plugins/health?bust=1').then(() => refetch())
  }

  const filtered = (data?.plugins ?? []).filter(p => {
    if (filter !== 'all' && p.status !== filter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      {data && (
        <div className="grid grid-cols-4 gap-3">
          {(['critical', 'warning', 'unknown', 'healthy'] as HealthStatus[]).map(s => {
            const cfg = STATUS_CONFIG[s]
            const Icon = cfg.icon
            const count = data.summary[s]
            return (
              <button
                key={s}
                onClick={() => setFilter(filter === s ? 'all' : s)}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left
                  ${filter === s ? 'ring-2 ring-blue-500' : ''}
                  ${cfg.bg} border-transparent dark:border-slate-700`}
              >
                <Icon className={`h-6 w-6 flex-shrink-0 ${cfg.color}`} />
                <div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white leading-none">{count}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{cfg.label}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter plugins…"
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <Button size="sm" variant="outline" onClick={handleRescan} disabled={isFetching}
          className="dark:border-slate-600 dark:text-slate-300 ml-auto">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
          {isLoading ? 'Scanning…' : isFetching ? 'Rescanning…' : 'Re-scan'}
        </Button>
        {data && (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Cached {new Date(data.summary.cached_at).toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Not yet loaded */}
      {!data && !isLoading && (
        <Card className="dark:bg-slate-900 dark:border-slate-700">
          <CardContent className="py-14 text-center">
            <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="font-medium text-slate-600 dark:text-slate-400">Run a health check</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 mb-4">
              Checks each plugin against WordPress.org for abandonment, compatibility, low ratings, and known CVEs.
            </p>
            <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
              <ShieldCheck className="h-4 w-4 mr-1.5" />
              Start Scan
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <p className="text-sm">Checking plugins against WordPress.org…</p>
          <p className="text-xs text-slate-500">This may take a moment for large installs</p>
        </div>
      )}

      {/* Results */}
      {!isLoading && filtered.length === 0 && data && (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">No plugins match the current filter.</p>
      )}

      <div className="space-y-2">
        {filtered.map(plugin => {
          const cfg = STATUS_CONFIG[plugin.status]
          const Icon = cfg.icon
          return (
            <Card key={plugin.file} className="dark:bg-slate-900 dark:border-slate-700">
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 dark:text-white text-sm">{plugin.name}</span>
                      <code className="text-xs text-slate-400 dark:text-slate-500">v{plugin.version}</code>
                      {!plugin.active && (
                        <Badge variant="secondary" className="text-xs dark:bg-slate-700 dark:text-slate-400">Inactive</Badge>
                      )}
                      {plugin.wporg && (
                        <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          {plugin.wporg.rating?.toFixed(1) ?? '—'}
                          {plugin.wporg.active_installs != null && (
                            <span className="ml-1">{formatInstalls(plugin.wporg.active_installs)} installs</span>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Issues */}
                    {plugin.issues.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {plugin.issues.map((issue, i) => (
                          <div key={i} className={`flex items-start gap-2 text-xs px-2 py-1.5 rounded border ${ISSUE_LEVEL_COLOR[issue.level]}`}>
                            {issue.level === 'critical' ? <ShieldX className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /> :
                             issue.level === 'warning'  ? <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /> :
                             <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />}
                            <span>{issue.message}
                              {issue.cve && <span className="ml-1 font-mono font-semibold">[{issue.cve}]</span>}
                              {issue.cvss != null && <span className="ml-1 opacity-70">CVSS {issue.cvss}</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {plugin.status === 'healthy' && plugin.issues.length === 0 && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">No issues found</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function pluginWord(n?: number) {
  return n === 1 ? '1 plugin' : `${n ?? '…'} plugins`
}

function formatInstalls(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M+'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K+'
  return String(n)
}

export function Plugins() {
  const queryClient = useQueryClient()
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [wpSearch, setWpSearch] = useState('')
  const [wpSearchQuery, setWpSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Plugin | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [installing, setInstalling] = useState<string | null>(null)
  const [versionsPlugin, setVersionsPlugin] = useState<{ slug: string; name: string; file: string } | null>(null)

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Upload queue (multi-file)
  const [uploadQueue, setUploadQueue] = useState<QueueItem[]>([])
  const [overwrite, setOverwrite] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploadingAll, setIsUploadingAll] = useState(false)

  const { data: pluginsData, isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: () => api.get<{ plugins: Plugin[] }>('/plugins'),
  })

  const { data: wpPlugins, isLoading: isSearching, isError: isSearchError, error: searchError } = useQuery({
    queryKey: ['wp-plugins-search', wpSearchQuery],
    queryFn: async () => {
      const url = new URL('https://api.wordpress.org/plugins/info/1.2/')
      url.searchParams.set('action', 'query_plugins')
      url.searchParams.set('request[search]', wpSearchQuery)
      url.searchParams.set('request[per_page]', '12')
      url.searchParams.set('request[fields][short_description]', '1')
      url.searchParams.set('request[fields][icons]', '1')
      url.searchParams.set('request[fields][rating]', '1')
      url.searchParams.set('request[fields][num_ratings]', '1')
      url.searchParams.set('request[fields][downloaded]', '1')
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`WordPress.org API error: HTTP ${res.status}`)
      const data = await res.json()
      const plugins: WpPlugin[] = (data.plugins || []).map((p: Record<string, unknown>) => ({
        slug: p.slug as string,
        name: p.name as string,
        version: p.version as string,
        short_description: p.short_description as string,
        author: p.author as string,
        rating: p.rating as number,
        num_ratings: p.num_ratings as number,
        downloaded: p.downloaded as number,
        icon: (p.icons as Record<string, string> | undefined)?.[`1x`]
          || (p.icons as Record<string, string> | undefined)?.svg
          || (p.icons as Record<string, string> | undefined)?.[`2x`]
          || '',
      }))
      return { plugins }
    },
    enabled: !!wpSearchQuery,
    retry: 1,
  })

  const { data: versionsData, isLoading: isLoadingVersions } = useQuery({
    queryKey: ['plugin-versions', versionsPlugin?.slug],
    queryFn: async () => {
      const url = new URL('https://api.wordpress.org/plugins/info/1.2/')
      url.searchParams.set('action', 'plugin_information')
      url.searchParams.set('request[slug]', versionsPlugin!.slug)
      url.searchParams.set('request[fields][versions]', '1')
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const versions = Object.keys(data.versions || {})
        .filter(v => v !== 'trunk')
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }))
      return { versions }
    },
    enabled: !!versionsPlugin,
    staleTime: 60000,
  })

  const installedMap = useMemo(() => {
    const map = new Map<string, Plugin>()
    pluginsData?.plugins.forEach(p => {
      const slug = p.file.includes('/') ? p.file.split('/')[0] : p.file.replace('.php', '')
      map.set(slug, p)
    })
    return map
  }, [pluginsData])

  // ── Individual mutations ──
  const toggleMutation = useMutation({
    mutationFn: ({ plugin, active }: { plugin: string; active: boolean }) =>
      api.post(active ? '/plugins/deactivate' : '/plugins/activate', { plugin }),
    onSuccess: (_, { active, plugin: file }) => {
      const name = pluginsData?.plugins.find(p => p.file === file)?.name || file
      toast.success(active ? `Deactivated: ${name}` : `Activated: ${name}`)
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (plugin: string) => api.delete('/plugins/delete', { plugin }),
    onSuccess: () => {
      toast.success('Plugin deleted')
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
      setDeleteTarget(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const installMutation = useMutation({
    mutationFn: (slug: string) => { setInstalling(slug); return api.post('/plugins/install', { slug }) },
    onSuccess: (_, slug) => {
      toast.success(`Plugin installed: ${slug}`)
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
      setInstalling(null)
    },
    onError: (err: Error) => { toast.error(err.message); setInstalling(null) },
  })

  const updateMutation = useMutation({
    mutationFn: (plugin: string) => api.post('/plugins/update', { plugin }),
    onSuccess: (_, plugin) => {
      const name = pluginsData?.plugins.find(p => p.file === plugin)?.name || plugin
      toast.success(`Updated: ${name}`)
      queryClient.refetchQueries({ queryKey: ['plugins'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const installVersionMutation = useMutation({
    mutationFn: ({ slug, version }: { slug: string; version: string }) =>
      api.post('/plugins/install-version', { slug, version }),
    onSuccess: (_, { version }) => {
      toast.success(`Plugin v${version} installed`)
      queryClient.refetchQueries({ queryKey: ['plugins'] })
      setVersionsPlugin(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const checkUpdatesMutation = useMutation({
    mutationFn: () => api.post<{ plugins: Plugin[]; total: number }>('/plugins/check-updates', {}),
    onSuccess: (data) => {
      queryClient.setQueryData(['plugins'], data)
      toast.success('Update check complete')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const exportMutation = useMutation({
    mutationFn: (plugin: string) => api.post<{ download_url: string }>('/plugins/export', { plugin }),
    onSuccess: (data) => { window.location.href = data.download_url },
    onError: (err: Error) => toast.error(err.message),
  })

  // ── Bulk mutations ──
  const bulkActivateMutation = useMutation({
    mutationFn: (plugins: string[]) => api.post('/plugins/bulk-activate', { plugins }),
    onSuccess: (_, plugins) => {
      toast.success(`${plugins.length} plugin(s) activated`)
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
      setSelected(new Set())
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const bulkDeactivateMutation = useMutation({
    mutationFn: (plugins: string[]) => api.post('/plugins/bulk-deactivate', { plugins }),
    onSuccess: (_, plugins) => {
      toast.success(`${plugins.length} plugin(s) deactivated`)
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
      setSelected(new Set())
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const bulkUpdateMutation = useMutation({
    mutationFn: (plugins: string[]) => api.post<{ updated: number; failed: number; message: string }>('/plugins/bulk-update', { plugins }),
    onSuccess: (data) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
      setSelected(new Set())
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (plugins: string[]) => api.delete('/plugins/bulk-delete', { plugins }),
    onSuccess: (_, plugins) => {
      toast.success(`${plugins.length} plugin(s) deleted`)
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
      setSelected(new Set())
      setBulkDeleteOpen(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // ── Selection helpers ──
  const toggleSelect = useCallback((file: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(file) ? next.delete(file) : next.add(file)
      return next
    })
  }, [])

  const toggleSelectGroup = useCallback((files: string[]) => {
    setSelected(prev => {
      const allSelected = files.every(f => prev.has(f))
      const next = new Set(prev)
      if (allSelected) files.forEach(f => next.delete(f))
      else files.forEach(f => next.add(f))
      return next
    })
  }, [])

  // ── Upload queue handlers ──
  const addFilesToQueue = (files: FileList | File[]) => {
    const zips = Array.from(files).filter(f => f.name.endsWith('.zip'))
    if (zips.length === 0) { toast.error('Only .zip files are accepted'); return }
    setUploadQueue(prev => {
      const existing = new Set(prev.map(q => q.file.name))
      const newItems: QueueItem[] = zips
        .filter(f => !existing.has(f.name))
        .map(f => ({ file: f, status: 'pending' }))
      return [...prev, ...newItems]
    })
  }

  const removeFromQueue = (index: number) => {
    setUploadQueue(prev => prev.filter((_, i) => i !== index))
  }

  const handleUploadAll = async () => {
    const pending = uploadQueue.filter(q => q.status === 'pending')
    if (pending.length === 0) return
    setIsUploadingAll(true)

    for (let i = 0; i < uploadQueue.length; i++) {
      if (uploadQueue[i].status !== 'pending') continue

      setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'uploading' } : q))

      const fd = new FormData()
      fd.append('file', uploadQueue[i].file)
      fd.append('overwrite', overwrite ? '1' : '0')

      try {
        await api.upload('/plugins/upload', fd)
        setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'done', message: 'Installed' } : q))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed'
        setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'error', message: msg } : q))
      }
    }

    setIsUploadingAll(false)
    queryClient.invalidateQueries({ queryKey: ['plugins'] })
    toast.success('Upload complete')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addFilesToQueue(e.dataTransfer.files)
  }

  // ── Filtered lists ──
  const filtered = pluginsData?.plugins.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.author.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  const activePlugins = filtered.filter(p => p.active)
  const inactivePlugins = filtered.filter(p => !p.active)
  const updatesAvailable = pluginsData?.plugins.filter(p => p.has_update).length ?? 0

  // ── Bulk toolbar computed values ──
  const selectedList = pluginsData?.plugins.filter(p => selected.has(p.file)) ?? []
  const selectedInactive = selectedList.filter(p => !p.active)
  const selectedActive = selectedList.filter(p => p.active)
  const selectedWithUpdates = selectedList.filter(p => p.has_update)
  const isBulkBusy = bulkActivateMutation.isPending || bulkDeactivateMutation.isPending
    || bulkUpdateMutation.isPending || bulkDeleteMutation.isPending

  const openVersions = (plugin: Plugin) => {
    const slug = plugin.file.includes('/') ? plugin.file.split('/')[0] : plugin.file.replace('.php', '')
    setVersionsPlugin({ slug, name: plugin.name, file: plugin.file })
  }

  if (isLoading) return <PageLoader text="Loading plugins..." />

  return (
    <div className="fade-in">
      <PageHeader
        title="Plugin Manager"
        description={`${pluginsData?.plugins.length || 0} plugins installed${updatesAvailable > 0 ? ` · ${updatesAvailable} update${updatesAvailable > 1 ? 's' : ''} available` : ''}`}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkUpdatesMutation.mutate()}
            disabled={checkUpdatesMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 ${checkUpdatesMutation.isPending ? 'animate-spin' : ''}`} />
            {checkUpdatesMutation.isPending ? 'Checking...' : 'Check Updates'}
          </Button>
        }
      />

      <div className="p-6">
        <Tabs defaultValue="installed">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="overflow-x-auto max-w-full flex-nowrap scrollbar-none">
              <TabsTrigger value="installed">Installed ({pluginsData?.plugins.length || 0})</TabsTrigger>
              <TabsTrigger value="search">Search & Install</TabsTrigger>
              <TabsTrigger value="upload">Upload ZIP</TabsTrigger>
              <TabsTrigger value="health">
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                Health Check
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Installed ── */}
          <TabsContent value="installed" className="mt-0">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Search plugins..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>

            {/* Bulk action toolbar */}
            {selected.size > 0 && (
              <div className="mb-4 flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg flex-wrap">
                <span className="text-sm font-medium text-blue-800 mr-1">{selected.size} selected</span>

                {selectedInactive.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50"
                    onClick={() => bulkActivateMutation.mutate(selectedInactive.map(p => p.file))}
                    disabled={isBulkBusy}
                  >
                    {bulkActivateMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
                    Activate ({selectedInactive.length})
                  </Button>
                )}

                {selectedActive.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-slate-300 text-slate-700 hover:bg-slate-100"
                    onClick={() => bulkDeactivateMutation.mutate(selectedActive.map(p => p.file))}
                    disabled={isBulkBusy}
                  >
                    {bulkDeactivateMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
                    Deactivate ({selectedActive.length})
                  </Button>
                )}

                {selectedWithUpdates.length > 0 && (
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={() => bulkUpdateMutation.mutate(selectedWithUpdates.map(p => p.file))}
                    disabled={isBulkBusy}
                  >
                    {bulkUpdateMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ArrowUpCircle className="w-3 h-3" />}
                    Update ({selectedWithUpdates.length})
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => setBulkDeleteOpen(true)}
                  disabled={isBulkBusy}
                >
                  <Trash2 className="w-3 h-3" />
                  Delete ({selected.size})
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 ml-auto text-slate-400 hover:text-slate-600"
                  onClick={() => setSelected(new Set())}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}

            <div className="space-y-4">
              {activePlugins.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <GroupCheckbox
                      files={activePlugins.map(p => p.file)}
                      selected={selected}
                      onToggle={toggleSelectGroup}
                    />
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active ({activePlugins.length})</h3>
                  </div>
                  <div className="space-y-2">
                    {activePlugins.map(plugin => (
                      <PluginRow
                        key={plugin.file}
                        plugin={plugin}
                        selected={selected.has(plugin.file)}
                        onSelect={toggleSelect}
                        onToggle={() => toggleMutation.mutate({ plugin: plugin.file, active: plugin.active })}
                        onDelete={() => setDeleteTarget(plugin)}
                        onExport={() => exportMutation.mutate(plugin.file)}
                        onUpdate={() => updateMutation.mutate(plugin.file)}
                        onVersions={() => openVersions(plugin)}
                        isTogglingPending={toggleMutation.isPending}
                        isExporting={exportMutation.isPending}
                        isUpdating={updateMutation.isPending && updateMutation.variables === plugin.file}
                      />
                    ))}
                  </div>
                </div>
              )}

              {inactivePlugins.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <GroupCheckbox
                      files={inactivePlugins.map(p => p.file)}
                      selected={selected}
                      onToggle={toggleSelectGroup}
                    />
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Inactive ({inactivePlugins.length})</h3>
                  </div>
                  <div className="space-y-2">
                    {inactivePlugins.map(plugin => (
                      <PluginRow
                        key={plugin.file}
                        plugin={plugin}
                        selected={selected.has(plugin.file)}
                        onSelect={toggleSelect}
                        onToggle={() => toggleMutation.mutate({ plugin: plugin.file, active: plugin.active })}
                        onDelete={() => setDeleteTarget(plugin)}
                        onExport={() => exportMutation.mutate(plugin.file)}
                        onUpdate={() => updateMutation.mutate(plugin.file)}
                        onVersions={() => openVersions(plugin)}
                        isTogglingPending={toggleMutation.isPending}
                        isExporting={exportMutation.isPending}
                        isUpdating={updateMutation.isPending && updateMutation.variables === plugin.file}
                      />
                    ))}
                  </div>
                </div>
              )}

              {filtered.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No plugins found</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Search & Install ── */}
          <TabsContent value="search" className="mt-0">
            <div className="mb-6 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search WordPress.org plugins..."
                  value={wpSearch}
                  onChange={e => setWpSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && setWpSearchQuery(wpSearch)}
                  className="pl-9"
                />
              </div>
              <Button onClick={() => setWpSearchQuery(wpSearch)} disabled={!wpSearch}>
                <Search className="w-4 h-4" /> Search
              </Button>
            </div>

            {isSearching && (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                <span className="ml-2 text-slate-500">Searching WordPress.org...</span>
              </div>
            )}

            {isSearchError && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
                <p className="text-sm font-medium text-slate-700">Search failed</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">{(searchError as Error)?.message || 'Could not reach WordPress.org.'}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setWpSearchQuery(wpSearch)}>
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </Button>
              </div>
            )}

            {wpPlugins && !isSearchError && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {wpPlugins.plugins.map(plugin => {
                  const installed = installedMap.get(plugin.slug)
                  return (
                    <Card key={plugin.slug}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3 mb-3">
                          {plugin.icon ? (
                            <img src={plugin.icon} alt={plugin.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                              <Download className="w-5 h-5 text-slate-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm text-slate-900 truncate">{plugin.name}</h3>
                            <p className="text-xs text-slate-500">by {stripHtml(plugin.author)}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              <span className="text-xs text-slate-500">{(plugin.rating / 20).toFixed(1)}</span>
                              <span className="text-xs text-slate-400">({plugin.num_ratings.toLocaleString()})</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 mb-3 line-clamp-2">{stripHtml(plugin.short_description)}</p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-400">v{plugin.version}</span>
                          {installed ? (
                            installed.has_update ? (
                              <Button
                                size="sm"
                                className="bg-amber-500 hover:bg-amber-600 text-white"
                                onClick={() => updateMutation.mutate(installed.file)}
                                disabled={updateMutation.isPending}
                              >
                                {updateMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ArrowUpCircle className="w-3 h-3" />}
                                Update
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" disabled className="text-green-600 border-green-200 cursor-default">
                                <CheckCircle2 className="w-3 h-3" /> Installed
                              </Button>
                            )
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => installMutation.mutate(plugin.slug)}
                              disabled={installing === plugin.slug || !!installing}
                            >
                              {installing === plugin.slug ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                              Install
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}

            {!wpSearchQuery && !isSearching && (
              <div className="text-center py-12 text-slate-400">
                <Download className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Search for plugins to install from WordPress.org</p>
              </div>
            )}
          </TabsContent>

          {/* ── Upload ZIP ── */}
          <TabsContent value="upload" className="mt-0">
            <div className="max-w-xl mx-auto space-y-5">
              <input
                type="file"
                ref={uploadInputRef}
                className="hidden"
                accept=".zip"
                multiple
                onChange={e => { if (e.target.files) addFilesToQueue(e.target.files); e.target.value = '' }}
              />

              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                onClick={() => uploadInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <Package className="w-10 h-10 mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-medium text-slate-600">Drop plugin ZIPs here or click to browse</p>
                <p className="text-xs text-slate-400 mt-1">Multiple files supported — .zip only</p>
              </div>

              {/* File queue */}
              {uploadQueue.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 flex items-center justify-between border-b border-slate-200">
                    <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      {uploadQueue.length} file{uploadQueue.length > 1 ? 's' : ''} queued
                    </span>
                    <button
                      className="text-xs text-slate-400 hover:text-slate-600"
                      onClick={() => setUploadQueue([])}
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {uploadQueue.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <FileArchive className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 truncate">{item.file.name}</p>
                          <p className="text-xs text-slate-400">{(item.file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <div className="shrink-0">
                          {item.status === 'pending' && (
                            <span className="text-xs text-slate-400">Pending</span>
                          )}
                          {item.status === 'uploading' && (
                            <div className="flex items-center gap-1 text-blue-500">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span className="text-xs">Installing...</span>
                            </div>
                          )}
                          {item.status === 'done' && (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span className="text-xs">Done</span>
                            </div>
                          )}
                          {item.status === 'error' && (
                            <div className="flex items-center gap-1 text-red-500" title={item.message}>
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span className="text-xs">Error</span>
                            </div>
                          )}
                        </div>
                        {item.status === 'pending' && (
                          <button
                            className="text-slate-300 hover:text-red-400 shrink-0"
                            onClick={() => removeFromQueue(i)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Overwrite if exists</p>
                  <p className="text-xs text-slate-400">Replace plugin files if already installed</p>
                </div>
              </label>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={isUploadingAll}
                >
                  <Upload className="w-4 h-4" /> Add Files
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleUploadAll}
                  disabled={uploadQueue.filter(q => q.status === 'pending').length === 0 || isUploadingAll}
                >
                  {isUploadingAll ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {isUploadingAll
                    ? `Installing (${uploadQueue.filter(q => q.status === 'uploading').length + uploadQueue.filter(q => q.status === 'done').length}/${uploadQueue.length})...`
                    : `Install ${uploadQueue.filter(q => q.status === 'pending').length} Plugin${uploadQueue.filter(q => q.status === 'pending').length > 1 ? 's' : ''}`
                  }
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ── Health Check ── */}
          <TabsContent value="health" className="mt-0">
            <HealthCheck />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Single Delete Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" /> Delete Plugin
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.file)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete Plugin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Delete Dialog ── */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" /> Delete {selected.size} Plugin{selected.size > 1 ? 's' : ''}
            </DialogTitle>
            <DialogDescription>
              This will permanently delete the selected {selected.size} plugin{selected.size > 1 ? 's' : ''}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {selectedList.map(p => (
              <div key={p.file} className="flex items-center gap-2 text-sm text-slate-600">
                <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {p.name}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => bulkDeleteMutation.mutate([...selected])}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Version History Dialog ── */}
      <Dialog open={!!versionsPlugin} onOpenChange={() => setVersionsPlugin(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-slate-500" /> {versionsPlugin?.name}
            </DialogTitle>
            <DialogDescription>
              Select a version to install. Installing an older version will downgrade the plugin.
            </DialogDescription>
          </DialogHeader>

          {versionsPlugin && (() => {
            const currentVer = pluginsData?.plugins.find(p => p.file === versionsPlugin.file)?.version
            return currentVer ? (
              <p className="text-xs text-slate-500 -mt-1">Currently installed: <strong>v{currentVer}</strong></p>
            ) : null
          })()}

          {isLoadingVersions && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
              <span className="ml-2 text-sm text-slate-500">Loading versions...</span>
            </div>
          )}

          {versionsData?.versions.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-6">No version history available.</p>
          )}

          {versionsData && versionsData.versions.length > 0 && (
            <ScrollArea className="h-64 rounded border border-slate-100">
              <div className="p-2 space-y-0.5">
                {versionsData.versions.map(version => {
                  const currentVer = pluginsData?.plugins.find(p => p.file === versionsPlugin?.file)?.version
                  const isCurrent = version === currentVer
                  const isInstalling = installVersionMutation.isPending && installVersionMutation.variables?.version === version
                  return (
                    <div key={version} className={`flex items-center justify-between px-3 py-2 rounded-md ${isCurrent ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-50'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-slate-700">v{version}</span>
                        {isCurrent && <Badge variant="secondary" className="text-[10px]">Current</Badge>}
                      </div>
                      <Button
                        size="sm"
                        variant={isCurrent ? 'outline' : 'ghost'}
                        className="h-7 text-xs"
                        disabled={isCurrent || installVersionMutation.isPending}
                        onClick={() => versionsPlugin && installVersionMutation.mutate({ slug: versionsPlugin.slug, version })}
                      >
                        {isInstalling ? <RefreshCw className="w-3 h-3 animate-spin" /> : isCurrent ? 'Installed' : 'Install'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setVersionsPlugin(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Group checkbox (select all in section) ──
function GroupCheckbox({
  files, selected, onToggle
}: {
  files: string[]
  selected: Set<string>
  onToggle: (files: string[]) => void
}) {
  const allSelected = files.length > 0 && files.every(f => selected.has(f))
  const someSelected = files.some(f => selected.has(f))

  return (
    <button
      className="text-slate-400 hover:text-slate-600 transition-colors"
      onClick={() => onToggle(files)}
      title={allSelected ? 'Deselect all' : 'Select all'}
    >
      {allSelected
        ? <CheckSquare className="w-4 h-4 text-blue-500" />
        : someSelected
          ? <Minus className="w-4 h-4 text-blue-400" />
          : <Square className="w-4 h-4" />
      }
    </button>
  )
}

// ── Plugin row ──
function PluginRow({
  plugin, selected, onSelect, onToggle, onDelete, onExport, onUpdate, onVersions,
  isTogglingPending, isExporting, isUpdating,
}: {
  plugin: Plugin
  selected: boolean
  onSelect: (file: string) => void
  onToggle: () => void
  onDelete: () => void
  onExport: () => void
  onUpdate: () => void
  onVersions: () => void
  isTogglingPending: boolean
  isExporting: boolean
  isUpdating: boolean
}) {
  return (
    <div className={`flex items-center gap-3 p-4 rounded-lg border bg-white hover:shadow-sm transition-shadow ${
      selected ? 'border-blue-300 bg-blue-50/40' : plugin.active ? 'border-slate-200' : 'border-slate-100 opacity-70'
    }`}>
      <button
        className="text-slate-400 hover:text-blue-500 transition-colors shrink-0"
        onClick={() => onSelect(plugin.file)}
      >
        {selected
          ? <CheckSquare className="w-4 h-4 text-blue-500" />
          : <Square className="w-4 h-4" />
        }
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="font-medium text-sm text-slate-900">{plugin.name}</h3>
          {plugin.active && <Badge variant="success" className="text-[10px]">Active</Badge>}
          {plugin.has_update && <Badge variant="warning" className="text-[10px]">Update</Badge>}
        </div>
        <p className="text-xs text-slate-500 truncate">{stripHtml(truncate(plugin.description, 120))}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-slate-400">v{plugin.version}</span>
          <span className="text-[10px] text-slate-300">•</span>
          <span className="text-[10px] text-slate-400">{stripHtml(plugin.author)}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {plugin.has_update && (
          <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white h-8" onClick={onUpdate} disabled={isUpdating}>
            {isUpdating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpCircle className="w-3.5 h-3.5" />}
            Update
          </Button>
        )}
        <Button variant={plugin.active ? 'outline' : 'default'} size="sm" className="h-8" onClick={onToggle} disabled={isTogglingPending}>
          <Power className="w-3.5 h-3.5" />
          {plugin.active ? 'Deactivate' : 'Activate'}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={onVersions} title="Version history">
          <History className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-700" onClick={onExport} disabled={isExporting} title="Export as ZIP">
          {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
