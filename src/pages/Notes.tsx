import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Trash2, Edit2, StickyNote, RefreshCw, X, Save } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Note {
  id: number
  title: string
  content: string
  color: string
  created_at: string
  updated_at: string
}

const NOTE_COLORS = [
  { value: 'default', label: 'Default', bg: 'bg-white', border: 'border-slate-200' },
  { value: 'blue', label: 'Blue', bg: 'bg-blue-50', border: 'border-blue-200' },
  { value: 'green', label: 'Green', bg: 'bg-green-50', border: 'border-green-200' },
  { value: 'yellow', label: 'Yellow', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  { value: 'red', label: 'Red', bg: 'bg-red-50', border: 'border-red-200' },
  { value: 'purple', label: 'Purple', bg: 'bg-purple-50', border: 'border-purple-200' },
]

function getNoteStyle(color: string) {
  return NOTE_COLORS.find(c => c.value === color) || NOTE_COLORS[0]
}

export function Notes() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editNote, setEditNote] = useState<Note | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null)

  const [form, setForm] = useState({ title: '', content: '', color: 'default' })

  const { data, isLoading } = useQuery<{ notes: Note[] }>({
    queryKey: ['notes'],
    queryFn: () => api.get('/notes'),
  })

  const createMutation = useMutation({
    mutationFn: (data: { title: string; content: string; color: string }) =>
      api.post('/notes', data),
    onSuccess: () => {
      toast.success('Note created')
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      setShowCreate(false)
      setForm({ title: '', content: '', color: 'default' })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number; title: string; content: string; color: string }) =>
      api.put(`/notes/${id}`, data),
    onSuccess: () => {
      toast.success('Note updated')
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      setEditNote(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/notes/${id}`),
    onSuccess: () => {
      toast.success('Note deleted')
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      setDeleteTarget(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const openEdit = (note: Note) => {
    setEditNote(note)
    setForm({ title: note.title, content: note.content, color: note.color })
  }

  if (isLoading) return <PageLoader text="Loading notes..." />

  return (
    <div className="fade-in">
      <PageHeader
        title="Notes"
        description="Keep notes and reminders for this site"
        actions={
          <Button size="sm" onClick={() => { setShowCreate(true); setForm({ title: '', content: '', color: 'default' }) }}>
            <Plus className="w-4 h-4" /> New Note
          </Button>
        }
      />

      <div className="p-6">
        {data?.notes.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <StickyNote className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium text-slate-500 mb-1">No notes yet</h3>
            <p className="text-sm mb-4">Create your first note to keep track of important information</p>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" /> Create Note
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data?.notes.map(note => {
              const style = getNoteStyle(note.color)
              return (
                <div
                  key={note.id}
                  className={`${style.bg} border ${style.border} rounded-lg p-4 flex flex-col hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-slate-800 text-sm leading-tight flex-1 mr-2">
                      {note.title}
                    </h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(note)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(note)}
                        className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {note.content && (
                    <p className="text-xs text-slate-600 flex-1 whitespace-pre-wrap line-clamp-6 mb-3">
                      {note.content}
                    </p>
                  )}

                  <p className="text-[10px] text-slate-400 mt-auto">
                    {formatDate(note.updated_at)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog
        open={showCreate || !!editNote}
        onOpenChange={(open) => {
          if (!open) { setShowCreate(false); setEditNote(null) }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editNote ? 'Edit Note' : 'New Note'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                placeholder="Note title..."
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note-content">Content</Label>
              <Textarea
                id="note-content"
                placeholder="Write your note..."
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {NOTE_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setForm(f => ({ ...f, color: c.value }))}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${c.bg} ${
                      form.color === c.value ? 'border-blue-500 scale-110' : 'border-slate-200 hover:border-slate-400'
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditNote(null) }}>
              <X className="w-4 h-4" /> Cancel
            </Button>
            <Button
              onClick={() => {
                if (editNote) {
                  updateMutation.mutate({ id: editNote.id, ...form })
                } else {
                  createMutation.mutate(form)
                }
              }}
              disabled={!form.title || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {editNote ? 'Update' : 'Create'} Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
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
