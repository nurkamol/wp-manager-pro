import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, History, Clock, Play, RotateCcw, Trash2, Eye, ChevronRight, AlertTriangle, CheckCircle2, XCircle, Loader2, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UpdateItem {
  id: string
  type: 'plugin' | 'theme' | 'core'
  slug: string
  file: string
  name: string
  current: string
  new_version: string
  changelog_url: string
}

interface HistoryEntry {
  id: string
  name: string
  type: string
  slug: string
  from_version: string
  to_version: string
  date: string
  status: 'done' | 'failed' | 'rolled-back'
  error: string | null
  has_backup: boolean
}

interface ScheduledJob {
  id: string
  type: string
  slug: string
  run_at: number
  created_at: string
  status: string
  next_run: number | null
  next_run_human: string
}

type ItemStatus = 'idle' | 'updating' | 'done' | 'failed'

// ── Helpers ───────────────────────────────────────────────────────────────────

function typeBadge(type: string) {
  if (type === 'plugin') return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0">Plugin</Badge>
  if (type === 'theme')  return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-0">Theme</Badge>
  return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-0">Core</Badge>
}

function statusIcon(status: ItemStatus) {
  if (status === 'updating') return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
  if (status === 'done')     return <CheckCircle2 className="w-4 h-4 text-green-500" />
  if (status === 'failed')   return <XCircle className="w-4 h-4 text-red-500" />
  return null
}

