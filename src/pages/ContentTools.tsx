import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Copy, Calendar, Settings2, FileText, ExternalLink, Pencil, Trash2,
  RefreshCw, ChevronLeft, ChevronRight, Search, Check,
} from 'lucide-react'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PostType { slug: string; label: string }
interface Author   { id: number; name: string }

interface Post {
  id: number
  title: string
  status: string
  post_type: string
  date: string
  author_id: number
  author: string
  categories: { id: number; name: string }[]
  edit_link: string
  view_link: string
}

interface PostsResponse {
  posts: Post[]
  total: number
  total_pages: number
  page: number
}

interface ScheduledPost {
  id: number
  title: string
  post_type: string
  scheduled_fmt: string
  scheduled_local: string
  author: string
  edit_link: string
  view_link: string
}

interface OptionRow {
  option_name: string
  option_value: string
  full_length: number
  autoload: string
  type: string
}

interface OptionsResponse {
  options: OptionRow[]
  total: number
  total_pages: number
  page: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string) {
  const map: Record<string, string> = {
    publish: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    draft:   'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    private: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    trash:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    future:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  )
}

function typeBadge(type: string) {
  const map: Record<string, string> = {
    string:     'bg-slate-100 text-slate-600',
    integer:    'bg-blue-100 text-blue-700',
    float:      'bg-cyan-100 text-cyan-700',
    serialized: 'bg-orange-100 text-orange-700',
    json:       'bg-purple-100 text-purple-700',
    empty:      'bg-slate-100 text-slate-400',
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${map[type] ?? 'bg-slate-100 text-slate-600'}`}>
      {type}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Tab 1 — Bulk Post Editor
// ---------------------------------------------------------------------------

function BulkEditorTab() {
  const qc = useQueryClient()
  const [postType, setPostType] = useState('any')
  const [status, setStatus]     = useState('any')
  const [search, setSearch]     = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage]         = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // Bulk edit fields
  const [bulkStatus, setBulkStatus]   = useState('')
  const [bulkDate, setBulkDate]       = useState('')
  const [bulkAuthor, setBulkAuthor]   = useState('')
  const [bulkCategory, setBulkCategory] = useState('')

  const { data: postTypes = [] } = useQuery<PostType[]>({
    queryKey: ['content-post-types'],
    queryFn: () => api.get('/content/post-types'),
  })

  const { data: authors = [] } = useQuery<Author[]>({
    queryKey: ['content-authors'],
    queryFn: () => api.get('/content/authors'),
  })

  const { data, isLoading, isFetching } = useQuery<PostsResponse>({
    queryKey: ['content-posts', postType, status, search, page],
    queryFn: () => {
      const params = new URLSearchParams({
        post_type: postType, status, per_page: '20', page: String(page),
      })
      if (search) params.set('search', search)
      return api.get(`/content/posts?${params}`)
    },
  })

  const bulkMutation = useMutation({
    mutationFn: (payload: { ids: number[]; updates: Record<string, string> }) =>
      api.post<{ updated: number }>('/content/posts/bulk-edit', payload),
    onSuccess: (res) => {
      toast.success(`Updated ${res.updated} post${res.updated !== 1 ? 's' : ''}`)
      setSelected(new Set())
      setBulkStatus(''); setBulkDate(''); setBulkAuthor(''); setBulkCategory('')
      qc.invalidateQueries({ queryKey: ['content-posts'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const posts = data?.posts ?? []
  const total = data?.total ?? 0
  const totalPages = data?.total_pages ?? 1

  const toggleAll = () => {
    if (selected.size === posts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(posts.map(p => p.id)))
    }
  }

  const toggleOne = (id: number) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const applyBulkEdit = () => {
    if (selected.size === 0) { toast.warning('Select at least one post'); return }
    const updates: Record<string, string> = {}
    if (bulkStatus)   updates.status      = bulkStatus
    if (bulkDate)     updates.date        = bulkDate
    if (bulkAuthor)   updates.author_id   = bulkAuthor
    if (bulkCategory) updates.category_id = bulkCategory
    if (Object.keys(updates).length === 0) { toast.warning('Choose at least one field to update'); return }
    bulkMutation.mutate({ ids: Array.from(selected), updates })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px]">
              <Label className="text-xs mb-1 block">Post Type</Label>
              <select
                value={postType}
                onChange={e => { setPostType(e.target.value); setPage(1) }}
                className="w-full h-9 border rounded-md px-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-600"
              >
                <option value="any">Any</option>
                {postTypes.map(pt => (
                  <option key={pt.slug} value={pt.slug}>{pt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[140px]">
              <Label className="text-xs mb-1 block">Status</Label>
              <select
                value={status}
                onChange={e => { setStatus(e.target.value); setPage(1) }}
                className="w-full h-9 border rounded-md px-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-600"
              >
                <option value="any">Any</option>
                {['publish','draft','pending','private','trash','future'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs mb-1 block">Search</Label>
              <div className="flex gap-1.5">
                <Input
                  placeholder="Search posts…"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1) } }}
                  className="h-9 text-sm"
                />
                <Button size="sm" variant="outline" onClick={() => { setSearch(searchInput); setPage(1) }}>
                  <Search className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions — only shown when items are selected */}
      {selected.size > 0 && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-3">
              Bulk edit {selected.size} selected post{selected.size !== 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="min-w-[130px]">
                <Label className="text-xs mb-1 block">Change Status</Label>
                <select
                  value={bulkStatus}
                  onChange={e => setBulkStatus(e.target.value)}
                  className="w-full h-9 border rounded-md px-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-600"
                >
                  <option value="">— keep —</option>
                  {['publish','draft','pending','private','trash'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[160px]">
                <Label className="text-xs mb-1 block">Change Author</Label>
                <select
                  value={bulkAuthor}
                  onChange={e => setBulkAuthor(e.target.value)}
                  className="w-full h-9 border rounded-md px-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-600"
                >
                  <option value="">— keep —</option>
                  {authors.map(a => (
                    <option key={a.id} value={String(a.id)}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[180px]">
                <Label className="text-xs mb-1 block">Set Publish Date (UTC)</Label>
                <input
                  type="datetime-local"
                  value={bulkDate}
                  onChange={e => setBulkDate(e.target.value)}
                  className="w-full h-9 border rounded-md px-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-600"
                />
              </div>
              <Button
                size="sm"
                onClick={applyBulkEdit}
                disabled={bulkMutation.isPending}
              >
                {bulkMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                Apply
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Deselect All
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Posts Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading posts…</div>
          ) : posts.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No posts found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                    <th className="px-3 py-2.5 w-10">
                      <input
                        type="checkbox"
                        checked={selected.size === posts.length && posts.length > 0}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-blue-600"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300">Title</th>
                    <th className="px-3 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300 hidden sm:table-cell">Type</th>
                    <th className="px-3 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300">Status</th>
                    <th className="px-3 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300 hidden md:table-cell">Author</th>
                    <th className="px-3 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300 hidden lg:table-cell">Date</th>
                    <th className="px-3 py-2.5 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map(post => (
                    <tr
                      key={post.id}
                      className={`border-b last:border-0 transition-colors ${selected.has(post.id) ? 'bg-blue-50 dark:bg-blue-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selected.has(post.id)}
                          onChange={() => toggleOne(post.id)}
                          className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-blue-600"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-slate-800 dark:text-slate-200 line-clamp-1">
                          {post.title || <em className="text-slate-400">(no title)</em>}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        <span className="text-xs text-slate-500">{post.post_type}</span>
                      </td>
                      <td className="px-3 py-2.5">{statusBadge(post.status)}</td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-slate-600 dark:text-slate-400 text-xs">{post.author}</td>
                      <td className="px-3 py-2.5 hidden lg:table-cell text-slate-500 dark:text-slate-400 text-xs">{post.date.slice(0, 10)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          {post.edit_link && (
                            <a href={post.edit_link} target="_blank" rel="noopener noreferrer" title="Edit in WP">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{total} posts total</span>
          <div className="flex gap-1 items-center">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="px-2">Page {page} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 2 — Post Duplicator
// ---------------------------------------------------------------------------

function DuplicatorTab() {
  const qc = useQueryClient()
  const [postType, setPostType] = useState('any')
  const [search, setSearch]     = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage]         = useState(1)
  const [copyMeta, setCopyMeta]           = useState(true)
  const [copyTaxonomies, setCopyTaxonomies] = useState(true)
  const [copyThumbnail, setCopyThumbnail]   = useState(true)
  const [newId, setNewId] = useState<number | null>(null)
  const [newLink, setNewLink] = useState('')

  const { data: postTypes = [] } = useQuery<PostType[]>({
    queryKey: ['content-post-types'],
    queryFn: () => api.get('/content/post-types'),
  })

  const { data, isLoading } = useQuery<PostsResponse>({
    queryKey: ['content-posts-dup', postType, search, page],
    queryFn: () => {
      const params = new URLSearchParams({
        post_type: postType, status: 'any', per_page: '20', page: String(page),
      })
      if (search) params.set('search', search)
      return api.get(`/content/posts?${params}`)
    },
  })

  const dupMutation = useMutation({
    mutationFn: (payload: object) => api.post<{ new_id: number; edit_link: string }>('/content/posts/duplicate', payload),
    onSuccess: (res) => {
      toast.success(`Post duplicated! New draft ID: ${res.new_id}`)
      setNewId(res.new_id)
      setNewLink(res.edit_link)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const posts = data?.posts ?? []
  const totalPages = data?.total_pages ?? 1

  return (
    <div className="space-y-4">
      {newId && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <span className="text-sm text-green-700 dark:text-green-400">
              Duplicate created — ID {newId}
            </span>
            <div className="flex gap-2">
              {newLink && (
                <a href={newLink} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="h-7 text-xs">
                    Edit in WP <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </a>
              )}
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setNewId(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Options */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm">Copy Options</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex flex-wrap gap-6">
            {[
              { label: 'Post Meta', value: copyMeta, set: setCopyMeta },
              { label: 'Taxonomies / Categories', value: copyTaxonomies, set: setCopyTaxonomies },
              { label: 'Featured Image', value: copyThumbnail, set: setCopyThumbnail },
            ].map(opt => (
              <label key={opt.label} className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={opt.value}
                  onChange={e => opt.set(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters + Table */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end mb-4">
            <div>
              <Label className="text-xs mb-1 block">Post Type</Label>
              <select
                value={postType}
                onChange={e => { setPostType(e.target.value); setPage(1) }}
                className="h-9 border rounded-md px-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-600"
              >
                <option value="any">Any</option>
                {postTypes.map(pt => (
                  <option key={pt.slug} value={pt.slug}>{pt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs mb-1 block">Search</Label>
              <div className="flex gap-1.5">
                <Input
                  placeholder="Search posts…"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1) } }}
                  className="h-9 text-sm"
                />
                <Button size="sm" variant="outline" onClick={() => { setSearch(searchInput); setPage(1) }}>
                  <Search className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
          ) : posts.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No posts found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Title</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300 hidden sm:table-cell">Type</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Status</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300 hidden md:table-cell">Author</th>
                    <th className="px-3 py-2 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map(post => (
                    <tr key={post.id} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {post.title || <em className="text-slate-400">(no title)</em>}
                        </span>
                        <span className="ml-2 text-xs text-slate-400">#{post.id}</span>
                      </td>
                      <td className="px-3 py-2.5 hidden sm:table-cell text-xs text-slate-500">{post.post_type}</td>
                      <td className="px-3 py-2.5">{statusBadge(post.status)}</td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-xs text-slate-500">{post.author}</td>
                      <td className="px-3 py-2.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={dupMutation.isPending}
                          onClick={() => dupMutation.mutate({
                            id: post.id,
                            copy_meta: copyMeta,
                            copy_taxonomies: copyTaxonomies,
                            copy_thumbnail: copyThumbnail,
                          })}
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Duplicate
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-1 mt-3 text-sm text-slate-500">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="px-2">Page {page} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 3 — Scheduled Post Manager
// ---------------------------------------------------------------------------

function ScheduledTab() {
  const [postType, setPostType] = useState('any')

  const { data, isLoading, refetch } = useQuery<{
    posts: ScheduledPost[]
    total: number
    post_types: string[]
  }>({
    queryKey: ['content-scheduled', postType],
    queryFn: () => {
      const params = new URLSearchParams({ post_type: postType })
      return api.get(`/content/scheduled?${params}`)
    },
  })

  const posts = data?.posts ?? []
  const postTypes = data?.post_types ?? []

  // Time-until helper
  const timeUntil = (localDate: string) => {
    const diff = new Date(localDate).getTime() - Date.now()
    if (diff < 0) return 'overdue'
    const d = Math.floor(diff / 86400000)
    const h = Math.floor((diff % 86400000) / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    if (d > 0) return `in ${d}d ${h}h`
    if (h > 0) return `in ${h}h ${m}m`
    return `in ${m}m`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Label className="text-sm">Post Type</Label>
          <select
            value={postType}
            onChange={e => setPostType(e.target.value)}
            className="h-9 border rounded-md px-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-600"
          >
            <option value="any">Any</option>
            {postTypes.map(pt => (
              <option key={pt} value={pt}>{pt}</option>
            ))}
          </select>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
          ) : posts.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              No scheduled posts found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300">Title</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300 hidden sm:table-cell">Type</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300">Scheduled For</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300 hidden md:table-cell">Author</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300">Time Until</th>
                    <th className="px-4 py-2.5 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map(post => {
                    const until = timeUntil(post.scheduled_local)
                    const overdue = until === 'overdue'
                    return (
                      <tr key={post.id} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {post.title || <em className="text-slate-400">(no title)</em>}
                          </span>
                          <span className="ml-2 text-xs text-slate-400">#{post.id}</span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-xs text-slate-500">{post.post_type}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
                          {post.scheduled_fmt}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-500">{post.author}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${overdue ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                            {until}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {post.edit_link && (
                            <a href={post.edit_link} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </a>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {posts.length > 0 && (
        <p className="text-xs text-slate-400">{posts.length} scheduled post{posts.length !== 1 ? 's' : ''} found.</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 4 — Options Table Editor
// ---------------------------------------------------------------------------

function OptionsTab() {
  const qc = useQueryClient()
  const [search, setSearch]         = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [autoload, setAutoload]     = useState('')
  const [page, setPage]             = useState(1)

  // Edit dialog
  const [editRow, setEditRow] = useState<OptionRow | null>(null)
  const [editValue, setEditValue]   = useState('')
  const [editAutoload, setEditAutoload] = useState('yes')

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data, isLoading } = useQuery<OptionsResponse>({
    queryKey: ['content-options', search, autoload, page],
    queryFn: () => {
      const params = new URLSearchParams({ per_page: '30', page: String(page) })
      if (search) params.set('search', search)
      if (autoload) params.set('autoload', autoload)
      return api.get(`/content/options?${params}`)
    },
  })

  // Fetch full value when opening edit dialog
  const fetchFull = useCallback(async (row: OptionRow) => {
    try {
      const full: { option_name: string; option_value: string; autoload: string } =
        await api.get(`/content/options/${encodeURIComponent(row.option_name)}`)
      setEditRow(row)
      setEditValue(full.option_value)
      setEditAutoload(full.autoload)
    } catch (e: unknown) {
      toast.error((e as Error).message)
    }
  }, [])

  const updateMutation = useMutation({
    mutationFn: (payload: object) => api.post('/content/options', payload),
    onSuccess: () => {
      toast.success('Option updated')
      setEditRow(null)
      qc.invalidateQueries({ queryKey: ['content-options'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.delete('/content/options', { option_name: name }),
    onSuccess: (_: unknown, name: string) => {
      toast.success(`Deleted: ${name}`)
      setDeleteTarget(null)
      qc.invalidateQueries({ queryKey: ['content-options'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const options = data?.options ?? []
  const total = data?.total ?? 0
  const totalPages = data?.total_pages ?? 1

  const protectedOptions = ['siteurl','blogname','admin_email','blogdescription','blogpublic','blog_public','active_plugins']

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs mb-1 block">Search option name</Label>
          <div className="flex gap-1.5">
            <Input
              placeholder="e.g. wmp_, blogname…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1) } }}
              className="h-9 text-sm"
            />
            <Button size="sm" variant="outline" onClick={() => { setSearch(searchInput); setPage(1) }}>
              <Search className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Autoload</Label>
          <select
            value={autoload}
            onChange={e => { setAutoload(e.target.value); setPage(1) }}
            className="h-9 border rounded-md px-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-600"
          >
            <option value="">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading options…</div>
          ) : options.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No options found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300">Option Name</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300 hidden sm:table-cell">Type</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300 hidden md:table-cell">Autoload</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300">Value Preview</th>
                    <th className="px-4 py-2.5 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {options.map(row => {
                    const locked = protectedOptions.includes(row.option_name)
                    return (
                      <tr key={row.option_name} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-2.5">
                          <code className="text-xs text-slate-700 dark:text-slate-300 font-mono">{row.option_name}</code>
                          {locked && (
                            <span className="ml-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium">protected</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 hidden sm:table-cell">{typeBadge(row.type)}</td>
                        <td className="px-4 py-2.5 hidden md:table-cell">
                          <span className={`text-xs ${row.autoload === 'yes' ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'}`}>
                            {row.autoload}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs text-slate-500 font-mono truncate block max-w-[280px]">
                            {row.full_length > 500
                              ? row.option_value.slice(0, 60) + `… (${row.full_length} chars)`
                              : row.option_value.slice(0, 80) || <em className="not-italic text-slate-300">(empty)</em>
                            }
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Edit"
                              onClick={() => fetchFull(row)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            {!locked && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                                title="Delete"
                                onClick={() => setDeleteTarget(row.option_name)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{total} options total</span>
          <div className="flex gap-1 items-center">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="px-2">Page {page} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editRow} onOpenChange={open => { if (!open) setEditRow(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Option</DialogTitle>
          </DialogHeader>
          {editRow && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Option Name</Label>
                <code className="block mt-1 text-sm font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                  {editRow.option_name}
                </code>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Value</Label>
                  {typeBadge(editRow.type)}
                </div>
                <Textarea
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  rows={8}
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Autoload</Label>
                <select
                  value={editAutoload}
                  onChange={e => setEditAutoload(e.target.value)}
                  className="h-9 border rounded-md px-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-600"
                >
                  <option value="yes">yes</option>
                  <option value="no">no</option>
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button
              disabled={updateMutation.isPending}
              onClick={() => editRow && updateMutation.mutate({
                option_name: editRow.option_name,
                option_value: editValue,
                autoload: editAutoload,
              })}
            >
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Option</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Delete <code className="font-mono text-xs">{deleteTarget}</code>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function ContentTools() {
  return (
    <div className="fade-in">
      <PageHeader
        title="Content Tools"
        description="Bulk edit posts, duplicate content, manage scheduled posts, and edit wp_options"
      />
      <div className="p-6 space-y-6">
        <Tabs defaultValue="bulk-editor">
          <TabsList className="mb-4">
            <TabsTrigger value="bulk-editor" className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Bulk Editor
            </TabsTrigger>
            <TabsTrigger value="duplicator" className="flex items-center gap-1.5">
              <Copy className="w-3.5 h-3.5" />
              Duplicator
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Scheduled
            </TabsTrigger>
            <TabsTrigger value="options" className="flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5" />
              Options Editor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bulk-editor"><BulkEditorTab /></TabsContent>
          <TabsContent value="duplicator"><DuplicatorTab /></TabsContent>
          <TabsContent value="scheduled"><ScheduledTab /></TabsContent>
          <TabsContent value="options"><OptionsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
