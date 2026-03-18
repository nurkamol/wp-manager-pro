import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  Terminal, Eye, EyeOff, RefreshCw, Save, AlertTriangle,
  CheckCircle2, FileCode2, Info, Zap, Database, Globe,
  Shield, MemoryStick, Settings2, Search, ChevronDown, ChevronRight,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ───────────────────────────────────────────────────────────────────

interface WpConfigEntry {
  name: string
  value: string | boolean | number | null
  type: 'string' | 'bool' | 'int'
  raw: string
  line: number
  group: string
}

interface WpConfigData {
  groups: {
    database: WpConfigEntry[]
    debug: WpConfigEntry[]
    salts: WpConfigEntry[]
    urls: WpConfigEntry[]
    memory: WpConfigEntry[]
    custom: WpConfigEntry[]
  }
  writable: boolean
  path: string
  size: number
}

interface HtaccessData {
  content: string
  exists: boolean
  writable: boolean
  size: number
  path: string
}

interface PhpInfoRow {
  directive: string
  local_value: string
  master_value: string
}

interface PhpInfoSection {
  title: string
  rows: PhpInfoRow[]
}

interface PhpInfoData {
  sections: PhpInfoSection[]
  php_version: string
}

interface QueryEntry {
  sql: string
  time: number
  caller: string
  slow: boolean
}

interface QueryMonitorData {
  enabled: boolean
  total_queries?: number
  total_time?: number
  slow_queries?: QueryEntry[]
  all_queries?: QueryEntry[]
  memory_peak?: string
  instructions?: string
}

interface EnvironmentData {
  type: string
  source: 'constant' | 'option'
  custom: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB'
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return bytes + ' B'
}

// ── WpConfig Tab ─────────────────────────────────────────────────────────────

