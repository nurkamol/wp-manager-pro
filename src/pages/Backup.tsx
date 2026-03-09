import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { HardDrive, Plus, Download, Trash2, RefreshCw, Database } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Backup {
  name: string
  size: number
  size_human: string
  created_at: string
}

export function Backup() {
  const queryClient = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<Backup | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const { data, isLoading, refetch } = useQuery<{ backups: Backup[] }>({
    queryKey: ['backups'],
    queryFn: () => api.get('/backup'),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post<Backup>('/backup/create', {}),
    onSuccess: (data) => {
      toast.success(`Backup created: ${data.name} (${data.size_human})`)
      setIsCreating(false)
      queryClient.invalidateQueries({ queryKey: ['backups'] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
      setIsCreating(false)
    },
  })

  const downloadMutation = useMutation({
    mutationFn: (name: string) => api.post<{ download_url: string }>('/backup/download', { name }),
    onSuccess: (data) => {
      const link = document.createElement('a')
      link.href = data.download_url
      link.click()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.delete('/backup/delete', { name }),
    onSuccess: () => {
      toast.success('Backup deleted')
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['backups'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCreate = () => {
    setIsCreating(true)
    createMutation.mutate()
  }

  if (isLoading) return <PageLoader text="Loading backups..." />

  return (
    <div className="fade-in">
      <PageHeader
        title="Database Backup"
        description="Create and manage SQL database backups"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {createMutation.isPending ? 'Creating backup...' : 'Create Backup'}
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* Info card */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg text-sm text-blue-800 dark:text-blue-300">
          <Database className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium mb-0.5">Full Database Backup</p>
            <p className="text-blue-700 dark:text-blue-400 text-xs">
              Creates a complete SQL dump of all database tables stored in <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 rounded">wp-content/wmp-backups/</code>.
              The directory is protected from direct web access. Download and keep a copy offsite.
            </p>
          </div>
        </div>

        {isCreating && !createMutation.isPending && null}

        {!data?.backups.length ? (
          <div className="text-center py-16 text-slate-400">
            <HardDrive className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium text-slate-500 mb-1">No backups yet</h3>
            <p className="text-sm mb-4">Create your first database backup to get started</p>
            <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {createMutation.isPending ? 'Creating...' : 'Create Backup'}
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Filename</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300 w-32">Size</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300 w-40">Created</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-300 w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.backups.map(backup => (
                  <tr key={backup.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{backup.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                      {backup.size_human}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                      {formatDate(backup.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => downloadMutation.mutate(backup.name)}
                          disabled={downloadMutation.isPending}
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded transition-colors"
                          title="Download"
                        >
                          {downloadMutation.isPending ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(backup)}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Backup</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Permanently delete <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">{deleteTarget?.name}</code>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.name)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
