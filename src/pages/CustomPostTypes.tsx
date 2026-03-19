import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, FileText, Tag, ChevronRight, RefreshCw, Check, LayoutGrid,
  Layers, GripVertical, X, ChevronDown, ChevronUp,
} from 'lucide-react'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ── Types ────────────────────────────────────────────────────────────────────

interface CPT {
  slug: string
  singular: string
  plural: string
  description: string
  menu_icon: string
  public: boolean
  show_in_rest: boolean
  has_archive: boolean
  supports: string[]
}

interface Taxonomy {
  slug: string
  singular: string
  plural: string
  hierarchical: boolean
  public: boolean
  show_in_rest: boolean
  post_types: string[]
}

interface PostTypeOption {
  slug: string
  label: string
}

// ── Field Groups types ────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: 'text',       label: 'Text' },
  { value: 'textarea',   label: 'Textarea' },
  { value: 'number',     label: 'Number' },
  { value: 'email',      label: 'Email' },
  { value: 'url',        label: 'URL' },
  { value: 'select',     label: 'Select' },
  { value: 'checkbox',   label: 'Checkbox' },
  { value: 'radio',      label: 'Radio' },
  { value: 'true_false', label: 'True / False' },
  { value: 'image',      label: 'Image' },
  { value: 'wysiwyg',    label: 'WYSIWYG' },
  { value: 'date',       label: 'Date' },
  { value: 'color',      label: 'Color' },
] as const

type FieldType = typeof FIELD_TYPES[number]['value']

interface FGField {
  id: string
  type: FieldType
  label: string
  name: string
  required: boolean
  instructions: string
  options: { choices?: string }
}

interface FieldGroup {
  id: string
  title: string
  description: string
  location: string[]
  fields: FGField[]
  active: boolean
  created?: string
}

function newField(): FGField {
  return {
    id: 'f_' + Math.random().toString(36).slice(2),
    type: 'text', label: '', name: '', required: false, instructions: '',
    options: {},
  }
}

function emptyGroup(): Omit<FieldGroup, 'id' | 'created'> {
  return { title: '', description: '', location: [], fields: [], active: true }
}

const SUPPORTS_OPTIONS = [
  { value: 'title',          label: 'Title' },
  { value: 'editor',         label: 'Editor' },
  { value: 'thumbnail',      label: 'Featured Image' },
  { value: 'excerpt',        label: 'Excerpt' },
  { value: 'custom-fields',  label: 'Custom Fields' },
  { value: 'comments',       label: 'Comments' },
  { value: 'revisions',      label: 'Revisions' },
  { value: 'author',         label: 'Author' },
  { value: 'page-attributes',label: 'Page Attributes' },
]

const POPULAR_ICONS = [
  'dashicons-admin-post', 'dashicons-admin-page', 'dashicons-admin-media',
  'dashicons-portfolio', 'dashicons-products', 'dashicons-tickets-alt',
  'dashicons-book', 'dashicons-book-alt', 'dashicons-businessman',
  'dashicons-id', 'dashicons-location', 'dashicons-tag',
  'dashicons-star-filled', 'dashicons-heart', 'dashicons-feedback',
  'dashicons-camera', 'dashicons-video-alt3', 'dashicons-format-audio',
]

const emptyCPT = (): Omit<CPT, 'slug'> & { slug: string } => ({
  slug: '', singular: '', plural: '', description: '',
  menu_icon: 'dashicons-admin-post',
  public: true, show_in_rest: true, has_archive: false,
  supports: ['title', 'editor', 'thumbnail'],
})

