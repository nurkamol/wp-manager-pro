import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Images, Trash2, RefreshCw, AlertTriangle, CheckCircle2,
  FileImage, Copy, Loader2, HardDrive, Layers, Minimize2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MediaOverview {
  total_attachments: number
  total_size: number
  total_size_human: string
  orphaned_count: number
  unused_count: number
  duplicate_groups: number
}

interface MediaItem {
  id: number
  title: string
  mime_type: string
  date: string
  url: string
  file_path?: string
  file_size?: number
  file_size_human?: string
  thumbnail?: string
}

interface OrphanedResponse {
  total: number
  items: MediaItem[]
}

interface UnusedResponse {
  total: number
  items: MediaItem[]
}

interface DuplicateGroup {
  hash: string
  count: number
  wasted_size: number
  wasted_size_human: string
  items: MediaItem[]
}

interface DuplicatesResponse {
  groups: DuplicateGroup[]
  total_groups: number
  total_wasted: number
  total_wasted_human: string
  scanned: number
}

interface CompressCandidatesResponse {
  total: number
  items: MediaItem[]
}

interface CompressResult {
  id: number
  before_size_human: string
  after_size_human: string
  saved: number
  saved_human: string
  saved_pct: number
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data, isLoading, refetch, isFetching } = useQuery<MediaOverview>({
    queryKey: ['media-overview'],
    queryFn: () => api.get('/media/overview'),
  })

  const stats = [
    { label: 'Total Attachments', value: data ? data.total_attachments.toLocaleString() : '—', icon: Images, color: 'text-blue-500' },
    { label: 'Uploads Size', value: data?.total_size_human ?? '—', icon: HardDrive, color: 'text-violet-500' },
    { label: 'Orphaned', value: data ? String(data.orphaned_count) : '—', icon: AlertTriangle, color: data?.orphaned_count ? 'text-amber-500' : 'text-slate-400', note: 'missing files' },
    { label: 'Unused', value: data ? String(data.unused_count) : '—', icon: FileImage, color: data?.unused_count ? 'text-orange-500' : 'text-slate-400', note: 'not referenced' },
    { label: 'Duplicate Groups', value: data ? String(data.duplicate_groups) : '—', icon: Layers, color: data?.duplicate_groups ? 'text-red-500' : 'text-slate-400', note: 'by file hash' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Quick overview of your WordPress media library health. Use the tabs to inspect and clean up issues.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col items-center text-center gap-1">
                  <s.icon className={`w-8 h-8 mb-1 ${s.color}`} />
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs font-medium">{s.label}</p>
                  {s.note && <p className="text-[10px] text-muted-foreground">{s.note}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">What Each Section Does</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3 text-muted-foreground">
          {[
            { icon: AlertTriangle, color: 'text-amber-500', title: 'Orphaned', desc: 'Attachments in the database whose physical file no longer exists on disk. Safe to delete.' },
            { icon: FileImage, color: 'text-orange-500', title: 'Unused', desc: "Attachments not set as a featured image and whose filename doesn't appear in any published post content." },
            { icon: Layers, color: 'text-red-500', title: 'Duplicates', desc: 'Groups of files with the same MD5 hash. Keep the oldest; delete the rest to reclaim disk space.' },
            { icon: Minimize2, color: 'text-blue-500', title: 'Compress', desc: "Re-compress existing JPEG and PNG files using WordPress's built-in image editor to reduce file size without format conversion." },
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="flex gap-3">
              <Icon className={`w-4 h-4 ${color} shrink-0 mt-0.5`} />
              <div><span className="font-medium text-foreground">{title}</span> — {desc}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Shared row checkbox helper ───────────────────────────────────────────────

function RowCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
    />
  )
}

// ─── Orphaned Tab ─────────────────────────────────────────────────────────────

function OrphanedTab() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const { data, isLoading, refetch, isFetching } = useQuery<OrphanedResponse>({
    queryKey: ['media-orphaned'],
    queryFn: () => api.get('/media/orphaned?limit=100&offset=0'),
  })

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => api.delete<{ deleted: number }>('/media/orphaned', { ids }),
    onSuccess: (res) => {
      toast.success(`Deleted ${res.deleted} orphaned attachment(s)`)
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['media-orphaned'] })
      qc.invalidateQueries({ queryKey: ['media-overview'] })
    },
    onError: () => toast.error('Delete failed'),
  })

  const items = data?.items ?? []
  const allIds = items.map((i) => i.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))

  function toggleAll() { allSelected ? setSelected(new Set()) : setSelected(new Set(allIds)) }
  function toggleOne(id: number) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Attachments whose physical file is missing from disk.
          {data && <span className="font-medium text-foreground"> {data.total} found.</span>}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Scan
          </Button>
          {selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(Array.from(selected))} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Delete {selected.size} selected
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <p className="text-sm">No orphaned attachments found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="p-3 w-10"><RowCheckbox checked={allSelected} onChange={toggleAll} /></th>
                  <th className="p-3 text-left font-medium">Title</th>
                  <th className="p-3 text-left font-medium">MIME Type</th>
                  <th className="p-3 text-left font-medium">Date</th>
                  <th className="p-3 text-left font-medium">ID</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-muted/20">
                    <td className="p-3"><RowCheckbox checked={selected.has(item.id)} onChange={() => toggleOne(item.id)} /></td>
                    <td className="p-3">
                      <p className="font-medium truncate max-w-xs">{item.title || '(no title)'}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-xs">{item.url}</p>
                    </td>
                    <td className="p-3"><Badge variant="outline" className="text-xs">{item.mime_type || 'unknown'}</Badge></td>
                    <td className="p-3 text-muted-foreground text-xs">{item.date?.slice(0, 10)}</td>
                    <td className="p-3 text-muted-foreground font-mono text-xs">{item.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Unused Tab ───────────────────────────────────────────────────────────────

function UnusedTab() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const { data, isLoading, refetch, isFetching } = useQuery<UnusedResponse>({
    queryKey: ['media-unused'],
    queryFn: () => api.get('/media/unused?limit=50&offset=0'),
  })

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => api.delete<{ deleted: number }>('/media/unused', { ids }),
    onSuccess: (res) => {
      toast.success(`Deleted ${res.deleted} unused attachment(s)`)
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['media-unused'] })
      qc.invalidateQueries({ queryKey: ['media-overview'] })
    },
    onError: () => toast.error('Delete failed'),
  })

  const items = data?.items ?? []
  const allIds = items.map((i) => i.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))

  function toggleAll() { allSelected ? setSelected(new Set()) : setSelected(new Set(allIds)) }
  function toggleOne(id: number) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const totalSize = items.filter((i) => selected.has(i.id)).reduce((acc, i) => acc + (i.file_size ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Attachments not used as featured images and not referenced in post content.
            {data && <span className="font-medium text-foreground"> {data.total} found.</span>}
          </p>
          {selected.size > 0 && totalSize > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">{selected.size} selected — {(totalSize / 1024 / 1024).toFixed(2)} MB to free</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Scan
          </Button>
          {selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(Array.from(selected))} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Delete {selected.size} selected
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <p className="text-sm">No unused attachments found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="p-3 w-10"><RowCheckbox checked={allSelected} onChange={toggleAll} /></th>
                  <th className="p-3 w-12"></th>
                  <th className="p-3 text-left font-medium">Title</th>
                  <th className="p-3 text-left font-medium">Size</th>
                  <th className="p-3 text-left font-medium">MIME</th>
                  <th className="p-3 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-muted/20">
                    <td className="p-3"><RowCheckbox checked={selected.has(item.id)} onChange={() => toggleOne(item.id)} /></td>
                    <td className="p-3">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" className="w-10 h-10 object-cover rounded border" />
                      ) : (
                        <div className="w-10 h-10 bg-muted rounded border flex items-center justify-center">
                          <FileImage className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <p className="font-medium truncate max-w-xs">{item.title || '(no title)'}</p>
                      <p className="text-xs text-muted-foreground font-mono">ID {item.id}</p>
                    </td>
                    <td className="p-3 text-muted-foreground">{item.file_size_human ?? '—'}</td>
                    <td className="p-3"><Badge variant="outline" className="text-xs">{item.mime_type?.split('/')[1] ?? '?'}</Badge></td>
                    <td className="p-3 text-muted-foreground text-xs">{item.date?.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Duplicates Tab ───────────────────────────────────────────────────────────

function DuplicatesTab() {
  const qc = useQueryClient()

  const { data, isLoading, refetch, isFetching } = useQuery<DuplicatesResponse>({
    queryKey: ['media-duplicates'],
    queryFn: () => api.get('/media/duplicates?scan_limit=300'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete<{ success: boolean }>('/media/duplicate', { id }),
    onSuccess: (_res, id) => {
      toast.success(`Deleted attachment ${id}`)
      qc.invalidateQueries({ queryKey: ['media-duplicates'] })
      qc.invalidateQueries({ queryKey: ['media-overview'] })
    },
    onError: () => toast.error('Delete failed'),
  })

  const groups = data?.groups ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Files grouped by identical MD5 hash. Keep the original (lowest ID); delete duplicates.
          {data && groups.length > 0 && (
            <span className="font-medium text-foreground"> {data.total_groups} group(s) — {data.total_wasted_human} wasted. Scanned {data.scanned} attachments.</span>
          )}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          Scan
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <p className="text-sm">No duplicate files detected</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.hash}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Copy className="w-4 h-4 text-red-500" />
                    <CardTitle className="text-sm">{group.count} identical files</CardTitle>
                    <Badge variant="destructive" className="text-xs">{group.wasted_size_human} wasted</Badge>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">MD5: {group.hash.slice(0, 12)}…</p>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {group.items.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 rounded border bg-muted/20">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" className="w-10 h-10 object-cover rounded shrink-0" />
                      ) : (
                        <div className="w-10 h-10 bg-muted rounded flex items-center justify-center shrink-0">
                          <FileImage className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title || '(no title)'}</p>
                        <p className="text-xs text-muted-foreground">{item.file_size_human} · ID {item.id} · {item.date?.slice(0, 10)}</p>
                      </div>
                      {idx === 0 ? (
                        <Badge variant="outline" className="text-xs shrink-0">Keep (original)</Badge>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteMutation.mutate(item.id)}
                          disabled={deleteMutation.isPending && deleteMutation.variables === item.id}
                        >
                          {deleteMutation.isPending && deleteMutation.variables === item.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Compress Tab ─────────────────────────────────────────────────────────────

function CompressTab() {
  const qc = useQueryClient()
  const [quality, setQuality] = useState(82)
  const [results, setResults] = useState<Record<number, CompressResult>>({})
  const [compressing, setCompressing] = useState<Set<number>>(new Set())

  const { data, isLoading, isFetching, refetch } = useQuery<CompressCandidatesResponse>({
    queryKey: ['media-compress-candidates'],
    queryFn: () => api.get('/media/compress-candidates?limit=50&offset=0'),
  })

  async function compressOne(id: number) {
    setCompressing((prev) => new Set(prev).add(id))
    try {
      const res = await api.post<CompressResult>('/media/compress', { id, quality })
      setResults((prev) => ({ ...prev, [id]: res }))
      if (res.saved > 0) {
        toast.success(`Saved ${res.saved_human} (${res.saved_pct}%)`)
      } else {
        toast.info('No size reduction achieved')
      }
      qc.invalidateQueries({ queryKey: ['media-compress-candidates'] })
    } catch {
      toast.error('Compression failed')
    } finally {
      setCompressing((prev) => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  const items = data?.items ?? []

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Compression Quality</CardTitle>
          <CardDescription>Lower quality = smaller file. Recommended: 75–85 for JPEG. PNG re-save is always lossless.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground w-16 shrink-0">Quality</span>
            <input
              type="range"
              min={40}
              max={100}
              step={1}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="flex-1 accent-blue-600"
            />
            <span className="text-sm font-mono font-bold w-8 text-right">{quality}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          JPEG and PNG attachments.
          {data && <span className="font-medium text-foreground"> {data.total} total.</span>}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <p className="text-sm">No JPEG/PNG attachments found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="p-3 w-12"></th>
                  <th className="p-3 text-left font-medium">Title</th>
                  <th className="p-3 text-left font-medium">Original Size</th>
                  <th className="p-3 text-left font-medium">Result</th>
                  <th className="p-3 text-left font-medium">Date</th>
                  <th className="p-3 w-28"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const result = results[item.id]
                  const busy = compressing.has(item.id)
                  return (
                    <tr key={item.id} className="border-b hover:bg-muted/20">
                      <td className="p-3">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt="" className="w-10 h-10 object-cover rounded border" />
                        ) : (
                          <div className="w-10 h-10 bg-muted rounded border flex items-center justify-center">
                            <FileImage className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <p className="font-medium truncate max-w-xs">{item.title || '(no title)'}</p>
                        <p className="text-xs text-muted-foreground font-mono">ID {item.id}</p>
                      </td>
                      <td className="p-3 text-muted-foreground">{item.file_size_human}</td>
                      <td className="p-3">
                        {result ? (
                          <div className="text-xs">
                            <p className="font-medium text-foreground">{result.after_size_human}</p>
                            {result.saved > 0 ? (
                              <p className="text-green-600">−{result.saved_human} ({result.saved_pct}%)</p>
                            ) : (
                              <p className="text-muted-foreground">No reduction</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{item.date?.slice(0, 10)}</td>
                      <td className="p-3">
                        <Button variant="outline" size="sm" onClick={() => compressOne(item.id)} disabled={busy}>
                          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Minimize2 className="w-4 h-4 mr-1" />}
                          Compress
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function MediaManager() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Images className="w-6 h-6 text-blue-500" />
        <div>
          <h1 className="text-2xl font-bold">Media Manager</h1>
          <p className="text-sm text-muted-foreground">Clean up your media library — orphaned files, unused attachments, duplicates, and compression</p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="orphaned">Orphaned</TabsTrigger>
          <TabsTrigger value="unused">Unused</TabsTrigger>
          <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
          <TabsTrigger value="compress">Compress</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="orphaned"><OrphanedTab /></TabsContent>
        <TabsContent value="unused"><UnusedTab /></TabsContent>
        <TabsContent value="duplicates"><DuplicatesTab /></TabsContent>
        <TabsContent value="compress"><CompressTab /></TabsContent>
      </Tabs>
    </div>
  )
}
