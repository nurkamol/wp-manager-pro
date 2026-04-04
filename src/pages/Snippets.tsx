import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Editor from '@monaco-editor/react'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Trash2, Edit2, Code2, RefreshCw, X, Save, AlertTriangle, Maximize2, Minimize2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Snippet {
  id: number
  title: string
  description: string
  code: string
  type: 'php' | 'css' | 'js'
  enabled: number
  created_at: string
  updated_at: string
}

const TYPE_COLORS: Record<string, string> = {
  php: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200',
  css: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200',
  js:  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-200',
}

function getSnippetLang(type: string): string {
  switch (type) {
    case 'php': return 'php'
    case 'css': return 'css'
    case 'js':  return 'javascript'
    default:    return 'plaintext'
  }
}

type SnippetType = 'php' | 'css' | 'js'
const emptyForm: { title: string; description: string; code: string; type: SnippetType } = {
  title: '', description: '', code: '', type: 'php',
}

export function Snippets() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editSnippet, setEditSnippet] = useState<Snippet | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Snippet | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [editorExpanded, setEditorExpanded] = useState(false)

  const { data, isLoading } = useQuery<{ snippets: Snippet[] }>({
    queryKey: ['snippets'],
    queryFn: () => api.get('/snippets'),
  })

  const createMutation = useMutation({
    mutationFn: (d: typeof emptyForm) => api.post('/snippets', d),
    onSuccess: () => {
      toast.success('Snippet created')
      queryClient.invalidateQueries({ queryKey: ['snippets'] })
      setShowForm(false)
      setForm(emptyForm)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...d }: { id: number } & typeof emptyForm) => api.put(`/snippets/${id}`, d),
    onSuccess: () => {
      toast.success('Snippet updated')
      queryClient.invalidateQueries({ queryKey: ['snippets'] })
      setEditSnippet(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api.post(`/snippets/${id}/toggle`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snippets'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/snippets/${id}`),
    onSuccess: () => {
      toast.success('Snippet deleted')
      queryClient.invalidateQueries({ queryKey: ['snippets'] })
      setDeleteTarget(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const openEdit = (s: Snippet) => {
    setEditSnippet(s)
    setForm({ title: s.title, description: s.description, code: s.code, type: s.type })
    setEditorExpanded(false)
  }

  const openCreate = () => {
    setEditSnippet(null)
    setForm(emptyForm)
    setEditorExpanded(false)
    setShowForm(true)
  }

  const isFormOpen = showForm || !!editSnippet

  if (isLoading) return <PageLoader text="Loading snippets..." />

  return (
    <div className="fade-in">
      <PageHeader
        title="Code Snippets"
        description="Manage PHP, CSS, and JS snippets that run on your site"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4" /> New Snippet
          </Button>
        }
      />

      <div className="p-6">
        {/* PHP warning */}
        <div className="flex items-start gap-3 p-3 mb-5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>PHP snippets run on every page load via <code className="font-mono text-xs bg-amber-100 dark:bg-amber-900/40 px-1 rounded">eval()</code>. Only enable code you trust completely.</span>
        </div>

        {!data?.snippets.length ? (
          <div className="text-center py-16 text-slate-400">
            <Code2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium text-slate-500 mb-1">No snippets yet</h3>
            <p className="text-sm mb-4">Add PHP, CSS, or JS code snippets to customise your site without editing theme files</p>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4" /> Create Snippet
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {data.snippets.map(snippet => (
              <div
                key={snippet.id}
                className="border rounded-lg p-4 bg-white dark:bg-slate-900 flex items-start gap-4 hover:shadow-sm transition-shadow"
              >
                {/* Toggle */}
                <div className="pt-0.5 shrink-0">
                  <Switch
                    checked={!!snippet.enabled}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: snippet.id, enabled: checked })}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{snippet.title}</h3>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-medium border ${TYPE_COLORS[snippet.type] || ''}`}>
                      {snippet.type.toUpperCase()}
                    </span>
                    {!!snippet.enabled && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </span>
                    )}
                  </div>
                  {snippet.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{snippet.description}</p>
                  )}
                  <pre className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded p-2 overflow-x-auto max-h-20 font-mono line-clamp-3">
                    {snippet.code}
                  </pre>
                  <p className="text-xs text-slate-400 mt-2">Updated {formatDate(snippet.updated_at)}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(snippet)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 rounded transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(snippet)}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) { setShowForm(false); setEditSnippet(null); setEditorExpanded(false) }
        }}
      >
        <DialogContent className={editorExpanded ? 'max-w-[95vw] w-[95vw]' : 'max-w-3xl'}>
          <DialogHeader>
            <DialogTitle>{editSnippet ? 'Edit Snippet' : 'New Snippet'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!editorExpanded && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="snippet-title">Title</Label>
                    <Input
                      id="snippet-title"
                      placeholder="My custom snippet"
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="snippet-type">Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v as SnippetType }))}>
                      <SelectTrigger id="snippet-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="php">PHP</SelectItem>
                        <SelectItem value="css">CSS</SelectItem>
                        <SelectItem value="js">JavaScript</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="snippet-desc">Description (optional)</Label>
                  <Input
                    id="snippet-desc"
                    placeholder="What does this snippet do?"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Code</Label>
                <button
                  type="button"
                  onClick={() => setEditorExpanded(e => !e)}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition-colors"
                  title={editorExpanded ? 'Collapse editor' : 'Expand editor'}
                >
                  {editorExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>
              <div className="border rounded-md overflow-hidden" style={{ height: editorExpanded ? `${Math.round(window.innerHeight * 0.95) - 180}px` : '300px' }}>
                <Editor
                  key={editorExpanded ? 'expanded' : 'normal'}
                  height={editorExpanded ? `${Math.round(window.innerHeight * 0.95) - 180}px` : '300px'}
                  language={getSnippetLang(form.type)}
                  theme="vs-dark"
                  value={form.code}
                  onChange={v => setForm(f => ({ ...f, code: v || '' }))}
                  options={{
                    minimap: { enabled: editorExpanded },
                    fontSize: 13,
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    lineNumbers: 'on',
                    renderWhitespace: 'none',
                  }}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditSnippet(null); setEditorExpanded(false) }}>
              <X className="w-4 h-4" /> Cancel
            </Button>
            <Button
              onClick={() => {
                if (editSnippet) {
                  updateMutation.mutate({ id: editSnippet.id, ...form })
                } else {
                  createMutation.mutate(form)
                }
              }}
              disabled={!form.title || !form.code || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {editSnippet ? 'Update' : 'Create'} Snippet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Snippet</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Are you sure you want to delete <strong>"{deleteTarget?.title}"</strong>?
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
