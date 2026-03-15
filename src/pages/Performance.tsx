import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Gauge, Trash2, Timer, FileText, MessageSquare, Database, Zap,
  RefreshCw, Search, ChevronLeft, ChevronRight, CheckSquare, Square,
  ServerCrash, CheckCircle2, AlertTriangle, Clock,
  Server, Wifi, WifiOff, FlipVertical, Activity, MemoryStick,
  KeyRound, ArrowDownUp, TrendingUp, Users, Hash,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────
interface OverviewData {
  revisions: number
  revision_size_kb: number
  auto_drafts: number
  trash: number
  spam_comments: number
  pending_comments: number
  orphaned_postmeta: number
  orphaned_commentmeta: number
  all_transients: number
  expired_transients: number
  object_cache_enabled: boolean
  object_cache_type: string
}

interface Transient {
  name: string
  size_bytes: number
  expires_at: number | null
  expired: boolean
}

interface TransientsData {
  items: Transient[]
  total: number
  page: number
  limit: number
}

interface ObjectCacheStats {
  hits?: number
  misses?: number
  hit_ratio?: number | null
  keys_count?: number
  memory_used?: string | null
  memory_peak?: string | null
  uptime_seconds?: number
  connected_clients?: number
  evicted_keys?: number
  expired_keys?: number
  ops_per_sec?: number
  redis_version?: string | null
  version?: string | null
  maxmemory_policy?: string | null
  error?: string
}

interface ObjectCacheData {
  enabled: boolean
  drop_in_exists: boolean
  drop_in_writable: boolean
  disabled_exists: boolean
  content_writable: boolean
  cache_type: 'redis' | 'memcached' | 'apcu' | 'custom' | 'none'
  status: 'connected' | 'error' | 'not_configured' | 'extension_missing'
  connection: Record<string, string | number>
  stats: ObjectCacheStats
  wp_stats: { cache_hits?: number | null; cache_misses?: number | null; groups?: string[] }
  diagnostics: Record<string, string>
}

