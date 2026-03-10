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
