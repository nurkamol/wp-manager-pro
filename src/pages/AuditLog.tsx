import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, getConfig } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Activity, Download, Trash2, RefreshCw, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface AuditLog {
  id: number
  user_id: number
  user_name: string
  action: string
  object_type: string
  object_name: string
  extra: string | null
  ip_address: string
  created_at: string
}

interface LogsResponse {
  logs: AuditLog[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

const ACTION_COLORS: Record<string, string> = {
  'plugin.activated':   'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  'plugin.deactivated': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  'plugin.deleted':     'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  'theme.activated':    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  'user.login':         'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300',
  'user.logout':        'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-400',
  'user.login_failed':  'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  'user.registered':    'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  'content.published':  'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  'backup.created':     'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  'backup.deleted':     'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

function actionBadgeClass(action: string) {
  return ACTION_COLORS[action] || 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300'
}

function actionLabel(action: string) {
  return action.replace('.', ': ').replace(/_/g, ' ')
}

export function AuditLog() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('all')
  const [showClear, setShowClear] = useState(false)

  const params = new URLSearchParams({ page: String(page), per_page: '50' })
  if (actionFilter && actionFilter !== 'all') params.set('action_type', actionFilter)

  const { data, isLoading, refetch } = useQuery<LogsResponse>({
    queryKey: ['audit-log', page, actionFilter],
    queryFn: () => api.get(`/audit?${params}`),
  })

  const { data: actionTypes } = useQuery<{ types: string[] }>({
    queryKey: ['audit-action-types'],
    queryFn: () => api.get('/audit/action-types'),
    staleTime: 60000,
  })

  const clearMutation = useMutation({
    mutationFn: () => api.delete('/audit/clear'),
    onSuccess: () => {
      toast.success('Audit log cleared')
      setShowClear(false)
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      queryClient.invalidateQueries({ queryKey: ['audit-action-types'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const exportMutation = useMutation({
    mutationFn: () => api.post<{ download_url: string }>('/audit/export', {}),
    onSuccess: (data) => {
      const link = document.createElement('a')
      link.href = data.download_url
      link.click()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) return <PageLoader text="Loading audit log..." />

  return (
    <div className="fade-in">
      <PageHeader
        title="Audit Log"
        description="Track all admin actions and WordPress events"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
            >
              {exportMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export CSV
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowClear(true)}
            >
              <Trash2 className="w-4 h-4" />
              Clear Log
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1) }}>
            <SelectTrigger className="w-56 h-8 text-sm">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actionTypes?.types.map(t => (
                <SelectItem key={t} value={t}>{actionLabel(t)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data && (
            <span className="text-sm text-slate-500">{data.total} events</span>
          )}
        </div>

        {/* Table */}
        {!data?.logs.length ? (
          <div className="text-center py-16 text-slate-400">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium text-slate-500 mb-1">No events logged yet</h3>
            <p className="text-sm">Events will appear here as actions are performed on your site.</p>
          </div>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300 w-40">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300 w-28">User</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300 w-40">Action</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Object</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300 w-32">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{log.user_name}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${actionBadgeClass(log.action)}`}>
                          {actionLabel(log.action)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                        <span className="font-medium">{log.object_name}</span>
                        {log.object_type && log.object_type !== log.object_name && (
                          <span className="text-slate-400 text-xs ml-1">({log.object_type})</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 dark:text-slate-500 text-xs font-mono">
                        {log.ip_address || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.total_pages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Page {data.page} of {data.total_pages} ({data.total} total)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
                    disabled={page === data.total_pages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Clear Confirm */}
      <Dialog open={showClear} onOpenChange={setShowClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Audit Log</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Are you sure you want to permanently delete all audit log entries? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClear(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
            >
              {clearMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Clear All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