// ── Cleanup item definitions ───────────────────────────────────────────────────
const CLEANUP_ITEMS = [
  {
    key: 'revisions',
    label: 'Post Revisions',
    description: 'Old draft revisions saved automatically by WordPress',
    icon: FileText,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    key: 'auto_drafts',
    label: 'Auto-Drafts',
    description: 'Unsaved auto-draft posts created by the editor',
    icon: FileText,
    color: 'text-slate-400',
    bg: 'bg-slate-400/10',
  },
  {
    key: 'trash',
    label: 'Trashed Content',
    description: 'Posts and pages sitting in the trash',
    icon: Trash2,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
  },
  {
    key: 'spam_comments',
    label: 'Spam Comments',
    description: 'Comments marked as spam',
    icon: MessageSquare,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
  },
  {
    key: 'pending_comments',
    label: 'Pending Comments',
    description: 'Unapproved comments awaiting moderation',
    icon: MessageSquare,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
  },
  {
    key: 'orphaned_postmeta',
    label: 'Orphaned Post Meta',
    description: 'Post meta rows whose parent post no longer exists',
    icon: Database,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
  {
    key: 'orphaned_commentmeta',
    label: 'Orphaned Comment Meta',
    description: 'Comment meta rows whose parent comment no longer exists',
    icon: Database,
    color: 'text-pink-500',
    bg: 'bg-pink-500/10',
  },
  {
    key: 'expired_transients',
    label: 'Expired Transients',
    description: 'Cached data entries that have already expired',
    icon: Timer,
    color: 'text-green-500',
    bg: 'bg-green-500/10',
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatExpiry(ts: number | null): string {
  if (!ts) return '—'
  const d = new Date(ts * 1000)
  return d.toLocaleString()
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color, bg, warn,
}: {
  label: string; value: number | string; sub?: string
  icon: React.ElementType; color: string; bg: string; warn?: boolean
}) {
  return (
    <Card className={cn(warn && value !== 0 && 'border-amber-500/30')}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={cn('text-2xl font-bold', warn && value !== 0 ? 'text-amber-500' : '')}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn('p-2.5 rounded-lg shrink-0', bg)}>
            <Icon className={cn('w-5 h-5', color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function Performance() {
  const queryClient = useQueryClient()

  // ── Overview ──────────────────────────────────────────────────────────────────
  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useQuery<OverviewData>({
    queryKey: ['performance-overview'],
    queryFn: () => api.get('/performance/overview'),
  })

  // ── Transients ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const limit = 50

  const { data: transientsData, isLoading: transientsLoading, refetch: refetchTransients } =
    useQuery<TransientsData>({
      queryKey: ['performance-transients', search, page],
      queryFn: () => api.get(`/performance/transients?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`),
    })

  const deleteTransientMutation = useMutation({
    mutationFn: (name: string) => api.delete(`/performance/transients?name=${encodeURIComponent(name)}`),
    onSuccess: (_, name) => {
      toast.success(`Transient "${name}" deleted`)
      refetchTransients()
      refetchOverview()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const purgeExpiredMutation = useMutation<{ deleted: number }, Error, void>({
    mutationFn: () => api.post('/performance/transients/purge-expired', {}),
    onSuccess: (res) => {
      toast.success(`${res.deleted} expired transient(s) purged`)
      refetchTransients()
      refetchOverview()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ── DB Cleanup ────────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<string[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)

  const cleanupMutation = useMutation<{ results: Record<string, number> }, Error, string[]>({
    mutationFn: (types: string[]) => api.post('/performance/cleanup', { types }),
    onSuccess: (res) => {
      const total = Object.values(res.results).reduce((a, b) => a + b, 0)
      toast.success(`Cleanup complete — ${total.toLocaleString()} item(s) removed`)
      setSelected([])
      setConfirmOpen(false)
      refetchOverview()
    },
    onError: (e: Error) => {
      toast.error(e.message)
      setConfirmOpen(false)
    },
  })

  const toggleSelect = (key: string) =>
    setSelected(s => s.includes(key) ? s.filter(k => k !== key) : [...s, key])

  const selectAll = () => setSelected(CLEANUP_ITEMS.map(i => i.key))
  const clearAll  = () => setSelected([])

  const getCount = (key: string): number => {
    if (!overview) return 0
    return (overview as unknown as Record<string, number>)[key] ?? 0
  }

  const totalSelected = selected.reduce((sum, key) => sum + getCount(key), 0)

  // ── Object Cache ──────────────────────────────────────────────────────────────
  const { data: cacheData, isLoading: cacheLoading, refetch: refetchCache } =
    useQuery<ObjectCacheData>({
      queryKey: ['object-cache'],
      queryFn: () => api.get('/performance/object-cache'),
    })

  const flushCacheMutation = useMutation<{ success: boolean; message: string }, Error, void>({
    mutationFn: () => api.post('/performance/object-cache/flush', {}),
    onSuccess: (res) => {
      toast[res.success ? 'success' : 'warning'](res.message)
      refetchCache()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const dropInMutation = useMutation<{ success: boolean; message: string }, Error, 'enable' | 'disable'>({
    mutationFn: (action) => api.post('/performance/object-cache/drop-in', { action }),
    onSuccess: (res) => {
      toast[res.success ? 'success' : 'error'](res.message)
      refetchCache()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ── Search submit ──────────────────────────────────────────────────────────────
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  if (overviewLoading) return <PageLoader text="Analysing database…" />

  const totalPages = transientsData ? Math.ceil(transientsData.total / limit) : 1

  return (
    <div className="fade-in">
      <PageHeader
        title="Performance"
        description="Database cleanup, transient management, and object cache status"
        actions={
          <Button variant="outline" size="sm" onClick={() => { refetchOverview(); refetchTransients() }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Object Cache Status banner */}
        <Card className={cn(
          'border',
          overview?.object_cache_enabled ? 'border-green-500/30 bg-green-500/5' : 'border-slate-700/50'
        )}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              {overview?.object_cache_enabled
                ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                : <ServerCrash className="w-5 h-5 text-slate-400 shrink-0" />}
              <div>
                <p className="text-sm font-medium">
                  Object Cache:{' '}
                  <span className={overview?.object_cache_enabled ? 'text-green-500' : 'text-slate-400'}>
                    {overview?.object_cache_enabled
                      ? `Enabled (${overview.object_cache_type})`
                      : 'Not active — WordPress is using the database as its cache store'}
                  </span>
                </p>
                {!overview?.object_cache_enabled && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Consider installing Redis or Memcached for significant performance gains.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview">
          <TabsList className="mb-6">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="transients" className="flex items-center gap-2">
              <Timer className="w-4 h-4" />
              Transients
              {overview && overview.expired_transients > 0 && (
                <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[10px]">
                  {overview.expired_transients}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="cleanup" className="flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              DB Cleanup
            </TabsTrigger>
            <TabsTrigger value="object-cache" className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              Object Cache
              {cacheData?.status === 'connected' && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 ml-0.5" />
              )}
              {(cacheData?.status === 'error' || cacheData?.status === 'extension_missing') && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 ml-0.5" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Overview Tab ───────────────────────────────────────────────────── */}
          <TabsContent value="overview">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Post Revisions"
                value={overview?.revisions ?? 0}
                sub={overview?.revision_size_kb ? `~${overview.revision_size_kb.toLocaleString()} KB` : undefined}
                icon={FileText}
                color="text-blue-500"
                bg="bg-blue-500/10"
                warn
              />
              <StatCard
                label="Auto-Drafts"
                value={overview?.auto_drafts ?? 0}
                icon={FileText}
                color="text-slate-400"
                bg="bg-slate-400/10"
                warn
              />
              <StatCard
                label="Trashed Content"
                value={overview?.trash ?? 0}
                icon={Trash2}
                color="text-orange-500"
                bg="bg-orange-500/10"
                warn
              />
              <StatCard
                label="Spam Comments"
                value={overview?.spam_comments ?? 0}
                icon={MessageSquare}
                color="text-red-500"
                bg="bg-red-500/10"
                warn
              />
              <StatCard
                label="Pending Comments"
                value={overview?.pending_comments ?? 0}
                icon={MessageSquare}
                color="text-yellow-500"
                bg="bg-yellow-500/10"
              />
              <StatCard
                label="Orphaned Post Meta"
                value={overview?.orphaned_postmeta ?? 0}
                icon={Database}
                color="text-purple-500"
                bg="bg-purple-500/10"
                warn
              />
              <StatCard
                label="Orphaned Comment Meta"
                value={overview?.orphaned_commentmeta ?? 0}
                icon={Database}
                color="text-pink-500"
                bg="bg-pink-500/10"
                warn
              />
              <StatCard
                label="Expired Transients"
                value={overview?.expired_transients ?? 0}
                sub={`${overview?.all_transients ?? 0} total`}
                icon={Timer}
                color="text-green-500"
                bg="bg-green-500/10"
                warn
              />
            </div>

            {/* Quick cleanup button */}
            {overview && (
              overview.revisions + overview.auto_drafts + overview.trash +
              overview.spam_comments + overview.orphaned_postmeta +
              overview.orphaned_commentmeta + overview.expired_transients > 0
            ) && (
              <Card className="mt-6 border-amber-500/30 bg-amber-500/5">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      <p className="text-sm text-amber-600 dark:text-amber-400">
                        Your database has cleanable items. Go to the{' '}
                        <strong>DB Cleanup</strong> tab to remove them and reclaim space.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Transients Tab ─────────────────────────────────────────────────── */}
          <TabsContent value="transients">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-base">Transient Cache</CardTitle>
                    <CardDescription>
                      {overview?.all_transients ?? 0} transients stored •{' '}
                      {overview?.expired_transients ?? 0} expired
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => purgeExpiredMutation.mutate()}
                    disabled={purgeExpiredMutation.isPending || (overview?.expired_transients ?? 0) === 0}
                  >
                    {purgeExpiredMutation.isPending
                      ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      : <Zap className="w-4 h-4 mr-2" />}
                    Purge Expired ({overview?.expired_transients ?? 0})
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search */}
                <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search transient names…"
                      className="pl-8"
                      value={searchInput}
                      onChange={e => setSearchInput(e.target.value)}
                    />
                  </div>
                  <Button type="submit" variant="outline" size="sm">Search</Button>
                  {search && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }}
                    >
                      Clear
                    </Button>
                  )}
                </form>

                {transientsLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    Loading…
                  </div>
                ) : !transientsData?.items.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Timer className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No transients found</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-md border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground w-20">Size</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground w-44">Expires</th>
                            <th className="w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {transientsData.items.map(t => (
                            <tr key={t.name} className={cn('hover:bg-muted/30', t.expired && 'bg-red-500/5')}>
                              <td className="px-3 py-2 font-mono text-xs max-w-xs">
                                <div className="flex items-center gap-2">
                                  <span className="truncate">{t.name}</span>
                                  {t.expired && (
                                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                                      expired
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right text-muted-foreground font-mono text-xs">
                                {formatBytes(t.size_bytes)}
                              </td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">
                                {t.expires_at ? (
                                  <span className={t.expired ? 'text-red-500' : ''}>
                                    <Clock className="w-3 h-3 inline mr-1" />
                                    {formatExpiry(t.expires_at)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">Persistent</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                                  onClick={() => deleteTransientMutation.mutate(t.name)}
                                  disabled={deleteTransientMutation.isPending}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <p className="text-xs text-muted-foreground">
                          {transientsData.total.toLocaleString()} total •{' '}
                          page {page} of {totalPages}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── DB Cleanup Tab ─────────────────────────────────────────────────── */}
          <TabsContent value="cleanup">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-base">Database Cleanup</CardTitle>
                    <CardDescription>
                      Select items to permanently delete and reclaim database space
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={selectAll}>
                      <CheckSquare className="w-4 h-4 mr-1.5" />
                      All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearAll} disabled={selected.length === 0}>
                      <Square className="w-4 h-4 mr-1.5" />
                      None
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {CLEANUP_ITEMS.map(item => {
                  const count  = getCount(item.key)
                  const active = selected.includes(item.key)
                  return (
                    <div
                      key={item.key}
                      onClick={() => toggleSelect(item.key)}
                      className={cn(
                        'flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-colors select-none',
                        active
                          ? 'border-blue-500/50 bg-blue-500/5'
                          : 'border-transparent hover:border-border hover:bg-muted/40'
                      )}
                    >
                      <div className={cn('p-2 rounded-lg shrink-0', item.bg)}>
                        <item.icon className={cn('w-4 h-4', item.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={cn(
                          'text-sm font-bold min-w-[2rem] text-right',
                          count > 0 ? 'text-amber-500' : 'text-muted-foreground'
                        )}>
                          {count.toLocaleString()}
                        </span>
                        <div className={cn(
                          'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                          active ? 'bg-blue-600 border-blue-600' : 'border-border'
                        )}>
                          {active && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </div>
                    </div>
                  )
                })}

                <div className="pt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {selected.length > 0
                      ? `${selected.length} type(s) selected — ${totalSelected.toLocaleString()} item(s) will be deleted`
                      : 'Select items above to clean up'}
                  </p>
                  <Button
                    variant="destructive"
                    disabled={selected.length === 0 || cleanupMutation.isPending}
                    onClick={() => setConfirmOpen(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Run Cleanup
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          {/* ── Object Cache Tab ────────────────────────────────────────────── */}
          <TabsContent value="object-cache">
            {cacheLoading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />Loading…
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status card */}
                <Card className={cn(
                  'border',
                  cacheData?.status === 'connected'          && 'border-green-500/30 bg-green-500/5',
                  cacheData?.status === 'error'              && 'border-red-500/30 bg-red-500/5',
                  cacheData?.status === 'extension_missing'  && 'border-amber-500/30 bg-amber-500/5',
                  cacheData?.status === 'not_configured'     && 'border-slate-700/50',
                )}>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        {cacheData?.status === 'connected'
                          ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                          : cacheData?.status === 'error' || cacheData?.status === 'extension_missing'
                          ? <WifiOff className="w-5 h-5 text-red-500 shrink-0" />
                          : <ServerCrash className="w-5 h-5 text-slate-400 shrink-0" />}
                        <div>
                          <p className="text-sm font-semibold">
                            {cacheData?.cache_type === 'none' ? 'No Object Cache' : (
                              <>
                                {cacheData?.cache_type?.toUpperCase() ?? 'Object Cache'}{' '}
                                <span className={cn(
                                  'font-normal',
                                  cacheData?.status === 'connected'        ? 'text-green-500'  :
                                  cacheData?.status === 'error'            ? 'text-red-500'    :
                                  cacheData?.status === 'extension_missing'? 'text-amber-500'  :
                                  'text-slate-400'
                                )}>
                                  {cacheData?.status === 'connected'         ? 'Connected'          :
                                   cacheData?.status === 'error'             ? 'Connection Error'   :
                                   cacheData?.status === 'extension_missing' ? 'Extension Missing'  :
                                   'Not Configured'}
                                </span>
                              </>
                            )}
                          </p>
                          {cacheData?.diagnostics?.error && (
                            <p className="text-xs text-red-400 mt-0.5 font-mono">{cacheData.diagnostics.error}</p>
                          )}
                          {cacheData?.status === 'not_configured' && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              No object-cache.php drop-in detected. Install Redis or Memcached for significant performance gains.
                            </p>
                          )}
                          {cacheData?.drop_in_exists && Object.keys(cacheData.connection ?? {}).length > 0 && (
                            <div className="flex flex-wrap gap-3 mt-2">
                              {Object.entries(cacheData.connection).map(([k, v]) => v !== '' && v !== null && (
                                <span key={k} className="text-xs text-muted-foreground font-mono">
                                  <span className="text-foreground/60">{k}:</span> {String(v)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => refetchCache()}
                          disabled={cacheLoading}
                        >
                          <RefreshCw className="w-4 h-4 mr-1.5" />
                          Refresh
                        </Button>
                        {cacheData?.enabled && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => flushCacheMutation.mutate()}
                            disabled={flushCacheMutation.isPending}
                          >
                            {flushCacheMutation.isPending
                              ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                              : <Zap className="w-4 h-4 mr-1.5" />}
                            Flush Cache
                          </Button>
                        )}
                        {/* Drop-in toggle */}
                        {cacheData?.drop_in_exists && (cacheData.drop_in_writable || cacheData.content_writable) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-amber-600 border-amber-500/40 hover:bg-amber-500/10"
                            onClick={() => dropInMutation.mutate('disable')}
                            disabled={dropInMutation.isPending}
                          >
                            <FlipVertical className="w-4 h-4 mr-1.5" />
                            Disable Drop-in
                          </Button>
                        )}
                        {!cacheData?.drop_in_exists && cacheData?.disabled_exists && cacheData?.content_writable && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 border-green-500/40 hover:bg-green-500/10"
                            onClick={() => dropInMutation.mutate('enable')}
                            disabled={dropInMutation.isPending}
                          >
                            <Wifi className="w-4 h-4 mr-1.5" />
                            Re-enable Drop-in
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Live Stats grid */}
                {cacheData?.status === 'connected' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {cacheData.stats.hit_ratio != null && (
                      <Card>
                        <CardContent className="pt-4 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Hit Ratio</p>
                              <p className={cn(
                                'text-2xl font-bold',
                                (cacheData.stats.hit_ratio ?? 0) >= 80 ? 'text-green-500' :
                                (cacheData.stats.hit_ratio ?? 0) >= 50 ? 'text-amber-500' : 'text-red-500'
                              )}>
                                {cacheData.stats.hit_ratio}%
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {(cacheData.stats.hits ?? 0).toLocaleString()} hits / {(cacheData.stats.misses ?? 0).toLocaleString()} misses
                              </p>
                            </div>
                            <div className="p-2 rounded-lg bg-green-500/10 shrink-0">
                              <TrendingUp className="w-4 h-4 text-green-500" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {cacheData.stats.keys_count != null && (
                      <Card>
                        <CardContent className="pt-4 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Cached Keys</p>
                              <p className="text-2xl font-bold">{cacheData.stats.keys_count.toLocaleString()}</p>
                              {cacheData.stats.evicted_keys != null && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">{cacheData.stats.evicted_keys.toLocaleString()} evicted</p>
                              )}
                            </div>
                            <div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
                              <Hash className="w-4 h-4 text-blue-500" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {cacheData.stats.memory_used && (
                      <Card>
                        <CardContent className="pt-4 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Memory Used</p>
                              <p className="text-2xl font-bold">{cacheData.stats.memory_used}</p>
                              {cacheData.stats.memory_peak && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">peak {cacheData.stats.memory_peak}</p>
                              )}
                            </div>
                            <div className="p-2 rounded-lg bg-purple-500/10 shrink-0">
                              <MemoryStick className="w-4 h-4 text-purple-500" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {cacheData.stats.connected_clients != null && (
                      <Card>
                        <CardContent className="pt-4 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Connections</p>
                              <p className="text-2xl font-bold">{cacheData.stats.connected_clients}</p>
                              {cacheData.stats.ops_per_sec != null && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">{cacheData.stats.ops_per_sec} ops/sec</p>
                              )}
                            </div>
                            <div className="p-2 rounded-lg bg-cyan-500/10 shrink-0">
                              <Users className="w-4 h-4 text-cyan-500" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {(cacheData.stats.redis_version ?? cacheData.stats.version) && (
                      <Card>
                        <CardContent className="pt-4 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                {cacheData.cache_type === 'redis' ? 'Redis' :
                                 cacheData.cache_type === 'memcached' ? 'Memcached' : 'APCu'} Version
                              </p>
                              <p className="text-xl font-bold">{cacheData.stats.redis_version ?? cacheData.stats.version}</p>
                              {cacheData.stats.maxmemory_policy && (
                                <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{cacheData.stats.maxmemory_policy}</p>
                              )}
                            </div>
                            <div className="p-2 rounded-lg bg-orange-500/10 shrink-0">
                              <Server className="w-4 h-4 text-orange-500" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {cacheData.stats.uptime_seconds != null && cacheData.stats.uptime_seconds > 0 && (
                      <Card>
                        <CardContent className="pt-4 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Uptime</p>
                              <p className="text-xl font-bold">
                                {cacheData.stats.uptime_seconds < 3600
                                  ? `${Math.floor(cacheData.stats.uptime_seconds / 60)}m`
                                  : cacheData.stats.uptime_seconds < 86400
                                  ? `${Math.floor(cacheData.stats.uptime_seconds / 3600)}h`
                                  : `${Math.floor(cacheData.stats.uptime_seconds / 86400)}d`}
                              </p>
                            </div>
                            <div className="p-2 rounded-lg bg-slate-500/10 shrink-0">
                              <Activity className="w-4 h-4 text-slate-400" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {cacheData.stats.expired_keys != null && (
                      <Card>
                        <CardContent className="pt-4 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Expired Keys</p>
                              <p className="text-2xl font-bold">{cacheData.stats.expired_keys.toLocaleString()}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-yellow-500/10 shrink-0">
                              <Clock className="w-4 h-4 text-yellow-500" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* WordPress request-level cache stats */}
                {(cacheData?.wp_stats?.cache_hits != null || cacheData?.wp_stats?.cache_misses != null) && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">This Request — WP Object Cache</CardTitle>
                      <CardDescription className="text-xs">Cache hits/misses for the current page load (from $wp_object_cache)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-6">
                        {cacheData.wp_stats.cache_hits != null && (
                          <div>
                            <p className="text-xs text-muted-foreground">Hits</p>
                            <p className="text-xl font-bold text-green-500">{cacheData.wp_stats.cache_hits.toLocaleString()}</p>
                          </div>
                        )}
                        {cacheData.wp_stats.cache_misses != null && (
                          <div>
                            <p className="text-xs text-muted-foreground">Misses</p>
                            <p className="text-xl font-bold text-amber-500">{cacheData.wp_stats.cache_misses.toLocaleString()}</p>
                          </div>
                        )}
                        {cacheData.wp_stats.groups && cacheData.wp_stats.groups.length > 0 && (
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-1">Cache Groups ({cacheData.wp_stats.groups.length})</p>
                            <div className="flex flex-wrap gap-1">
                              {cacheData.wp_stats.groups.slice(0, 20).map(g => (
                                <span key={g} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{g}</span>
                              ))}
                              {cacheData.wp_stats.groups.length > 20 && (
                                <span className="text-[10px] text-muted-foreground px-1">+{cacheData.wp_stats.groups.length - 20} more</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Drop-in info */}
                <Card className="border-slate-700/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Object Cache Drop-in</CardTitle>
                    <CardDescription className="text-xs">
                      wp-content/object-cache.php — WordPress uses this file to replace the built-in cache backend
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        {cacheData?.drop_in_exists
                          ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                          : <ServerCrash className="w-4 h-4 text-slate-400" />}
                        <span className={cacheData?.drop_in_exists ? 'text-green-500' : 'text-muted-foreground'}>
                          {cacheData?.drop_in_exists ? 'Drop-in active' : 'No drop-in installed'}
                        </span>
                      </div>
                      {cacheData?.disabled_exists && (
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          <span className="text-amber-500">Disabled drop-in exists (object-cache.php.disabled)</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {cacheData?.drop_in_writable || cacheData?.content_writable
                          ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                          : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                        <span className="text-muted-foreground">
                          {cacheData?.drop_in_writable || cacheData?.content_writable ? 'Filesystem writable' : 'Not writable — file operations unavailable'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

        </Tabs>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Cleanup</DialogTitle>
            <DialogDescription>
              This will permanently delete the following items. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <ul className="text-sm space-y-1 my-2">
            {selected.map(key => {
              const item  = CLEANUP_ITEMS.find(i => i.key === key)!
              const count = getCount(key)
              return (
                <li key={key} className="flex justify-between">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium">{count.toLocaleString()} item(s)</span>
                </li>
              )
            })}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => cleanupMutation.mutate(selected)}
              disabled={cleanupMutation.isPending}
            >
              {cleanupMutation.isPending
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Cleaning…</>
                : 'Yes, delete all'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
