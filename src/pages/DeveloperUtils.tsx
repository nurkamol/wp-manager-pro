import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Webhook, Globe, Layers, Route, MemoryStick, DatabaseZap,
  Search, ChevronDown, ChevronRight, RefreshCw, AlertTriangle,
  Trash2, Plus, X, CheckCircle2, Info, Send, Play,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface HookEntry {
  hook: string
  priority: number
  callback: string
  file: string
  line: number
  args: number
}

interface RestRoute {
  path: string
  methods: string[]
  namespace: string
}

interface DummyStats {
  posts: number
  users: number
  total: number
  woo_active: boolean
}

interface CacheKey {
  key: string
  type: string
  ttl: number
}

interface PrefixTable {
  name: string
  rows: number
}

// ── Hooks Tab ─────────────────────────────────────────────────────────────────

function HooksTab() {
  const [search, setSearch] = useState('')
  const [fileFilter, setFileFilter] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [debouncedFile, setDebouncedFile] = useState('')
  const [triggered, setTriggered] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedFile(fileFilter), 400)
    return () => clearTimeout(t)
  }, [fileFilter])

  const { data, isLoading, refetch } = useQuery<{ hooks: HookEntry[]; total: number }>({
    queryKey: ['dev-hooks', debouncedSearch, debouncedFile],
    queryFn: () => {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (debouncedFile) params.set('file', debouncedFile)
      return api.get('/developer/hooks?' + params.toString())
    },
    enabled: triggered,
  })

  const priorityBadge = (p: number) => {
    if (p === 1) return 'bg-red-100 text-red-700 border-red-200'
    if (p === 10) return 'bg-blue-100 text-blue-700 border-blue-200'
    return 'bg-slate-100 text-slate-600 border-slate-200'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            placeholder="Search hook name or callback..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            placeholder="Filter by file path..."
            value={fileFilter}
            onChange={e => setFileFilter(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={() => { setTriggered(true); refetch() }}
          disabled={isLoading}
        >
          {isLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
          Search Hooks
        </Button>
      </div>

      {!triggered && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <Webhook className="w-12 h-12 opacity-30" />
          <p className="text-sm">Enter a search term or click "Search Hooks" to explore registered WordPress hooks.</p>
        </div>
      )}

      {triggered && data && (
        <>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{data.total} results</span>
            {data.total === 2000 && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-[10px]">
                <AlertTriangle className="w-2.5 h-2.5 mr-1" />
                Limit reached — refine search for more
              </Badge>
            )}
          </div>

          <Card>
            <CardContent className="pt-0 px-0 pb-0">
              <ScrollArea className="h-[500px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white border-b z-10">
                    <tr className="text-slate-500">
                      <th className="text-left px-4 py-2 font-medium w-56">Hook</th>
                      <th className="text-left px-4 py-2 font-medium w-16">Priority</th>
                      <th className="text-left px-4 py-2 font-medium">Callback</th>
                      <th className="text-left px-4 py-2 font-medium w-64">File : Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hooks.map((h, i) => (
                      <tr key={i} className={cn('border-b last:border-0', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
                        <td className="px-4 py-1.5 font-mono text-slate-700 truncate max-w-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate">{h.hook}</span>
                            </TooltipTrigger>
                            <TooltipContent className="font-mono text-xs max-w-xs break-all">{h.hook}</TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="px-4 py-1.5">
                          <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border', priorityBadge(h.priority))}>
                            {h.priority}
                          </span>
                        </td>
                        <td className="px-4 py-1.5 font-mono text-slate-600 max-w-0 truncate">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate">{h.callback}</span>
                            </TooltipTrigger>
                            <TooltipContent className="font-mono text-xs max-w-xs break-all">{h.callback}</TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="px-4 py-1.5 text-slate-400 max-w-0">
                          {h.file ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block truncate font-mono text-[10px]">
                                  {h.file}{h.line ? `:${h.line}` : ''}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="font-mono text-xs max-w-xs break-all">
                                {h.file}{h.line ? `:${h.line}` : ''}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.hooks.length === 0 && (
                  <div className="text-center py-10 text-slate-400 text-sm">No hooks match your search</div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

// ── REST Tester Tab ────────────────────────────────────────────────────────────

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
type HttpMethod = typeof HTTP_METHODS[number]

const methodColor = (m: string) => {
  if (m === 'GET') return 'bg-green-100 text-green-700 border-green-200'
  if (m === 'POST') return 'bg-blue-100 text-blue-700 border-blue-200'
  if (m === 'PUT') return 'bg-amber-100 text-amber-700 border-amber-200'
  if (m === 'PATCH') return 'bg-purple-100 text-purple-700 border-purple-200'
  if (m === 'DELETE') return 'bg-red-100 text-red-700 border-red-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

function RestTesterTab() {
  const [routeSearch, setRouteSearch] = useState('')
  const [openNs, setOpenNs] = useState<Record<string, boolean>>({})
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [path, setPath] = useState('')
  const [body, setBody] = useState('')
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([])
  const [responseOpen, setResponseOpen] = useState(false)

  const { data: routesData } = useQuery<{ routes: RestRoute[]; total: number }>({
    queryKey: ['dev-rest-routes'],
    queryFn: () => api.get('/developer/rest-routes'),
    staleTime: 30000,
  })

  const requestMutation = useMutation({
    mutationFn: () => {
      let bodyObj: Record<string, unknown> = {}
      if (body.trim()) {
        try { bodyObj = JSON.parse(body) } catch { toast.error('Invalid JSON in body'); throw new Error('Invalid JSON') }
      }
      const headersObj: Record<string, string> = {}
      headers.forEach(h => { if (h.key) headersObj[h.key] = h.value })
      return api.post('/developer/rest-request', { method, path, body: bodyObj, headers: headersObj })
    },
    onSuccess: () => setResponseOpen(true),
    onError: (err: Error) => toast.error(err.message),
  })

  const grouped = (routesData?.routes ?? []).reduce<Record<string, RestRoute[]>>((acc, r) => {
    const ns = r.namespace || 'core'
    if (!acc[ns]) acc[ns] = []
    acc[ns].push(r)
    return acc
  }, {})

  const filtered = Object.entries(grouped).reduce<Record<string, RestRoute[]>>((acc, [ns, routes]) => {
    const f = routes.filter(r => !routeSearch || r.path.toLowerCase().includes(routeSearch.toLowerCase()))
    if (f.length) acc[ns] = f
    return acc
  }, {})

  const toggleNs = (ns: string) => setOpenNs(prev => ({ ...prev, [ns]: !prev[ns] }))

  const statusBadge = (status: number) => {
    if (status >= 200 && status < 300) return 'bg-green-100 text-green-700 border-green-200'
    if (status >= 400) return 'bg-red-100 text-red-700 border-red-200'
    return 'bg-blue-100 text-blue-700 border-blue-200'
  }

  const response = requestMutation.data as { status: number; headers: Record<string, string>; body: unknown; duration_ms: number } | undefined

  return (
    <div className="flex gap-4 h-[600px]">
      {/* Route browser */}
      <Card className="w-1/3 shrink-0 flex flex-col">
        <CardHeader className="py-3 px-3 pb-2">
          <CardTitle className="text-xs text-slate-500">Route Browser</CardTitle>
          <div className="relative mt-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
            <Input
              placeholder="Search paths..."
              value={routeSearch}
              onChange={e => setRouteSearch(e.target.value)}
              className="pl-6 h-7 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-2 pb-2 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {Object.entries(filtered).map(([ns, routes]) => {
              const open = openNs[ns] !== false
              return (
                <div key={ns} className="mb-1">
                  <button
                    type="button"
                    onClick={() => toggleNs(ns)}
                    className="flex items-center gap-1 w-full text-left px-2 py-1 rounded text-[10px] font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span className="truncate font-mono">{ns}</span>
                    <span className="ml-auto text-slate-400">{routes.length}</span>
                  </button>
                  {open && routes.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setPath(r.path)
                        if (r.methods[0]) setMethod(r.methods[0] as HttpMethod)
                      }}
                      className={cn(
                        'flex items-start gap-1.5 w-full text-left px-2 py-1 rounded text-[10px] hover:bg-slate-100 transition-colors',
                        path === r.path && 'bg-blue-50 text-blue-700'
                      )}
                    >
                      <div className="flex flex-wrap gap-0.5 shrink-0 mt-0.5">
                        {r.methods.slice(0, 2).map(m => (
                          <span key={m} className={cn('px-1 rounded text-[9px] font-semibold border', methodColor(m))}>{m}</span>
                        ))}
                      </div>
                      <span className="font-mono truncate text-slate-600 flex-1">{r.path}</span>
                    </button>
                  ))}
                </div>
              )
            })}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Request builder + response */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <Card>
          <CardHeader className="py-3 px-4 pb-2">
            <CardTitle className="text-sm">Request Builder</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4 space-y-3">
            <div className="flex gap-2">
              <Select value={method} onValueChange={v => setMethod(v as HttpMethod)}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HTTP_METHODS.map(m => (
                    <SelectItem key={m} value={m}>
                      <span className={cn('text-xs font-semibold', methodColor(m).replace('border', '').trim())}>{m}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={path}
                onChange={e => setPath(e.target.value)}
                placeholder="/wp/v2/posts"
                className="h-8 text-xs font-mono flex-1"
              />
            </div>

            {method !== 'GET' && (
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Body (JSON)</label>
                <Textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder='{"key": "value"}'
                  className="font-mono text-xs h-20 resize-none"
                  spellCheck={false}
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-slate-500">Headers</label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 text-[10px] px-1"
                  onClick={() => setHeaders(prev => [...prev, { key: '', value: '' }])}
                >
                  <Plus className="w-2.5 h-2.5" /> Add Header
                </Button>
              </div>
              {headers.map((h, i) => (
                <div key={i} className="flex gap-1.5 mb-1">
                  <Input
                    value={h.key}
                    onChange={e => setHeaders(prev => prev.map((x, j) => j === i ? { ...x, key: e.target.value } : x))}
                    placeholder="X-Header"
                    className="h-7 text-xs flex-1"
                  />
                  <Input
                    value={h.value}
                    onChange={e => setHeaders(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                    placeholder="value"
                    className="h-7 text-xs flex-1"
                  />
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setHeaders(prev => prev.filter((_, j) => j !== i))}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => requestMutation.mutate()}
              disabled={requestMutation.isPending || !path}
            >
              {requestMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Send Request
            </Button>
          </CardContent>
        </Card>

        {responseOpen && response && (
          <Card className="flex-1 min-h-0">
            <CardHeader className="py-2 px-4 flex flex-row items-center gap-2">
              <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border', statusBadge(response.status))}>
                {response.status}
              </span>
              <Badge variant="outline" className="text-[10px]">{response.duration_ms}ms</Badge>
              <CardTitle className="text-xs text-slate-500 ml-auto">Response</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-3">
              <ScrollArea className="h-48">
                <pre className="text-[10px] font-mono text-slate-700 whitespace-pre-wrap break-all leading-relaxed">
                  {JSON.stringify(response.body, null, 2)}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// ── Dummy Data Tab ─────────────────────────────────────────────────────────────

function DummyDataTab() {
  const queryClient = useQueryClient()
  const [type, setType] = useState('post')
  const [count, setCount] = useState('5')
  const [generatedIds, setGeneratedIds] = useState<number[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: stats, isLoading: statsLoading } = useQuery<DummyStats>({
    queryKey: ['dev-dummy-stats'],
    queryFn: () => api.get('/developer/dummy-stats'),
  })

  const generateMutation = useMutation<{ generated: number[]; count: number; errors: string[] }, Error, void>({
    mutationFn: () => api.post('/developer/generate', { type, count: parseInt(count, 10) }),
    onSuccess: (data) => {
      setGeneratedIds(data.generated)
      if (data.errors.length) toast.warning(`Generated ${data.count} items with ${data.errors.length} error(s)`)
      else toast.success(`Generated ${data.count} dummy ${type}(s)`)
      queryClient.invalidateQueries({ queryKey: ['dev-dummy-stats'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation<{ deleted_posts: number; deleted_users: number; total: number }, Error, void>({
    mutationFn: () => api.delete('/developer/dummy'),
    onSuccess: (data) => {
      toast.success(`Deleted ${data.total} dummy items`)
      setConfirmDelete(false)
      setGeneratedIds([])
      queryClient.invalidateQueries({ queryKey: ['dev-dummy-stats'] })
    },
    onError: (err: Error) => { toast.error(err.message); setConfirmDelete(false) },
  })

  const typeOptions = [
    { value: 'post', label: 'Post' },
    { value: 'page', label: 'Page' },
    { value: 'user', label: 'User' },
    { value: 'product', label: 'WooCommerce Product', disabled: !stats?.woo_active },
  ]

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Dummy Posts', value: statsLoading ? '…' : (stats?.posts ?? 0) },
          { label: 'Dummy Users', value: statsLoading ? '…' : (stats?.users ?? 0) },
          { label: 'Total', value: statsLoading ? '…' : (stats?.total ?? 0) },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-3 pb-3 text-center">
              <p className="text-2xl font-bold text-slate-800">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Generator */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Generate Dummy Data</CardTitle>
          <CardDescription className="text-xs">Items are tagged with _wmp_dummy_data meta for easy cleanup</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {typeOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => setType(opt.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                    type === opt.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                    opt.disabled && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  {opt.label}
                  {opt.disabled && <span className="ml-1 text-[9px] text-slate-400">(inactive)</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-600">Count:</label>
              <Input
                type="number"
                value={count}
                onChange={e => setCount(e.target.value)}
                min={1}
                max={50}
                className="h-8 text-xs w-20"
              />
              <span className="text-xs text-slate-400">max 50</span>
            </div>
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              {generateMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Generate
            </Button>
          </div>

          {generatedIds.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Generated IDs:</p>
              <div className="flex flex-wrap gap-1">
                {generatedIds.map(id => (
                  <span key={id} className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 text-[10px] font-mono">
                    #{id}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete all */}
      {(stats?.total ?? 0) > 0 && (
        <Card className="border-red-200">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <p className="text-xs text-slate-600">
              <strong className="text-red-600">{stats?.total}</strong> dummy items exist in the database.
            </p>
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-xs"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="w-3 h-3" />
              Delete All Dummy Data
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All Dummy Data?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            This will permanently delete all posts, pages, products, and users tagged with <code className="font-mono text-xs bg-slate-100 px-1 rounded">_wmp_dummy_data</code>.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Rewrite Rules Tab ──────────────────────────────────────────────────────────

function RewriteTab() {
  const [testUrl, setTestUrl] = useState('')
  const [rulesOpen, setRulesOpen] = useState(false)

  const { data: allRulesData, isLoading: rulesLoading, refetch: loadRules } = useQuery<{ all_rules: { pattern: string; redirect: string }[]; total: number }>({
    queryKey: ['dev-rewrite-rules'],
    queryFn: () => api.get('/developer/rewrite-test?rules_only=1'),
    enabled: false,
  })

  const testMutation = useMutation({
    mutationFn: () => api.get<{ url: string; matched: boolean; rule: string; redirect: string; query_vars: Record<string, string>; matches: string[]; all_rules: { pattern: string; redirect: string }[] }>(`/developer/rewrite-test?url=${encodeURIComponent(testUrl)}`),
    onError: (err: Error) => toast.error(err.message),
  })

  const result = testMutation.data

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs shrink-0"
          onClick={() => { loadRules(); setRulesOpen(true) }}
          disabled={rulesLoading}
        >
          {rulesLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Load All Rules
        </Button>
        {allRulesData && (
          <Badge variant="secondary" className="text-xs">{allRulesData.total} rules loaded</Badge>
        )}
      </div>

      <Card>
        <CardHeader className="py-3 px-4 pb-2">
          <CardTitle className="text-sm">Test a URL</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex gap-2">
            <Input
              value={testUrl}
              onChange={e => setTestUrl(e.target.value)}
              placeholder="e.g. 2024/01/my-post-slug/"
              className="h-8 text-xs font-mono"
            />
            <Button
              size="sm"
              className="h-8 text-xs shrink-0"
              disabled={testMutation.isPending || !testUrl}
              onClick={() => testMutation.mutate()}
            >
              {testMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
              Test URL
            </Button>
          </div>

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {result.matched ? (
                  <Badge className="bg-green-100 text-green-700 border-green-200 border text-xs">
                    <CheckCircle2 className="w-3 h-3 mr-1" />Matched
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-700 border-red-200 border text-xs">
                    <X className="w-3 h-3 mr-1" />No Match
                  </Badge>
                )}
              </div>

              {result.matched && (
                <div className="space-y-2 text-xs">
                  <div>
                    <p className="text-slate-500 mb-0.5">Matched rule:</p>
                    <code className="font-mono bg-slate-50 px-2 py-1 rounded border text-slate-700 block break-all">{result.rule}</code>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-0.5">Redirect:</p>
                    <code className="font-mono bg-slate-50 px-2 py-1 rounded border text-slate-700 block break-all">{result.redirect}</code>
                  </div>
                  {Object.keys(result.query_vars).length > 0 && (
                    <div>
                      <p className="text-slate-500 mb-1">Resolved query vars:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(result.query_vars).map(([k, v]) => (
                          <span key={k} className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-mono">
                            {k}={v}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.matches.length > 1 && (
                    <div>
                      <p className="text-slate-500 mb-1">Captures:</p>
                      <div className="flex flex-wrap gap-1">
                        {result.matches.slice(1).map((m, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded bg-slate-50 text-slate-600 border text-[10px] font-mono">
                            [{i + 1}] {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All rules collapsible */}
      {allRulesData && (
        <Card>
          <button
            type="button"
            className="w-full text-left"
            onClick={() => setRulesOpen(o => !o)}
          >
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  All Rewrite Rules
                  <Badge variant="secondary" className="text-[10px]">{allRulesData.total}</Badge>
                </CardTitle>
                {rulesOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </div>
            </CardHeader>
          </button>
          {rulesOpen && (
            <CardContent className="pt-0 px-0 pb-0">
              <ScrollArea className="h-72">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white border-b">
                    <tr className="text-slate-500">
                      <th className="text-left px-4 py-2 font-medium w-1/2">Pattern</th>
                      <th className="text-left px-4 py-2 font-medium w-1/2">Redirect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRulesData.all_rules.map((r, i) => (
                      <tr key={i} className={cn('border-b last:border-0', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
                        <td className="px-4 py-1.5 font-mono text-slate-700 max-w-0 truncate">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate">{r.pattern}</span>
                            </TooltipTrigger>
                            <TooltipContent className="font-mono text-xs max-w-sm break-all">{r.pattern}</TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="px-4 py-1.5 font-mono text-slate-500 max-w-0 truncate">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate">{r.redirect}</span>
                            </TooltipTrigger>
                            <TooltipContent className="font-mono text-xs max-w-sm break-all">{r.redirect}</TooltipContent>
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}

// ── Cache Tab ─────────────────────────────────────────────────────────────────

function CacheTab() {
  const [prefix, setPrefix] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [triggered, setTriggered] = useState(false)

  const { data, isLoading, refetch } = useQuery<{ backend: string; keys: CacheKey[]; total: number }>({
    queryKey: ['dev-cache-keys', prefix],
    queryFn: () => api.get('/developer/cache-keys' + (prefix ? `?prefix=${encodeURIComponent(prefix)}` : '')),
    enabled: triggered,
  })

  const { data: valueData } = useQuery<{ key: string; type: string; value: unknown }>({
    queryKey: ['dev-cache-value', selectedKey],
    queryFn: () => api.get(`/developer/cache-value?key=${encodeURIComponent(selectedKey!)}`),
    enabled: !!selectedKey,
  })

  const deleteMutation = useMutation({
    mutationFn: (key: string) => api.delete(`/developer/cache-key?key=${encodeURIComponent(key)}`),
    onSuccess: (_data, key) => {
      toast.success('Cache key deleted')
      if (selectedKey === key) setSelectedKey(null)
      refetch()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const backendBadge = (b: string) => {
    if (b === 'redis') return 'bg-red-100 text-red-700 border-red-200'
    if (b === 'wp') return 'bg-blue-100 text-blue-700 border-blue-200'
    return 'bg-slate-100 text-slate-500 border-slate-200'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {data && (
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border', backendBadge(data.backend))}>
            {data.backend === 'redis' ? 'Redis' : data.backend === 'wp' ? 'WP Internal' : 'Not Available'}
          </span>
        )}
        <Input
          placeholder="Filter by prefix/key..."
          value={prefix}
          onChange={e => setPrefix(e.target.value)}
          className="h-8 text-xs flex-1 max-w-xs"
        />
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={() => { setTriggered(true); refetch() }}
          disabled={isLoading}
        >
          {isLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
          Browse Keys
        </Button>
      </div>

      {!triggered && (
        <div className="flex flex-col items-center justify-center py-14 gap-3 text-slate-400">
          <MemoryStick className="w-12 h-12 opacity-30" />
          <p className="text-sm">Click "Browse Keys" to explore the object cache.</p>
        </div>
      )}

      {triggered && data?.backend === 'none' && (
        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription className="text-xs">
            No object cache backend detected. Enable Redis or a persistent cache plugin to browse cache keys.
          </AlertDescription>
        </Alert>
      )}

      {triggered && data && data.backend !== 'none' && (
        <div className="flex gap-4">
          <Card className="flex-1">
            <CardContent className="pt-0 px-0 pb-0">
              <ScrollArea className="h-[420px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white border-b z-10">
                    <tr className="text-slate-500">
                      <th className="text-left px-4 py-2 font-medium">Key</th>
                      <th className="text-left px-4 py-2 font-medium w-20">Type</th>
                      <th className="text-left px-4 py-2 font-medium w-20">TTL</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.keys.map((k, i) => (
                      <tr
                        key={i}
                        className={cn(
                          'border-b last:border-0 cursor-pointer transition-colors',
                          selectedKey === k.key ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100'
                        )}
                        onClick={() => setSelectedKey(k.key)}
                      >
                        <td className="px-4 py-1.5 font-mono text-slate-700 max-w-0 truncate">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate">{k.key}</span>
                            </TooltipTrigger>
                            <TooltipContent className="font-mono text-xs max-w-xs break-all">{k.key}</TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="px-4 py-1.5">
                          <span className="px-1 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono">{k.type}</span>
                        </td>
                        <td className="px-4 py-1.5 text-slate-500 font-mono">
                          {k.ttl === -1 ? '∞' : k.ttl < 0 ? 'expired' : `${k.ttl}s`}
                        </td>
                        <td className="px-2 py-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                            onClick={e => { e.stopPropagation(); deleteMutation.mutate(k.key) }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.keys.length === 0 && (
                  <div className="text-center py-10 text-slate-400 text-sm">No cache keys found</div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {selectedKey && valueData && (
            <Card className="w-72 shrink-0">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs text-slate-500 truncate font-mono">{selectedKey}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <ScrollArea className="h-80">
                  <pre className="text-[10px] font-mono text-slate-700 whitespace-pre-wrap break-all leading-relaxed">
                    {typeof valueData.value === 'string'
                      ? valueData.value
                      : JSON.stringify(valueData.value, null, 2)}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// ── DB Prefix Tab ─────────────────────────────────────────────────────────────

function DbPrefixTab() {
  const queryClient = useQueryClient()
  const [newPrefix, setNewPrefix] = useState('')
  const [prefixError, setPrefixError] = useState('')
  const [tablesOpen, setTablesOpen] = useState(false)
  const [previewData, setPreviewData] = useState<{ old: string; new: string }[] | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')

  const { data, isLoading } = useQuery<{ current_prefix: string; tables: PrefixTable[]; count: number }>({
    queryKey: ['dev-prefix-info'],
    queryFn: () => api.get('/developer/prefix-info'),
  })

  const validatePrefix = (val: string) => {
    if (!val) return 'Prefix is required'
    if (!/^[a-zA-Z0-9_]+$/.test(val)) return 'Only letters, numbers, and underscores allowed'
    const normalized = val.endsWith('_') ? val : val + '_'
    if (normalized === data?.current_prefix) return 'New prefix is the same as current'
    return ''
  }

  const previewMutation = useMutation<{ preview: { old: string; new: string }[] }, Error, void>({
    mutationFn: () => {
      const err = validatePrefix(newPrefix)
      if (err) { setPrefixError(err); throw new Error(err) }
      setPrefixError('')
      return api.post('/developer/change-prefix', { new_prefix: newPrefix, dry_run: true })
    },
    onSuccess: (res) => setPreviewData(res.preview),
    onError: (err: Error) => { if (err.message !== prefixError) toast.error(err.message) },
  })

  const changeMutation = useMutation<{ success: boolean; tables_renamed: number; config_updated: boolean; errors: string[] }, Error, void>({
    mutationFn: () => api.post('/developer/change-prefix', { new_prefix: newPrefix, dry_run: false }),
    onSuccess: (res) => {
      setConfirmOpen(false)
      if (res.success) {
        toast.success(`Prefix changed! ${res.tables_renamed} tables renamed.${res.config_updated ? ' wp-config.php updated.' : ''}`)
        queryClient.invalidateQueries({ queryKey: ['dev-prefix-info'] })
        setPreviewData(null)
        setNewPrefix('')
      } else {
        toast.error(`Completed with errors: ${res.errors.join(', ')}`)
      }
    },
    onError: (err: Error) => { toast.error(err.message); setConfirmOpen(false) },
  })

  const normalizedNew = newPrefix ? (newPrefix.endsWith('_') ? newPrefix : newPrefix + '_') : ''
  const canConfirm = confirmed && confirmInput === normalizedNew

  if (isLoading) return (
    <div className="flex items-center justify-center py-16 text-slate-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" />Loading prefix info...
    </div>
  )

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Current info */}
      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border text-sm">
        <span className="text-slate-500">Current prefix:</span>
        <code className="font-mono font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border">{data?.current_prefix}</code>
        <Badge variant="secondary" className="text-[10px] ml-auto">{data?.count} tables</Badge>
      </div>

      {/* Tables collapsible */}
      <Card>
        <button type="button" className="w-full text-left" onClick={() => setTablesOpen(o => !o)}>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                Database Tables
                <Badge variant="secondary" className="text-[10px]">{data?.count}</Badge>
              </CardTitle>
              {tablesOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </div>
          </CardHeader>
        </button>
        {tablesOpen && (
          <CardContent className="pt-0 px-0 pb-0">
            <ScrollArea className="h-48">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white border-b">
                  <tr className="text-slate-500">
                    <th className="text-left px-4 py-2 font-medium">Table Name</th>
                    <th className="text-right px-4 py-2 font-medium w-24">Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.tables.map((t, i) => (
                    <tr key={i} className={cn('border-b last:border-0', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
                      <td className="px-4 py-1.5 font-mono text-slate-700">{t.name}</td>
                      <td className="px-4 py-1.5 text-right text-slate-500">{t.rows.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        )}
      </Card>

      {/* Warning */}
      <Alert variant="warning">
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription className="text-xs">
          <strong>This operation renames database tables.</strong> Back up your database before proceeding. A prefix change also updates <code className="font-mono">wp-config.php</code>.
        </AlertDescription>
      </Alert>

      {/* New prefix input */}
      <Card>
        <CardHeader className="py-3 px-4 pb-2">
          <CardTitle className="text-sm">Change Table Prefix</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <Input
                value={newPrefix}
                onChange={e => { setNewPrefix(e.target.value); setPrefixError('') }}
                placeholder="e.g. wp2_"
                className={cn('h-8 text-xs font-mono', prefixError && 'border-red-400')}
              />
              {prefixError && <p className="text-red-500 text-[10px] mt-0.5">{prefixError}</p>}
              {normalizedNew && !prefixError && (
                <p className="text-slate-500 text-[10px] mt-0.5">Will use: <code className="font-mono">{normalizedNew}</code></p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs shrink-0"
              disabled={previewMutation.isPending || !newPrefix}
              onClick={() => previewMutation.mutate()}
            >
              {previewMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Preview Changes
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-xs shrink-0"
              disabled={!previewData || changeMutation.isPending}
              onClick={() => { setConfirmed(false); setConfirmInput(''); setConfirmOpen(true) }}
            >
              <DatabaseZap className="w-3 h-3" />
              Rename Prefix
            </Button>
          </div>

          {previewData && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Preview — {previewData.length} tables would be renamed:</p>
              <ScrollArea className="h-40 border rounded">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 border-b">
                    <tr className="text-slate-500">
                      <th className="text-left px-3 py-1.5 font-medium">Old Name</th>
                      <th className="text-left px-3 py-1.5 font-medium">New Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-1 font-mono text-red-600">{row.old}</td>
                        <td className="px-3 py-1 font-mono text-green-600">{row.new}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Prefix Change</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="warning">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-xs">
                This will rename {previewData?.length ?? 0} tables and update wp-config.php. A page reload will be required after the change.
              </AlertDescription>
            </Alert>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm">I have backed up my database and understand this operation cannot be easily undone.</span>
            </label>
            <div>
              <p className="text-xs text-slate-600 mb-1">
                Type the new prefix <code className="font-mono bg-slate-100 px-1 rounded">{normalizedNew}</code> to confirm:
              </p>
              <Input
                value={confirmInput}
                onChange={e => setConfirmInput(e.target.value)}
                placeholder={normalizedNew}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!canConfirm || changeMutation.isPending}
              onClick={() => changeMutation.mutate()}
            >
              {changeMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <DatabaseZap className="w-4 h-4" />}
              Rename Prefix
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function DeveloperUtils() {
  return (
    <div className="fade-in">
      <PageHeader
        title="Developer Utilities"
        description="Hook explorer, REST tester, dummy data, rewrite rules, cache browser, DB prefix changer"
      />

      <div className="p-6">
        <Tabs defaultValue="hooks">
          <TabsList className="mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="hooks" className="text-xs gap-1.5">
              <Webhook className="w-3.5 h-3.5" />
              Hooks
            </TabsTrigger>
            <TabsTrigger value="rest" className="text-xs gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              REST Tester
            </TabsTrigger>
            <TabsTrigger value="dummy" className="text-xs gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Dummy Data
            </TabsTrigger>
            <TabsTrigger value="rewrite" className="text-xs gap-1.5">
              <Route className="w-3.5 h-3.5" />
              Rewrite Rules
            </TabsTrigger>
            <TabsTrigger value="cache" className="text-xs gap-1.5">
              <MemoryStick className="w-3.5 h-3.5" />
              Cache
            </TabsTrigger>
            <TabsTrigger value="prefix" className="text-xs gap-1.5">
              <DatabaseZap className="w-3.5 h-3.5" />
              DB Prefix
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hooks">
            <HooksTab />
          </TabsContent>
          <TabsContent value="rest">
            <RestTesterTab />
          </TabsContent>
          <TabsContent value="dummy">
            <DummyDataTab />
          </TabsContent>
          <TabsContent value="rewrite">
            <RewriteTab />
          </TabsContent>
          <TabsContent value="cache">
            <CacheTab />
          </TabsContent>
          <TabsContent value="prefix">
            <DbPrefixTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