const emptyTax = (): Omit<Taxonomy, 'slug'> & { slug: string } => ({
  slug: '', singular: '', plural: '',
  hierarchical: false, public: true, show_in_rest: true,
  post_types: [],
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20)
}
function pluralise(s: string) {
  if (!s) return ''
  if (s.endsWith('s')) return s
  return s + 's'
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SupportsPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {SUPPORTS_OPTIONS.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => toggle(o.value)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors
            ${value.includes(o.value)
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-400'}`}
        >
          {value.includes(o.value) && <Check className="h-3 w-3" />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {POPULAR_ICONS.map(icon => (
          <button
            key={icon}
            type="button"
            title={icon}
            onClick={() => onChange(icon)}
            className={`w-8 h-8 flex items-center justify-center rounded border transition-colors
              ${value === icon
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400'}`}
          >
            <span className={`dashicons ${icon}`} style={{ fontSize: 14, width: 14, height: 14 }} />
          </button>
        ))}
      </div>
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="dashicons-admin-post"
        className="text-xs font-mono dark:bg-slate-900"
      />
    </div>
  )
}

// ── Field Group Dialog ────────────────────────────────────────────────────────

function FieldGroupDialog({
  open, onClose, initial, postTypeOptions,
}: {
  open: boolean
  onClose: () => void
  initial: FieldGroup | null
  postTypeOptions: PostTypeOption[]
}) {
  const qc = useQueryClient()
  const isEditing = initial !== null
  const [form, setForm] = useState<Omit<FieldGroup, 'id' | 'created'>>(
    initial ? { title: initial.title, description: initial.description, location: initial.location, fields: initial.fields, active: initial.active }
            : emptyGroup()
  )
  const [expandedField, setExpandedField] = useState<string | null>(null)

  function setTop<K extends keyof typeof form>(key: K, val: typeof form[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function toggleLocation(slug: string) {
    setForm(prev => ({
      ...prev,
      location: prev.location.includes(slug)
        ? prev.location.filter(s => s !== slug)
        : [...prev.location, slug],
    }))
  }

  function addField() {
    const f = newField()
    setForm(prev => ({ ...prev, fields: [...prev.fields, f] }))
    setExpandedField(f.id)
  }

  function updateField(idx: number, patch: Partial<FGField>) {
    setForm(prev => {
      const fields = [...prev.fields]
      fields[idx] = { ...fields[idx], ...patch }
      return { ...prev, fields }
    })
  }

  function removeField(idx: number) {
    setForm(prev => ({ ...prev, fields: prev.fields.filter((_, i) => i !== idx) }))
  }

  function moveField(idx: number, dir: -1 | 1) {
    setForm(prev => {
      const fields = [...prev.fields]
      const target = idx + dir
      if (target < 0 || target >= fields.length) return prev
      ;[fields[idx], fields[target]] = [fields[target], fields[idx]]
      return { ...prev, fields }
    })
  }

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      isEditing
        ? api.put(`/field-groups/${initial!.id}`, data)
        : api.post('/field-groups', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['field-groups'] })
      toast.success(`Field group "${form.title}" ${isEditing ? 'updated' : 'created'}`)
      onClose()
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to save'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('Title is required')
    mutation.mutate(form)
  }

  const hasChoices = (type: FieldType) => ['select', 'checkbox', 'radio'].includes(type)

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-slate-900 dark:border-slate-700">
        <DialogHeader>
          <DialogTitle className="dark:text-white">
            {isEditing ? 'Edit Field Group' : 'New Field Group'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Title + active */}
          <div className="flex gap-3 items-start">
            <div className="flex-1 space-y-1.5">
              <Label className="dark:text-slate-300">Title *</Label>
              <Input
                value={form.title}
                onChange={e => setTop('title', e.target.value)}
                placeholder="e.g. Book Details"
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2 pt-7">
              <Switch checked={form.active} onCheckedChange={v => setTop('active', v)} />
              <span className="text-sm dark:text-slate-300">Active</span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="dark:text-slate-300">Description</Label>
            <Input
              value={form.description}
              onChange={e => setTop('description', e.target.value)}
              placeholder="Optional description"
              className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label className="dark:text-slate-300">Show on Post Types</Label>
            {postTypeOptions.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">No post types available. Create one first.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {postTypeOptions.map(pt => (
                  <button
                    key={pt.slug}
                    type="button"
                    onClick={() => toggleLocation(pt.slug)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors
                      ${form.location.includes(pt.slug)
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-400'}`}
                  >
                    {form.location.includes(pt.slug) && <Check className="h-3 w-3" />}
                    {pt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fields */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="dark:text-slate-300">Fields</Label>
              <Button type="button" size="sm" variant="outline" onClick={addField}
                className="dark:border-slate-600 dark:text-slate-300 h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" /> Add Field
              </Button>
            </div>

            {form.fields.length === 0 && (
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg py-8 text-center">
                <p className="text-sm text-slate-400 dark:text-slate-500">No fields yet. Click "Add Field" to start.</p>
              </div>
            )}

            <div className="space-y-2">
              {form.fields.map((field, idx) => {
                const expanded = expandedField === field.id
                return (
                  <div key={field.id} className="border rounded-lg dark:border-slate-700 overflow-hidden">
                    {/* Field header row */}
                    <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60">
                      <GripVertical className="h-4 w-4 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button type="button" onClick={() => moveField(idx, -1)} disabled={idx === 0}
                          className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30">
                          <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                        </button>
                        <button type="button" onClick={() => moveField(idx, 1)} disabled={idx === form.fields.length - 1}
                          className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30">
                          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                        </button>
                      </div>
                      <div
                        className="flex-1 flex items-center gap-2 cursor-pointer min-w-0"
                        onClick={() => setExpandedField(expanded ? null : field.id)}
                      >
                        <span className="text-sm font-medium dark:text-white truncate">
                          {field.label || <span className="text-slate-400">Untitled Field</span>}
                        </span>
                        <Badge variant="secondary" className="text-xs dark:bg-slate-700 dark:text-slate-300 flex-shrink-0">
                          {FIELD_TYPES.find(t => t.value === field.type)?.label ?? field.type}
                        </Badge>
                        {field.name && (
                          <code className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">{field.name}</code>
                        )}
                      </div>
                      <button type="button" onClick={() => setExpandedField(expanded ? null : field.id)}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700">
                        {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </button>
                      <button type="button" onClick={() => removeField(idx)}
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500">
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Expanded field editor */}
                    {expanded && (
                      <div className="p-3 space-y-3 border-t dark:border-slate-700">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs dark:text-slate-400">Label *</Label>
                            <Input
                              value={field.label}
                              onChange={e => updateField(idx, { label: e.target.value })}
                              placeholder="Field Label"
                              className="h-8 text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs dark:text-slate-400">Field Name *</Label>
                            <Input
                              value={field.name}
                              onChange={e => updateField(idx, { name: toSlug(e.target.value) })}
                              placeholder="field_name"
                              className="h-8 text-sm font-mono dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs dark:text-slate-400">Type</Label>
                          <Select value={field.type} onValueChange={v => updateField(idx, { type: v as FieldType })}>
                            <SelectTrigger className="h-8 text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="dark:bg-slate-800 dark:border-slate-600">
                              {FIELD_TYPES.map(ft => (
                                <SelectItem key={ft.value} value={ft.value} className="dark:text-slate-300 dark:focus:bg-slate-700">
                                  {ft.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {hasChoices(field.type) && (
                          <div className="space-y-1.5">
                            <Label className="text-xs dark:text-slate-400">Choices (one per line, or <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">value : Label</code>)</Label>
                            <textarea
                              value={field.options.choices ?? ''}
                              onChange={e => updateField(idx, { options: { choices: e.target.value } })}
                              rows={4}
                              placeholder={'red : Red\ngreen : Green\nblue : Blue'}
                              className="w-full rounded-md border px-3 py-2 text-sm font-mono dark:bg-slate-800 dark:border-slate-600 dark:text-white resize-none"
                            />
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <Label className="text-xs dark:text-slate-400">Instructions</Label>
                          <Input
                            value={field.instructions}
                            onChange={e => updateField(idx, { instructions: e.target.value })}
                            placeholder="Helper text shown below the field"
                            className="h-8 text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={field.required}
                            onCheckedChange={v => updateField(idx, { required: v })}
                          />
                          <span className="text-sm dark:text-slate-300">Required</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="dark:border-slate-600 dark:text-slate-300">
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── CPT Form Dialog ───────────────────────────────────────────────────────────

function CPTDialog({
  open, onClose, initial, isEditing,
}: {
  open: boolean
  onClose: () => void
  initial: CPT | null
  isEditing: boolean
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<CPT>(initial ?? emptyCPT())

  function set<K extends keyof CPT>(key: K, val: CPT[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: val }
      // Auto-fill singular/plural from slug if not touched
      if (key === 'singular' && !isEditing) {
        next.plural = pluralise(val as string)
        if (!prev.slug || prev.slug === toSlug(prev.singular)) {
          next.slug = toSlug(val as string)
        }
      }
      return next
    })
  }

  const mutation = useMutation({
    mutationFn: (data: CPT) => api.post('/cpt', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cpts'] })
      toast.success(`Post type "${form.singular}" ${isEditing ? 'updated' : 'created'}`)
      onClose()
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to save'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.slug) return toast.error('Slug is required')
    mutation.mutate(form)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-slate-900 dark:border-slate-700">
        <DialogHeader>
          <DialogTitle className="dark:text-white">
            {isEditing ? 'Edit Post Type' : 'New Post Type'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Labels row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="dark:text-slate-300">Singular Label *</Label>
              <Input
                value={form.singular}
                onChange={e => set('singular', e.target.value)}
                placeholder="Book"
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="dark:text-slate-300">Plural Label *</Label>
              <Input
                value={form.plural}
                onChange={e => set('plural', e.target.value)}
                placeholder="Books"
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
              />
            </div>
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label className="dark:text-slate-300">Slug *</Label>
            <Input
              value={form.slug}
              onChange={e => set('slug', toSlug(e.target.value))}
              placeholder="book"
              disabled={isEditing}
              className="font-mono dark:bg-slate-800 dark:border-slate-600 dark:text-white disabled:opacity-60"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">Lowercase letters, numbers, underscores. Max 20 chars.</p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="dark:text-slate-300">Description</Label>
            <Input
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Optional description"
              className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
            />
          </div>

          {/* Icon */}
          <div className="space-y-1.5">
            <Label className="dark:text-slate-300">Menu Icon</Label>
            <IconPicker value={form.menu_icon} onChange={v => set('menu_icon', v)} />
          </div>

          {/* Supports */}
          <div className="space-y-1.5">
            <Label className="dark:text-slate-300">Supports</Label>
            <SupportsPicker value={form.supports} onChange={v => set('supports', v)} />
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-3 gap-4">
            {([
              ['public',       'Public',          'Visible on frontend'],
              ['show_in_rest', 'REST API',         'Accessible via REST (Gutenberg)'],
              ['has_archive',  'Archive Page',     'Enable archive listing page'],
            ] as [keyof CPT, string, string][]).map(([key, label, desc]) => (
              <div key={key} className="flex items-start gap-3 p-3 border rounded-lg dark:border-slate-700">
                <Switch
                  checked={form[key] as boolean}
                  onCheckedChange={v => set(key, v as any)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium dark:text-white">{label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="dark:border-slate-600 dark:text-slate-300">
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Taxonomy Form Dialog ──────────────────────────────────────────────────────

function TaxDialog({
  open, onClose, initial, isEditing, postTypeOptions,
}: {
  open: boolean
  onClose: () => void
  initial: Taxonomy | null
  isEditing: boolean
  postTypeOptions: PostTypeOption[]
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<Taxonomy>(initial ?? emptyTax())

  function set<K extends keyof Taxonomy>(key: K, val: Taxonomy[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: val }
      if (key === 'singular' && !isEditing) {
        next.plural = pluralise(val as string)
        if (!prev.slug || prev.slug === toSlug(prev.singular)) {
          next.slug = toSlug(val as string)
        }
      }
      return next
    })
  }

  function togglePostType(slug: string) {
    setForm(prev => ({
      ...prev,
      post_types: prev.post_types.includes(slug)
        ? prev.post_types.filter(p => p !== slug)
        : [...prev.post_types, slug],
    }))
  }

  const mutation = useMutation({
    mutationFn: (data: Taxonomy) => api.post('/cpt/taxonomies', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cpt-taxonomies'] })
      toast.success(`Taxonomy "${form.singular}" ${isEditing ? 'updated' : 'created'}`)
      onClose()
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to save'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.slug) return toast.error('Slug is required')
    if (!form.post_types.length) return toast.error('Select at least one post type')
    mutation.mutate(form)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto dark:bg-slate-900 dark:border-slate-700">
        <DialogHeader>
          <DialogTitle className="dark:text-white">
            {isEditing ? 'Edit Taxonomy' : 'New Taxonomy'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="dark:text-slate-300">Singular Label *</Label>
              <Input
                value={form.singular}
                onChange={e => set('singular', e.target.value)}
                placeholder="Genre"
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="dark:text-slate-300">Plural Label *</Label>
              <Input
                value={form.plural}
                onChange={e => set('plural', e.target.value)}
                placeholder="Genres"
                className="dark:bg-slate-800 dark:border-slate-600 dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="dark:text-slate-300">Slug *</Label>
            <Input
              value={form.slug}
              onChange={e => set('slug', toSlug(e.target.value))}
              placeholder="genre"
              disabled={isEditing}
              className="font-mono dark:bg-slate-800 dark:border-slate-600 dark:text-white disabled:opacity-60"
            />
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-3 gap-3">
            {([
              ['hierarchical', 'Hierarchical', 'Like categories (parent/child)'],
              ['public',       'Public',       'Visible on frontend'],
              ['show_in_rest', 'REST API',     'Accessible via REST'],
            ] as [keyof Taxonomy, string, string][]).map(([key, label, desc]) => (
              <div key={key} className="flex items-start gap-3 p-3 border rounded-lg dark:border-slate-700">
                <Switch
                  checked={form[key] as boolean}
                  onCheckedChange={v => set(key, v as any)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium dark:text-white">{label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Attach to post types */}
          <div className="space-y-2">
            <Label className="dark:text-slate-300">Attach to Post Types *</Label>
            <div className="flex flex-wrap gap-2">
              {postTypeOptions.map(pt => (
                <button
                  key={pt.slug}
                  type="button"
                  onClick={() => togglePostType(pt.slug)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors
                    ${form.post_types.includes(pt.slug)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-400'}`}
                >
                  {form.post_types.includes(pt.slug) && <Check className="h-3 w-3" />}
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="dark:border-slate-600 dark:text-slate-300">
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CustomPostTypes() {
  const qc = useQueryClient()
  const [cptDialog, setCptDialog] = useState<{ open: boolean; item: CPT | null }>({ open: false, item: null })
  const [taxDialog, setTaxDialog] = useState<{ open: boolean; item: Taxonomy | null }>({ open: false, item: null })
  const [fgDialog, setFgDialog] = useState<{ open: boolean; item: FieldGroup | null }>({ open: false, item: null })

  const { data: fieldGroups = [], isLoading: fgLoading } = useQuery<FieldGroup[]>({
    queryKey: ['field-groups'],
    queryFn: () => api.get('/field-groups'),
  })

  const deleteFG = useMutation({
    mutationFn: (id: string) => api.delete(`/field-groups/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['field-groups'] })
      toast.success('Field group deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })

  const { data: cpts = [], isLoading: cptLoading } = useQuery<CPT[]>({
    queryKey: ['cpts'],
    queryFn: () => api.get('/cpt'),
  })

  const { data: taxonomies = [], isLoading: taxLoading } = useQuery<Taxonomy[]>({
    queryKey: ['cpt-taxonomies'],
    queryFn: () => api.get('/cpt/taxonomies'),
  })

  const { data: postTypeOptions = [] } = useQuery<PostTypeOption[]>({
    queryKey: ['all-post-types'],
    queryFn: () => api.get('/cpt/post-types'),
  })

  const deleteCPT = useMutation({
    mutationFn: (slug: string) => api.delete(`/cpt/${slug}`),
    onSuccess: (_, slug) => {
      qc.invalidateQueries({ queryKey: ['cpts'] })
      toast.success(`Post type "${slug}" deleted`)
    },
    onError: () => toast.error('Failed to delete'),
  })

  const deleteTax = useMutation({
    mutationFn: (slug: string) => api.delete(`/cpt/taxonomies/${slug}`),
    onSuccess: (_, slug) => {
      qc.invalidateQueries({ queryKey: ['cpt-taxonomies'] })
      toast.success(`Taxonomy "${slug}" deleted`)
    },
    onError: () => toast.error('Failed to delete'),
  })

  return (
    <div className="fade-in">
      <PageHeader
        title="Custom Post Types"
        description="Register and manage custom post types and taxonomies"
      />

      <div className="p-6 space-y-6">
      <Tabs defaultValue="field-groups">
        <TabsList className="overflow-x-auto max-w-full flex-nowrap scrollbar-none">
          <TabsTrigger value="field-groups">
            <Layers className="h-4 w-4 mr-1.5" />
            Field Groups
            {fieldGroups.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs">{fieldGroups.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="post-types">
            <FileText className="h-4 w-4 mr-1.5" />
            Post Types
            {cpts.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs">{cpts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="taxonomies">
            <Tag className="h-4 w-4 mr-1.5" />
            Taxonomies
            {taxonomies.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs">{taxonomies.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Field Groups tab ────────────────────────────────────────────── */}
        <TabsContent value="field-groups" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {fieldGroups.length === 0 ? 'No field groups yet.' : `${fieldGroups.length} group${fieldGroups.length !== 1 ? 's' : ''}`}
            </p>
            <Button size="sm" onClick={() => setFgDialog({ open: true, item: null })}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Field Group
            </Button>
          </div>

          {fgLoading && (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              Loading…
            </div>
          )}

          {!fgLoading && fieldGroups.length === 0 && (
            <Card className="dark:bg-slate-900 dark:border-slate-700">
              <CardContent className="py-12 text-center">
                <Layers className="h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p className="font-medium text-slate-600 dark:text-slate-400">No field groups yet</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 mb-4">
                  Create a field group to add custom meta fields to any post type.
                </p>
                <Button size="sm" onClick={() => setFgDialog({ open: true, item: null })}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Field Group
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3">
            {fieldGroups.map(fg => (
              <Card key={fg.id} className="dark:bg-slate-900 dark:border-slate-700">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                      <Layers className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 dark:text-white">{fg.title}</span>
                        <Badge variant={fg.active ? 'default' : 'secondary'} className="text-xs">
                          {fg.active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="secondary" className="text-xs dark:bg-slate-700 dark:text-slate-300">
                          {fg.fields.length} field{fg.fields.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      {fg.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{fg.description}</p>
                      )}
                      {fg.location.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {fg.location.map(loc => (
                            <span key={loc} className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <ChevronRight className="h-2.5 w-2.5" />
                              {postTypeOptions.find(p => p.slug === loc)?.label ?? loc}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button size="sm" variant="outline"
                        className="dark:border-slate-600 dark:text-slate-300"
                        onClick={() => setFgDialog({ open: true, item: fg })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline"
                        className="dark:border-slate-600 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => {
                          if (confirm(`Delete field group "${fg.title}"? This will not delete existing post meta.`))
                            deleteFG.mutate(fg.id)
                        }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Post Types tab ─────────────────────────────────────────────── */}
        <TabsContent value="post-types" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {cpts.length === 0 ? 'No custom post types yet.' : `${cpts.length} registered`}
            </p>
            <Button size="sm" onClick={() => setCptDialog({ open: true, item: null })}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Post Type
            </Button>
          </div>

          {cptLoading && (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              Loading…
            </div>
          )}

          {!cptLoading && cpts.length === 0 && (
            <Card className="dark:bg-slate-900 dark:border-slate-700">
              <CardContent className="py-12 text-center">
                <LayoutGrid className="h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p className="font-medium text-slate-600 dark:text-slate-400">No post types yet</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 mb-4">
                  Create your first custom post type to get started.
                </p>
                <Button size="sm" onClick={() => setCptDialog({ open: true, item: null })}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Post Type
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3">
            {cpts.map(cpt => (
              <Card key={cpt.slug} className="dark:bg-slate-900 dark:border-slate-700">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <span className={`dashicons ${cpt.menu_icon} text-slate-500 dark:text-slate-400`} style={{ fontSize: 18, width: 18, height: 18 }} />
                    </div>

                    {/* Labels */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 dark:text-white">{cpt.plural}</span>
                        <code className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
                          {cpt.slug}
                        </code>
                        {cpt.public && (
                          <Badge variant="secondary" className="text-xs dark:bg-slate-700 dark:text-slate-300">Public</Badge>
                        )}
                        {cpt.show_in_rest && (
                          <Badge variant="secondary" className="text-xs dark:bg-slate-700 dark:text-slate-300">REST</Badge>
                        )}
                        {cpt.has_archive && (
                          <Badge variant="secondary" className="text-xs dark:bg-slate-700 dark:text-slate-300">Archive</Badge>
                        )}
                      </div>
                      {cpt.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{cpt.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {cpt.supports.map(s => (
                          <span key={s} className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm" variant="outline"
                        className="dark:border-slate-600 dark:text-slate-300"
                        onClick={() => setCptDialog({ open: true, item: cpt })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        className="dark:border-slate-600 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => {
                          if (confirm(`Delete post type "${cpt.slug}"? This will not delete existing posts.`))
                            deleteCPT.mutate(cpt.slug)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Taxonomies tab ──────────────────────────────────────────────── */}
        <TabsContent value="taxonomies" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {taxonomies.length === 0 ? 'No custom taxonomies yet.' : `${taxonomies.length} registered`}
            </p>
            <Button size="sm" onClick={() => setTaxDialog({ open: true, item: null })}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Taxonomy
            </Button>
          </div>

          {taxLoading && (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              Loading…
            </div>
          )}

          {!taxLoading && taxonomies.length === 0 && (
            <Card className="dark:bg-slate-900 dark:border-slate-700">
              <CardContent className="py-12 text-center">
                <Tag className="h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p className="font-medium text-slate-600 dark:text-slate-400">No taxonomies yet</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 mb-4">
                  Create a taxonomy to classify your post types.
                </p>
                <Button size="sm" onClick={() => setTaxDialog({ open: true, item: null })}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Taxonomy
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3">
            {taxonomies.map(tax => (
              <Card key={tax.slug} className="dark:bg-slate-900 dark:border-slate-700">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <Tag className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 dark:text-white">{tax.plural}</span>
                        <code className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
                          {tax.slug}
                        </code>
                        {tax.hierarchical && (
                          <Badge variant="secondary" className="text-xs dark:bg-slate-700 dark:text-slate-300">Hierarchical</Badge>
                        )}
                        {tax.show_in_rest && (
                          <Badge variant="secondary" className="text-xs dark:bg-slate-700 dark:text-slate-300">REST</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {tax.post_types.map(pt => (
                          <span key={pt} className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <ChevronRight className="h-2.5 w-2.5" />
                            {postTypeOptions.find(p => p.slug === pt)?.label ?? pt}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm" variant="outline"
                        className="dark:border-slate-600 dark:text-slate-300"
                        onClick={() => setTaxDialog({ open: true, item: tax })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        className="dark:border-slate-600 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => {
                          if (confirm(`Delete taxonomy "${tax.slug}"?`))
                            deleteTax.mutate(tax.slug)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {fgDialog.open && (
        <FieldGroupDialog
          open={fgDialog.open}
          onClose={() => setFgDialog({ open: false, item: null })}
          initial={fgDialog.item}
          postTypeOptions={postTypeOptions}
        />
      )}
      {cptDialog.open && (
        <CPTDialog
          open={cptDialog.open}
          onClose={() => setCptDialog({ open: false, item: null })}
          initial={cptDialog.item}
          isEditing={cptDialog.item !== null}
        />
      )}
      {taxDialog.open && (
        <TaxDialog
          open={taxDialog.open}
          onClose={() => setTaxDialog({ open: false, item: null })}
          initial={taxDialog.item}
          isEditing={taxDialog.item !== null}
          postTypeOptions={postTypeOptions}
        />
      )}
      </div>
    </div>
  )
}
