import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, getConfig } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Trash2, Edit2, ArrowRight, RefreshCw, X, Save, Download, Upload, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Redirect {
  id: number
  source: string
  target: string
  type: number
  hits: number
  created_at: string
  updated_at: string
}

interface RedirectsResponse {
  redirects: Redirect[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

const emptyForm = { source: '', target: '', type: '301' }

export function Redirects() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editRedirect, setEditRedirect] = useState<Redirect | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Redirect | null>(null)
  const [form, setForm] = useState(emptyForm)
  const importRef = useRef<HTMLInputElement>(null)

  const params = new URLSearchParams({ page: String(page), per_page: '50' })
  if (search) params.set('search', search)

  const { data, isLoading } = useQuery<RedirectsResponse>({
    queryKey: ['redirects', page, search],
    queryFn: () => api.get(`/redirects?${params}`),
  })

  const createMutation = useMutation({
    mutationFn: (d: typeof emptyForm) => api.post('/redirects', { ...d, type: parseInt(d.type) }),
    onSuccess: () => {
      toast.success('Redirect created')
      queryClient.invalidateQueries({ queryKey: ['redirects'] })
      setShowForm(false)
      setForm(emptyForm)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...d }: { id: number } & typeof emptyForm) =>
      api.put(`/redirects/${id}`, { ...d, type: parseInt(d.type) }),
    onSuccess: () => {
      toast.success('Redirect updated')
      queryClient.invalidateQueries({ queryKey: ['redirects'] })
      setEditRedirect(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/redirects/${id}`),
    onSuccess: () => {
      toast.success('Redirect deleted')
      queryClient.invalidateQueries({ queryKey: ['redirects'] })
      setDeleteTarget(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const exportMutation = useMutation({
    mutationFn: () => api.post<{ download_url: string }>('/redirects/export', {}),
    onSuccess: (data) => {
      const link = document.createElement('a')
      link.href = data.download_url
      link.click()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const importMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return api.upload<{ imported: number }>('/redirects/import', fd)
    },
    onSuccess: (data) => {
      toast.success(`Imported ${data.imported} redirects`)
      queryClient.invalidateQueries({ queryKey: ['redirects'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const openEdit = (r: Redirect) => {
    setEditRedirect(r)
    setForm({ source: r.source, target: r.target, type: String(r.type) })
  }

  const openCreate = () => {
    setEditRedirect(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const isFormOpen = showForm || !!editRedirect

  if (isLoading) return <PageLoader text="Loading redirects..." />

  return (
    <div className="fade-in">
      <PageHeader
        title="Redirect Manager"
        description="Manage 301, 302, and 307 URL redirects with hit tracking"
        actions={
          <div className="flex items-center gap-2">
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
              variant="outline"
              size="sm"
              onClick={() => importRef.current?.click()}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Import CSV
            </Button>
            <input
              ref={importRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) importMutation.mutate(file)
                e.target.value = ''
              }}
            />
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4" /> Add Redirect
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex items-center gap-2 max-w-md">
          <Input
            placeholder="Search source or target..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="h-8 text-sm"
          />
          <Button type="submit" variant="outline" size="sm">
            <Search className="w-4 h-4" />
          </Button>
          {search && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setSearch(''); setSearchInput(''); setPage(1) }}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </form>

        {!data?.redirects.length ? (
          <div className="text-center py-16 text-slate-400">
            <ArrowRight className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium text-slate-500 mb-1">
              {search ? 'No redirects found' : 'No redirects yet'}
            </h3>
            <p className="text-sm mb-4">
              {search ? `No results for "${search}"` : 'Create redirects to automatically forward visitors from old URLs'}
            </p>
            {!search && (
              <Button size="sm" onClick={openCreate}>
                <Plus className="w-4 h-4" /> Add Redirect
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Source</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Target</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300 w-20">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300 w-20">Hits</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-300 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.redirects.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-700 dark:text-slate-300 max-w-xs truncate">
                        {r.source}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {r.target}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          r.type === 301 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          r.type === 302 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        }`}>
                          {r.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 text-xs">
                        {r.hits.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(r)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(r)}
                            className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(data.total_pages, p + 1))} disabled={page === data.total_pages}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditRedirect(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editRedirect ? 'Edit Redirect' : 'New Redirect'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="redir-source">Source URL (path)</Label>
              <Input
                id="redir-source"
                placeholder="/old-page"
                value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                autoFocus
              />
              <p className="text-xs text-slate-500">The path to redirect from, e.g. <code className="font-mono">/old-page</code></p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="redir-target">Target URL</Label>
              <Input
                id="redir-target"
                placeholder="/new-page or https://example.com"
                value={form.target}
                onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
              />
              <p className="text-xs text-slate-500">Can be a relative path or full URL</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="redir-type">Redirect Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger id="redir-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="301">301 — Permanent (SEO-safe)</SelectItem>
                  <SelectItem value="302">302 — Temporary</SelectItem>
                  <SelectItem value="307">307 — Temporary (method preserved)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditRedirect(null) }}>
              <X className="w-4 h-4" /> Cancel
            </Button>
            <Button
              onClick={() => {
                if (editRedirect) {
                  updateMutation.mutate({ id: editRedirect.id, ...form })
                } else {
                  createMutation.mutate(form)
                }
              }}
              disabled={!form.source || !form.target || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {editRedirect ? 'Update' : 'Create'} Redirect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Redirect</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Delete the redirect from <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">{deleteTarget?.source}</code>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
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