function historyStatusBadge(status: string) {
  if (status === 'done')        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0">Done</Badge>
  if (status === 'failed')      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-0">Failed</Badge>
  if (status === 'rolled-back') return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-0">Rolled Back</Badge>
  return <Badge variant="outline">{status}</Badge>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UpdateManager() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('available')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [itemStatuses, setItemStatuses] = useState<Record<string, ItemStatus>>({})
  const [batchRunning, setBatchRunning] = useState(false)
  const [confirmClearHistory, setConfirmClearHistory] = useState(false)
  const [confirmRollback, setConfirmRollback] = useState<HistoryEntry | null>(null)

  // Changelog dialog
  const [changelogItem, setChangelogItem] = useState<UpdateItem | null>(null)
  const [changelogHtml, setChangelogHtml] = useState('')
  const [changelogLoading, setChangelogLoading] = useState(false)

  // Schedule form
  const [scheduleType, setScheduleType] = useState('plugin')
  const [scheduleSlug, setScheduleSlug] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: updatesData, isLoading: updatesLoading, refetch: refetchUpdates } = useQuery({
    queryKey: ['updates-available'],
    queryFn: () => api.get<{ updates: UpdateItem[]; total: number }>('/updates/available'),
  })

  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['updates-history'],
    queryFn: () => api.get<{ history: HistoryEntry[] }>('/updates/history'),
    enabled: tab === 'history',
  })

  const { data: scheduledData, isLoading: scheduledLoading, refetch: refetchScheduled } = useQuery({
    queryKey: ['updates-scheduled'],
    queryFn: () => api.get<{ scheduled: ScheduledJob[] }>('/updates/scheduled'),
    enabled: tab === 'scheduled',
  })

  // ── Mutations ──────────────────────────────────────────────────────────────

  const forceCheckMutation = useMutation({
    mutationFn: () => api.get('/updates/available?force=1'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['updates-available'] })
      toast.success('Update check complete')
    },
    onError: () => toast.error('Update check failed'),
  })

  const runUpdateMutation = useMutation({
    mutationFn: ({ type, slug }: { type: string; slug: string }) =>
      api.post('/updates/run', { type, slug }),
    onSuccess: (_, { type, slug }) => {
      const id = `${type}:${slug === 'wordpress' ? slug : slug}`
      setItemStatuses(prev => ({ ...prev, [id]: 'done' }))
      toast.success('Update complete')
      queryClient.invalidateQueries({ queryKey: ['updates-available'] })
    },
    onError: (err: Error, { type, slug }) => {
      const id = `${type}:${slug}`
      setItemStatuses(prev => ({ ...prev, [id]: 'failed' }))
      toast.error(err.message || 'Update failed')
    },
  })

  const handleUpdateSingle = async (item: UpdateItem) => {
    const idKey = item.type + ':' + (item.type === 'plugin' ? item.file : item.slug)
    setItemStatuses(prev => ({ ...prev, [idKey]: 'updating' }))
    try {
      await api.post('/updates/run', { type: item.type, slug: item.type === 'plugin' ? item.file : item.slug })
      setItemStatuses(prev => ({ ...prev, [idKey]: 'done' }))
      toast.success(`${item.name} updated successfully`)
      queryClient.invalidateQueries({ queryKey: ['updates-available'] })
    } catch (err: any) {
      setItemStatuses(prev => ({ ...prev, [idKey]: 'failed' }))
      toast.error(err?.message || 'Update failed')
    }
  }

  const handleBatchUpdate = async () => {
    const items = (updatesData?.updates ?? []).filter(u => selectedIds.has(u.id))
    if (!items.length) return
    setBatchRunning(true)
    for (const item of items) {
      const idKey = item.type + ':' + (item.type === 'plugin' ? item.file : item.slug)
      setItemStatuses(prev => ({ ...prev, [idKey]: 'updating' }))
      try {
        await api.post('/updates/run', { type: item.type, slug: item.type === 'plugin' ? item.file : item.slug })
        setItemStatuses(prev => ({ ...prev, [idKey]: 'done' }))
      } catch {
        setItemStatuses(prev => ({ ...prev, [idKey]: 'failed' }))
      }
    }
    setBatchRunning(false)
    setSelectedIds(new Set())
    toast.success(`Batch update complete`)
    queryClient.invalidateQueries({ queryKey: ['updates-available'] })
  }

  const openChangelog = async (item: UpdateItem) => {
    setChangelogItem(item)
    setChangelogHtml('')
    setChangelogLoading(true)
    try {
      const res = await api.get<{ changelog: string }>(`/updates/changelog?type=${item.type}&slug=${item.slug}`)
      setChangelogHtml(res.changelog)
    } catch {
      setChangelogHtml('<p>Failed to load changelog.</p>')
    } finally {
      setChangelogLoading(false)
    }
  }

  const rollbackMutation = useMutation({
    mutationFn: (history_id: string) => api.post('/updates/rollback', { history_id }),
    onSuccess: (_, history_id) => {
      toast.success('Rollback complete')
      refetchHistory()
    },
    onError: (err: Error) => toast.error(err.message || 'Rollback failed'),
  })

  const clearHistoryMutation = useMutation({
    mutationFn: () => api.delete('/updates/history/clear'),
    onSuccess: () => {
      toast.success('History cleared')
      queryClient.invalidateQueries({ queryKey: ['updates-history'] })
    },
  })

  const addScheduleMutation = useMutation({
    mutationFn: (body: { type: string; slug: string; run_at: number }) =>
      api.post('/updates/schedule', body),
    onSuccess: () => {
      toast.success('Update scheduled')
      refetchScheduled()
      setScheduleSlug('')
      setScheduleDate('')
    },
    onError: (err: Error) => toast.error(err.message || 'Scheduling failed'),
  })

  const cancelScheduleMutation = useMutation({
    mutationFn: (job_id: string) => api.delete(`/updates/schedule/cancel?job_id=${job_id}`),
    onSuccess: () => {
      toast.success('Scheduled update cancelled')
      refetchScheduled()
    },
  })

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!scheduleSlug || !scheduleDate) { toast.error('Fill in all fields'); return }
    const run_at = Math.floor(new Date(scheduleDate).getTime() / 1000)
    if (run_at <= Math.floor(Date.now() / 1000)) { toast.error('Scheduled time must be in the future'); return }
    addScheduleMutation.mutate({ type: scheduleType, slug: scheduleSlug, run_at })
  }

  const updates = updatesData?.updates ?? []
  const allSelected = updates.length > 0 && selectedIds.size === updates.length
  const someSelected = selectedIds.size > 0 && !allSelected

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(updates.map(u => u.id)))
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Update Manager</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Preview changelogs, schedule updates, and roll back if needed
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { refetchUpdates(); refetchHistory(); refetchScheduled() }}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Alert banner when updates available */}
      {!updatesLoading && updates.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>{updates.length}</strong> update{updates.length !== 1 ? 's' : ''} available</span>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="available" className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Available Updates
            {updates.length > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {updates.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" /> History
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="flex items-center gap-2">
            <Clock className="w-4 h-4" /> Scheduled
          </TabsTrigger>
        </TabsList>

        {/* ── Available Updates ─────────────────────────────────────────────── */}
        <TabsContent value="available" className="mt-4 space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => forceCheckMutation.mutate()}
                disabled={forceCheckMutation.isPending}
              >
                {forceCheckMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Check for Updates
              </Button>
              {selectedIds.size > 0 && (
                <Button
                  size="sm"
                  onClick={handleBatchUpdate}
                  disabled={batchRunning}
                >
                  {batchRunning
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating…</>
                    : <><Play className="w-4 h-4 mr-2" /> Update Selected ({selectedIds.size})</>}
                </Button>
              )}
            </div>
            {updates.length > 0 && (
              <button
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                onClick={toggleAll}
              >
                {allSelected ? 'Deselect all' : someSelected ? 'Select all' : 'Select all'}
              </button>
            )}
          </div>

          {updatesLoading ? (
            <div className="py-16 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-sm">Checking for updates…</p>
            </div>
          ) : updates.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
              <p className="font-medium text-slate-700 dark:text-slate-200">Everything is up to date</p>
              <p className="text-sm text-slate-400">Click "Check for Updates" to force a fresh check</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              {updates.map((item, i) => {
                const idKey = item.type + ':' + (item.type === 'plugin' ? item.file : item.slug)
                const st = itemStatuses[idKey] ?? 'idle'
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 px-4 py-3.5 ${i < updates.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''} ${st === 'done' ? 'bg-green-50/40 dark:bg-green-900/10' : st === 'failed' ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 accent-blue-600"
                      checked={selectedIds.has(item.id)}
                      onChange={e => {
                        const next = new Set(selectedIds)
                        e.target.checked ? next.add(item.id) : next.delete(item.id)
                        setSelectedIds(next)
                      }}
                      disabled={st === 'updating' || st === 'done'}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">{item.name}</span>
                        {typeBadge(item.type)}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
                        <span className="font-mono">{item.current}</span>
                        <ChevronRight className="w-3 h-3" />
                        <span className="font-mono text-green-600 dark:text-green-400 font-semibold">{item.new_version}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {statusIcon(st)}

                      {item.type !== 'core' && (
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => openChangelog(item)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> Changelog
                        </Button>
                      )}

                      {st === 'idle' || st === 'failed' ? (
                        <Button
                          size="sm"
                          className="h-7 px-3 text-xs"
                          onClick={() => handleUpdateSingle(item)}
                          disabled={batchRunning}
                        >
                          <Play className="w-3 h-3 mr-1" /> Update
                        </Button>
                      ) : st === 'updating' ? (
                        <Button size="sm" disabled className="h-7 px-3 text-xs">
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Updating…
                        </Button>
                      ) : (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">Updated ✓</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ── History ──────────────────────────────────────────────────────── */}
        <TabsContent value="history" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Last {historyData?.history?.length ?? 0} updates (max 100)</p>
            {(historyData?.history?.length ?? 0) > 0 && (
              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setConfirmClearHistory(true)}>
                <Trash2 className="w-4 h-4 mr-2" /> Clear History
              </Button>
            )}
          </div>

          {historyLoading ? (
            <div className="py-12 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : !historyData?.history?.length ? (
            <div className="py-16 text-center space-y-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
              <History className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm text-slate-500">No update history yet. Updates run through this page will appear here.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400">Name</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400">Type</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400">Version</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400">Status</th>
                    <th className="text-right px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.history.map((entry, i) => (
                    <tr key={entry.id} className={`${i < historyData.history.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{entry.name}</td>
                      <td className="px-4 py-3">{typeBadge(entry.type)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {entry.from_version} → <span className="text-green-600 dark:text-green-400">{entry.to_version}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{entry.date}</td>
                      <td className="px-4 py-3">
                        {historyStatusBadge(entry.status)}
                        {entry.error && (
                          <p className="text-xs text-red-500 mt-0.5 max-w-xs truncate" title={entry.error}>{entry.error}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {entry.has_backup && entry.status !== 'rolled-back' && (
                          <Button
                            variant="outline" size="sm"
                            className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700 border-amber-200"
                            onClick={() => setConfirmRollback(entry)}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" /> Rollback
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Scheduled ────────────────────────────────────────────────────── */}
        <TabsContent value="scheduled" className="mt-4 space-y-6">
          {/* Schedule form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-5">
            <h3 className="font-medium text-slate-800 dark:text-slate-100 mb-1">Schedule an Update</h3>
            <p className="text-xs text-slate-500 mb-4">Updates run automatically via WP Cron at the scheduled time with a pre-update backup.</p>
            <form onSubmit={handleScheduleSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <Label className="text-xs mb-1 block">Type</Label>
                <Select value={scheduleType} onValueChange={setScheduleType}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plugin">Plugin</SelectItem>
                    <SelectItem value="theme">Theme</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs mb-1 block">Slug / File Path</Label>
                <Input
                  className="h-9 text-sm font-mono"
                  placeholder={scheduleType === 'plugin' ? 'woocommerce/woocommerce.php' : 'twentytwentyfour'}
                  value={scheduleSlug}
                  onChange={e => setScheduleSlug(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Run At</Label>
                <Input
                  type="datetime-local"
                  className="h-9 text-sm"
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                />
              </div>
              <Button type="submit" size="sm" disabled={addScheduleMutation.isPending} className="sm:col-span-4 w-full sm:w-auto">
                {addScheduleMutation.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scheduling…</>
                  : <><Calendar className="w-4 h-4 mr-2" /> Schedule Update</>}
              </Button>
            </form>
          </div>

          {/* Scheduled list */}
          {scheduledLoading ? (
            <div className="py-8 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : !scheduledData?.scheduled?.length ? (
            <div className="py-12 text-center space-y-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
              <Clock className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm text-slate-500">No scheduled updates. Use the form above to queue one.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              {scheduledData.scheduled.map((job, i) => (
                <div
                  key={job.id}
                  className={`flex items-center gap-4 px-4 py-3.5 ${i < scheduledData.scheduled.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}
                >
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-slate-800 dark:text-slate-100">{job.slug}</span>
                      {typeBadge(job.type)}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Runs in {job.next_run_human} — {new Date(job.run_at * 1000).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                    onClick={() => cancelScheduleMutation.mutate(job.id)}
                    disabled={cancelScheduleMutation.isPending}
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Clear history confirm */}
      <Dialog open={confirmClearHistory} onOpenChange={setConfirmClearHistory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear update history?</DialogTitle>
            <DialogDescription>
              This will also delete all backup ZIP files. Rollback will no longer be possible for any previous update.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClearHistory(false)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => { clearHistoryMutation.mutate(); setConfirmClearHistory(false) }}>
              Clear History
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback confirm */}
      <Dialog open={!!confirmRollback} onOpenChange={() => setConfirmRollback(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Roll back {confirmRollback?.name}?</DialogTitle>
            <DialogDescription>
              This will restore <strong>{confirmRollback?.name}</strong> to v{confirmRollback?.from_version} by extracting the pre-update backup. The current v{confirmRollback?.to_version} files will be overwritten.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRollback(null)}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => { if (confirmRollback) { rollbackMutation.mutate(confirmRollback.id); setConfirmRollback(null) } }}
              disabled={rollbackMutation.isPending}
            >
              {rollbackMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Roll Back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Changelog dialog */}
      <Dialog open={!!changelogItem} onOpenChange={() => setChangelogItem(null)}>
        <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Changelog — {changelogItem?.name}
              {changelogItem && (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  {changelogItem.current} → {changelogItem.new_version}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {changelogLoading ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading changelog…</p>
            </div>
          ) : (
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300"
              dangerouslySetInnerHTML={{ __html: changelogHtml }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