function WpConfigTab() {
  const queryClient = useQueryClient()
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [editValues, setEditValues] = useState<Record<string, string | boolean | number>>({})
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    database: true,
    debug: true,
    salts: false,
    urls: true,
    memory: true,
    custom: true,
  })
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [regenLoading, setRegenLoading] = useState(false)

  const { data, isLoading } = useQuery<WpConfigData>({
    queryKey: ['dev-tools-wp-config'],
    queryFn: () => api.get('/dev-tools/wp-config'),
  })

  const saveMutation = useMutation({
    mutationFn: (params: { name: string; value: string | boolean | number; type: string }) =>
      api.post('/dev-tools/wp-config', params),
    onSuccess: (_data, vars) => {
      toast.success(`${vars.name} updated`)
      setSavingKey(null)
      queryClient.invalidateQueries({ queryKey: ['dev-tools-wp-config'] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
      setSavingKey(null)
    },
  })

  const handleSave = (entry: WpConfigEntry) => {
    const val = editValues[entry.name] !== undefined ? editValues[entry.name] : entry.value
    setSavingKey(entry.name)
    saveMutation.mutate({ name: entry.name, value: val as string | boolean | number, type: entry.type })
  }

  const handleRegenSalts = async () => {
    setRegenLoading(true)
    try {
      const res = await fetch('https://api.wordpress.org/secret-key/1.1/generate/')
      const text = await res.text()
      // Parse: define('AUTH_KEY', 'value');
      const matches = [...text.matchAll(/define\s*\(\s*'([^']+)'\s*,\s*'([^']*)'\s*\)/g)]
      if (!matches.length) {
        toast.error('Failed to parse salt response')
        setRegenLoading(false)
        return
      }
      for (const m of matches) {
        const name = m[1]
        const value = m[2]
        await api.post('/dev-tools/wp-config', { name, value, type: 'string' })
      }
      toast.success('All salts regenerated — all users will be logged out')
      queryClient.invalidateQueries({ queryKey: ['dev-tools-wp-config'] })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      toast.error('Failed to regenerate salts: ' + msg)
    }
    setRegenLoading(false)
  }

  const toggleSection = (key: string) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))

  if (isLoading) return <PageLoader text="Loading wp-config.php..." />

  if (!data) return null

  const sectionMeta: Record<string, { label: string; icon: React.ElementType; desc: string }> = {
    database: { label: 'Database', icon: Database, desc: 'Database connection settings' },
    debug: { label: 'Debug & Development', icon: Terminal, desc: 'Debugging and development flags' },
    salts: { label: 'Authentication Keys & Salts', icon: Shield, desc: 'Security keys for cookie encryption' },
    urls: { label: 'URLs & Paths', icon: Globe, desc: 'WordPress home and site URL' },
    memory: { label: 'Memory & Settings', icon: MemoryStick, desc: 'Memory limits and cache settings' },
    custom: { label: 'Custom Constants', icon: Settings2, desc: 'Other custom define() constants' },
  }

  const renderEntry = (entry: WpConfigEntry) => {
    const currentVal = editValues[entry.name] !== undefined ? editValues[entry.name] : entry.value
    const isPassword = entry.name === 'DB_PASSWORD'
    const isSalt = entry.group === 'salts'
    const isSaving = savingKey === entry.name

    if (entry.type === 'bool') {
      return (
        <div key={entry.name} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
          <div>
            <Label className="font-mono text-sm">{entry.name}</Label>
            <p className="text-xs text-slate-500 mt-0.5">Line {entry.line}</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={Boolean(currentVal)}
              onCheckedChange={val => {
                setEditValues(prev => ({ ...prev, [entry.name]: val }))
              }}
              disabled={!data.writable}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={isSaving || !data.writable}
              onClick={() => handleSave(entry)}
            >
              {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div key={entry.name} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
        <div className="w-48 shrink-0">
          <Label className="font-mono text-sm">{entry.name}</Label>
          <p className="text-xs text-slate-500 mt-0.5">Line {entry.line}</p>
        </div>
        <div className="flex-1 flex items-center gap-2">
          {isSalt ? (
            <Input
              readOnly
              value={String(currentVal ?? '')}
              className="font-mono text-xs h-8 bg-slate-50"
              title="Salt value (masked)"
            />
          ) : (
            <div className="relative flex-1">
              <Input
                type={isPassword && !showPasswords[entry.name] ? 'password' : 'text'}
                value={String(currentVal ?? '')}
                onChange={e => setEditValues(prev => ({ ...prev, [entry.name]: e.target.value }))}
                className="font-mono text-xs h-8 pr-8"
                disabled={!data.writable}
              />
              {isPassword && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPasswords(prev => ({ ...prev, [entry.name]: !prev[entry.name] }))}
                >
                  {showPasswords[entry.name] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          )}
          {!isSalt && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs shrink-0"
              disabled={isSaving || !data.writable}
              onClick={() => handleSave(entry)}
            >
              {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* File info bar */}
      <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border text-xs text-slate-600 flex-wrap">
        <span className="flex items-center gap-1.5 font-mono">{data.path}</span>
        <span>{formatBytes(data.size)}</span>
        <Badge variant={data.writable ? 'secondary' : 'destructive'} className="text-[10px]">
          {data.writable ? (
            <><CheckCircle2 className="w-2.5 h-2.5 mr-1" />Writable</>
          ) : (
            <><AlertTriangle className="w-2.5 h-2.5 mr-1" />Read-only</>
          )}
        </Badge>
      </div>

      {!data.writable && (
        <Alert variant="warning">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="text-xs">
            wp-config.php is not writable. File permissions must be updated to enable editing.
          </AlertDescription>
        </Alert>
      )}

      {(Object.keys(sectionMeta) as Array<keyof typeof sectionMeta>).map(key => {
        const entries = data.groups[key as keyof typeof data.groups] || []
        const meta = sectionMeta[key]
        const IconComp = meta.icon
        const open = openSections[key]

        return (
          <Card key={key}>
            <button
              type="button"
              className="w-full text-left"
              onClick={() => toggleSection(key)}
            >
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <IconComp className="w-4 h-4 text-slate-500" />
                    {meta.label}
                    <Badge variant="secondary" className="text-[10px] ml-1">{entries.length}</Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {key === 'salts' && open && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={regenLoading || !data.writable}
                        onClick={e => { e.stopPropagation(); handleRegenSalts() }}
                      >
                        {regenLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Regenerate All Salts
                      </Button>
                    )}
                    {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>
                {!open && <CardDescription className="text-xs">{meta.desc}</CardDescription>}
              </CardHeader>
            </button>
            {open && (
              <CardContent className="pt-0 px-4 pb-3">
                {entries.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No constants in this group</p>
                ) : (
                  <div>{entries.map(renderEntry)}</div>
                )}
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ── Htaccess Tab ──────────────────────────────────────────────────────────────

function HtaccessTab() {
  const [content, setContent] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const { data, isLoading } = useQuery<HtaccessData>({
    queryKey: ['dev-tools-htaccess'],
    queryFn: async () => {
      const res = await api.get<HtaccessData>('/dev-tools/htaccess')
      if (content === null) setContent(res.content)
      setLoaded(true)
      return res
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => api.post('/dev-tools/htaccess', { content }),
    onSuccess: () => toast.success('.htaccess saved (backup created)'),
    onError: (err: Error) => toast.error(err.message),
  })

  const handleRestoreBackup = async () => {
    try {
      const backup = await api.get<HtaccessData>('/dev-tools/htaccess?backup=1')
      setContent(backup.content)
      toast.success('Backup loaded into editor — click Save to apply')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      toast.error('No backup found: ' + msg)
    }
  }

  if (isLoading) return <PageLoader text="Loading .htaccess..." />

  return (
    <div className="space-y-4">
      {/* File info bar */}
      <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border text-xs text-slate-600 flex-wrap">
        {data && (
          <>
            <span className="font-mono">{data.path}</span>
            <span>{data.exists ? formatBytes(data.size) : 'File does not exist'}</span>
            <Badge variant={data.writable ? 'secondary' : 'destructive'} className="text-[10px]">
              {data.writable ? (
                <><CheckCircle2 className="w-2.5 h-2.5 mr-1" />Writable</>
              ) : (
                <><AlertTriangle className="w-2.5 h-2.5 mr-1" />Read-only</>
              )}
            </Badge>
          </>
        )}
      </div>

      <Alert>
        <Info className="w-4 h-4" />
        <AlertDescription className="text-xs">
          The current .htaccess will be automatically backed up to <code className="font-mono">.htaccess.wmp-backup</code> before each save.
        </AlertDescription>
      </Alert>

      {loaded && (
        <Card>
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-slate-500" />
                .htaccess Editor
              </CardTitle>
              <CardDescription className="text-xs">Apache / Nginx server configuration</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={handleRestoreBackup}
              >
                <RefreshCw className="w-3 h-3" />
                Restore Backup
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={saveMutation.isPending || !data?.writable}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save .htaccess
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <Textarea
              value={content ?? ''}
              onChange={e => setContent(e.target.value)}
              className="font-mono text-xs leading-relaxed min-h-[480px] resize-y bg-slate-50"
              placeholder="# .htaccess content here..."
              disabled={!data?.writable}
              spellCheck={false}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── PhpInfo Tab ───────────────────────────────────────────────────────────────

function PhpInfoTab() {
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  const { data, isLoading, refetch } = useQuery<PhpInfoData>({
    queryKey: ['dev-tools-phpinfo'],
    queryFn: () => api.get('/dev-tools/phpinfo'),
    enabled: loaded,
  })

  const handleLoad = () => {
    setLoaded(true)
    refetch()
  }

  const toggleSection = (title: string) =>
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }))

  const filteredSections = data?.sections.map(section => ({
    ...section,
    rows: section.rows.filter(row =>
      !search ||
      row.directive.toLowerCase().includes(search.toLowerCase()) ||
      row.local_value.toLowerCase().includes(search.toLowerCase()) ||
      row.master_value.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(s => !search || s.rows.length > 0)

  if (!loaded) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Terminal className="w-12 h-12 text-slate-300" />
        <p className="text-slate-500 text-sm">PHP Info is loaded on demand to avoid slow page load.</p>
        <Button onClick={handleLoad}>
          <Zap className="w-4 h-4" />
          Load PHP Info
        </Button>
      </div>
    )
  }

  if (isLoading) return <PageLoader text="Parsing PHP info..." />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {data && (
          <Badge variant="secondary" className="text-xs">PHP {data.php_version}</Badge>
        )}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            placeholder="Search directives..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <p className="text-xs text-slate-500">{filteredSections?.length ?? 0} sections</p>
      </div>

      <div className="space-y-2">
        {filteredSections?.map(section => {
          const open = openSections[section.title] !== false // default open
          return (
            <Card key={section.title}>
              <button
                type="button"
                className="w-full text-left"
                onClick={() => toggleSection(section.title)}
              >
                <CardHeader className="py-2.5 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {section.title}
                      <Badge variant="secondary" className="text-[10px]">{section.rows.length}</Badge>
                    </CardTitle>
                    {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </CardHeader>
              </button>
              {open && section.rows.length > 0 && (
                <CardContent className="pt-0 px-0 pb-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-slate-50 text-slate-500">
                          <th className="text-left px-4 py-2 font-medium w-1/2">Directive</th>
                          <th className="text-left px-4 py-2 font-medium w-1/4">Local Value</th>
                          <th className="text-left px-4 py-2 font-medium w-1/4">Master Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((row, i) => {
                          const differs = row.master_value && row.local_value !== row.master_value
                          return (
                            <tr
                              key={i}
                              className={cn(
                                'border-b last:border-0',
                                differs ? 'bg-amber-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                              )}
                            >
                              <td className="px-4 py-1.5 font-mono text-slate-700">{row.directive}</td>
                              <td className={cn('px-4 py-1.5 font-mono', differs && 'text-amber-700 font-medium')}>
                                {row.local_value}
                              </td>
                              <td className="px-4 py-1.5 font-mono text-slate-500">{row.master_value}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ── QueryMonitor Tab ──────────────────────────────────────────────────────────

function QueryMonitorTab() {
  const [showSlowOnly, setShowSlowOnly] = useState(false)

  const { data, isLoading, refetch } = useQuery<QueryMonitorData>({
    queryKey: ['dev-tools-query-monitor'],
    queryFn: () => api.get('/dev-tools/query-monitor'),
  })

  if (isLoading) return <PageLoader text="Loading query data..." />

  if (!data?.enabled) {
    return (
      <div className="space-y-4">
        <Alert variant="warning">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="text-sm">
            <strong>SAVEQUERIES is not enabled.</strong> {data?.instructions}
          </AlertDescription>
        </Alert>
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-slate-600 mb-3">To enable query monitoring:</p>
            <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
              <li>Go to <strong>Debug Tools</strong> in the sidebar</li>
              <li>Toggle <strong>SAVEQUERIES</strong> on</li>
              <li>Return here to see query data</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    )
  }

  const allQueries = data.all_queries ?? []
  const slowQueries = data.slow_queries ?? []
  const displayed = showSlowOnly ? slowQueries : allQueries

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Queries',
            value: data.total_queries ?? 0,
            icon: Database,
            color: 'text-blue-600',
          },
          {
            label: 'Total Time',
            value: ((data.total_time ?? 0) * 1000).toFixed(2) + 'ms',
            icon: Activity,
            color: 'text-green-600',
          },
          {
            label: 'Slow Queries',
            value: slowQueries.length,
            icon: AlertTriangle,
            color: slowQueries.length > 0 ? 'text-red-600' : 'text-slate-400',
          },
          {
            label: 'Peak Memory',
            value: data.memory_peak ?? '—',
            icon: MemoryStick,
            color: 'text-purple-600',
          },
        ].map(stat => {
          const IconComp = stat.icon
          return (
            <Card key={stat.label}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <IconComp className={cn('w-4 h-4', stat.color)} />
                  <span className="text-xs text-slate-500">{stat.label}</span>
                </div>
                <p className={cn('text-xl font-bold', stat.color)}>{stat.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Query table */}
      <Card>
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">
            {showSlowOnly ? 'Slow Queries' : 'All Queries'} ({displayed.length})
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="slow-only"
                checked={showSlowOnly}
                onCheckedChange={setShowSlowOnly}
              />
              <Label htmlFor="slow-only" className="text-xs cursor-pointer">
                Slow only (&gt;50ms)
              </Label>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => refetch()}>
              <RefreshCw className="w-3 h-3" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-0 pb-0">
          {displayed.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No queries to display</p>
            </div>
          ) : (
            <ScrollArea className="h-[420px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white border-b z-10">
                  <tr className="text-slate-500">
                    <th className="text-left px-4 py-2 font-medium w-8">#</th>
                    <th className="text-left px-4 py-2 font-medium w-24">Time</th>
                    <th className="text-left px-4 py-2 font-medium w-48">Caller</th>
                    <th className="text-left px-4 py-2 font-medium">SQL</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((q, i) => (
                    <tr
                      key={i}
                      className={cn(
                        'border-b last:border-0',
                        q.slow ? 'bg-amber-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      )}
                    >
                      <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                      <td className={cn('px-4 py-2 font-mono font-medium', q.slow ? 'text-red-600' : 'text-green-700')}>
                        {(q.time * 1000).toFixed(2)}ms
                      </td>
                      <td className="px-4 py-2 text-slate-500 font-mono max-w-0 truncate">
                        <span title={q.caller}>{q.caller.split('->').pop() || q.caller}</span>
                      </td>
                      <td className="px-4 py-2 font-mono text-slate-700 max-w-0 truncate">
                        <span title={q.sql}>{q.sql}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Environment Tab ───────────────────────────────────────────────────────────

const ENV_OPTIONS = [
  { value: 'production', label: 'Production', desc: 'Live site, real users', color: 'border-red-300 bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-100', activeColor: 'border-red-500 bg-red-100 ring-2 ring-red-400' },
  { value: 'staging', label: 'Staging', desc: 'Pre-production testing', color: 'border-orange-300 bg-orange-50 text-orange-800 hover:bg-orange-100', activeColor: 'border-orange-500 bg-orange-100 ring-2 ring-orange-400' },
  { value: 'development', label: 'Development', desc: 'Local or dev server', color: 'border-green-300 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-100', activeColor: 'border-green-500 bg-green-100 ring-2 ring-green-400' },
  { value: 'local', label: 'Local', desc: 'Your local machine', color: 'border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100', activeColor: 'border-blue-500 bg-blue-100 ring-2 ring-blue-400' },
]

function EnvironmentTab() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null)
  const [customValue, setCustomValue] = useState('')

  const { data, isLoading } = useQuery<EnvironmentData>({
    queryKey: ['dev-tools-environment'],
    queryFn: () => api.get('/dev-tools/environment'),
  })

  useEffect(() => {
    if (data && selected === null) {
      if (ENV_OPTIONS.find(o => o.value === data.type)) {
        setSelected(data.type)
      } else {
        setCustomValue(data.type)
        setSelected('custom')
      }
    }
  }, [data, selected])

  const saveMutation = useMutation({
    mutationFn: () => {
      const type = selected === 'custom' ? customValue : (selected ?? 'production')
      return api.post('/dev-tools/environment', { type })
    },
    onSuccess: () => {
      toast.success('Environment type saved')
      queryClient.invalidateQueries({ queryKey: ['dev-tools-environment'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) return <PageLoader text="Loading environment..." />

  const isConstant = data?.source === 'constant'

  const getBadgeColor = (type: string) => {
    if (type === 'production') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200'
    if (type === 'staging') return 'bg-orange-100 text-orange-700 border-orange-200'
    if (type === 'development') return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200'
    if (type === 'local') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200'
    return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200'
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Current value */}
      <div className="flex items-center gap-3">
        <p className="text-sm text-slate-600">Current environment:</p>
        <span className={cn('inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border', getBadgeColor(data?.type ?? 'production'))}>
          {data?.type ?? '—'}
        </span>
        {isConstant && (
          <Badge variant="secondary" className="text-[10px]">WP_ENVIRONMENT_TYPE constant</Badge>
        )}
      </div>

      {isConstant && (
        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription className="text-xs">
            <strong>WP_ENVIRONMENT_TYPE</strong> is defined in wp-config.php as <code className="font-mono">{data?.type}</code>. To change it, edit wp-config.php directly or use the wp-config tab above. The saved option below will be used as a fallback if the constant is removed.
          </AlertDescription>
        </Alert>
      )}

      {/* Selectable cards */}
      <div className="grid grid-cols-2 gap-3">
        {ENV_OPTIONS.map(opt => {
          const isActive = selected === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              disabled={isConstant}
              onClick={() => setSelected(opt.value)}
              className={cn(
                'p-4 rounded-xl border-2 text-left transition-all duration-150',
                isActive ? opt.activeColor : opt.color,
                isConstant && 'opacity-60 cursor-not-allowed'
              )}
            >
              <p className="font-bold text-sm">{opt.label}</p>
              <p className="text-xs mt-0.5 opacity-70">{opt.desc}</p>
            </button>
          )
        })}
      </div>

      {/* Custom input */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isConstant}
            onClick={() => setSelected('custom')}
            className={cn(
              'px-4 py-2 rounded-xl border-2 text-left transition-all duration-150 border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100',
              selected === 'custom' && 'border-purple-500 bg-purple-100 ring-2 ring-purple-400',
              isConstant && 'opacity-60 cursor-not-allowed'
            )}
          >
            <p className="font-bold text-sm">Custom</p>
            <p className="text-xs mt-0.5 opacity-70">Define a custom type</p>
          </button>
          {selected === 'custom' && (
            <Input
              value={customValue}
              onChange={e => setCustomValue(e.target.value)}
              placeholder="e.g. testing, uat, preview..."
              className="h-8 text-xs flex-1"
              disabled={isConstant}
            />
          )}
        </div>
      </div>

      <Button
        disabled={saveMutation.isPending || isConstant}
        onClick={() => saveMutation.mutate()}
        className="w-full sm:w-auto"
      >
        {saveMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save Environment
      </Button>
    </div>
  )
}

// ── Main DevTools Page ────────────────────────────────────────────────────────

export function DevTools() {
  return (
    <div className="fade-in">
      <PageHeader
        title="Dev Tools"
        description="wp-config editor, .htaccess, PHP info, and query monitor"
      />

      <div className="p-6">
        <Tabs defaultValue="wp-config">
          <TabsList className="mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="wp-config" className="text-xs gap-1.5">
              <Settings2 className="w-3.5 h-3.5" />
              wp-config.php
            </TabsTrigger>
            <TabsTrigger value="htaccess" className="text-xs gap-1.5">
              <FileCode2 className="w-3.5 h-3.5" />
              .htaccess
            </TabsTrigger>
            <TabsTrigger value="phpinfo" className="text-xs gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              PHP Info
            </TabsTrigger>
            <TabsTrigger value="query-monitor" className="text-xs gap-1.5">
              <Database className="w-3.5 h-3.5" />
              Query Monitor
            </TabsTrigger>
            <TabsTrigger value="environment" className="text-xs gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              Environment
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wp-config">
            <WpConfigTab />
          </TabsContent>

          <TabsContent value="htaccess">
            <HtaccessTab />
          </TabsContent>

          <TabsContent value="phpinfo">
            <PhpInfoTab />
          </TabsContent>

          <TabsContent value="query-monitor">
            <QueryMonitorTab />
          </TabsContent>

          <TabsContent value="environment">
            <EnvironmentTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
