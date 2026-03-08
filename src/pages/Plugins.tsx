import { useState, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  Search, Power, Trash2, Download, RefreshCw, AlertTriangle,
  Star, Upload, Package, ArrowUpCircle, CheckCircle2, History,
} from 'lucide-react'
import { stripHtml, truncate } from '@/lib/utils'

interface Plugin {
  file: string
  name: string
  version: string
  description: string
  author: string
  active: boolean
  has_update: boolean
}

interface WpPlugin {
  slug: string
  name: string
  version: string
  short_description: string
  author: string
  rating: number
  num_ratings: number
  downloaded: number
  icon: string
}

export function Plugins() {
  const queryClient = useQueryClient()
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [wpSearch, setWpSearch] = useState('')
  const [wpSearchQuery, setWpSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Plugin | null>(null)
  const [installing, setInstalling] = useState<string | null>(null)
  const [versionsPlugin, setVersionsPlugin] = useState<{ slug: string; name: string; file: string } | null>(null)

  // Upload tab state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [overwrite, setOverwrite] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const { data: pluginsData, isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: () => api.get<{ plugins: Plugin[] }>('/plugins'),
  })

  const { data: wpPlugins, isLoading: isSearching, isError: isSearchError, error: searchError } = useQuery({
    queryKey: ['wp-plugins-search', wpSearchQuery],
    queryFn: async () => {
      const url = new URL('https://api.wordpress.org/plugins/info/1.2/')
      url.searchParams.set('action', 'query_plugins')
      url.searchParams.set('request[search]', wpSearchQuery)
      url.searchParams.set('request[per_page]', '12')
      url.searchParams.set('request[fields][short_description]', '1')
      url.searchParams.set('request[fields][icons]', '1')
      url.searchParams.set('request[fields][rating]', '1')
      url.searchParams.set('request[fields][num_ratings]', '1')
      url.searchParams.set('request[fields][downloaded]', '1')
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`WordPress.org API error: HTTP ${res.status}`)
      const data = await res.json()
      const plugins: WpPlugin[] = (data.plugins || []).map((p: Record<string, unknown>) => ({
        slug: p.slug as string,
        name: p.name as string,
        version: p.version as string,
        short_description: p.short_description as string,
        author: p.author as string,
        rating: p.rating as number,
        num_ratings: p.num_ratings as number,
        downloaded: p.downloaded as number,
        icon: (p.icons as Record<string, string> | undefined)?.[`1x`]
          || (p.icons as Record<string, string> | undefined)?.svg
          || (p.icons as Record<string, string> | undefined)?.[`2x`]
          || '',
      }))
      return { plugins }
    },
    enabled: !!wpSearchQuery,
    retry: 1,
  })

  // Version history for selected plugin
  const { data: versionsData, isLoading: isLoadingVersions } = useQuery({
    queryKey: ['plugin-versions', versionsPlugin?.slug],
    queryFn: async () => {
      const url = new URL('https://api.wordpress.org/plugins/info/1.2/')
      url.searchParams.set('action', 'plugin_information')
      url.searchParams.set('request[slug]', versionsPlugin!.slug)
      url.searchParams.set('request[fields][versions]', '1')
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const versions = Object.keys(data.versions || {})
        .filter(v => v !== 'trunk')
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }))
      return { versions }
    },
    enabled: !!versionsPlugin,
    staleTime: 60000,
  })

  // Map slug → plugin for search-tab smart buttons
  const installedMap = useMemo(() => {
    const map = new Map<string, Plugin>()
    pluginsData?.plugins.forEach(p => {
      const slug = p.file.includes('/') ? p.file.split('/')[0] : p.file.replace('.php', '')
      map.set(slug, p)
    })
    return map
  }, [pluginsData])

  const toggleMutation = useMutation({
    mutationFn: ({ plugin, active }: { plugin: string; active: boolean }) =>
      api.post(active ? '/plugins/deactivate' : '/plugins/activate', { plugin }),
    onSuccess: (_, { active, plugin: file }) => {
      const name = pluginsData?.plugins.find(p => p.file === file)?.name || file
      toast.success(active ? `Deactivated: ${name}` : `Activated: ${name}`)
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (plugin: string) => api.delete('/plugins/delete', { plugin }),
    onSuccess: () => {
      toast.success('Plugin deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
      setDeleteTarget(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const installMutation = useMutation({
    mutationFn: (slug: string) => {
      setInstalling(slug)
      return api.post('/plugins/install', { slug })
    },
    onSuccess: (_, slug) => {
      toast.success(`Plugin installed: ${slug}`)
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
      setInstalling(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
      setInstalling(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (plugin: string) => api.post('/plugins/update', { plugin }),
    onSuccess: (_, plugin) => {
      const name = pluginsData?.plugins.find(p => p.file === plugin)?.name || plugin
      toast.success(`Updated: ${name}`)
      queryClient.refetchQueries({ queryKey: ['plugins'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const installVersionMutation = useMutation({
    mutationFn: ({ slug, version }: { slug: string; version: string }) =>
      api.post('/plugins/install-version', { slug, version }),
    onSuccess: (_, { version }) => {
      toast.success(`Plugin v${version} installed`)
      queryClient.refetchQueries({ queryKey: ['plugins'] })
      setVersionsPlugin(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const checkUpdatesMutation = useMutation({
    mutationFn: () => api.post<{ plugins: Plugin[]; total: number }>('/plugins/check-updates', {}),
    onSuccess: (data) => {
      queryClient.setQueryData(['plugins'], data)
      toast.success('Update check complete')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const uploadMutation = useMutation({
    mutationFn: (fd: FormData) => api.upload('/plugins/upload', fd),
    onSuccess: () => {
      toast.success('Plugin uploaded and installed successfully')
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
      setUploadFile(null)
      setOverwrite(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const exportMutation = useMutation({
    mutationFn: (plugin: string) => api.post<{ download_url: string }>('/plugins/export', { plugin }),
    onSuccess: (data) => { window.location.href = data.download_url },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleUploadSubmit = () => {
    if (!uploadFile) return
    const fd = new FormData()
    fd.append('file', uploadFile)
    fd.append('overwrite', overwrite ? '1' : '0')
    uploadMutation.mutate(fd)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.zip')) setUploadFile(file)
    else toast.error('Please drop a .zip file')
  }

  const filtered = pluginsData?.plugins.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.author.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  const activePlugins = filtered.filter(p => p.active)
  const inactivePlugins = filtered.filter(p => !p.active)
  const updatesAvailable = pluginsData?.plugins.filter(p => p.has_update).length ?? 0

  const openVersions = (plugin: Plugin) => {
    const slug = plugin.file.includes('/') ? plugin.file.split('/')[0] : plugin.file.replace('.php', '')
    setVersionsPlugin({ slug, name: plugin.name, file: plugin.file })
  }

  if (isLoading) return <PageLoader text="Loading plugins..." />

  return (
    <div className="fade-in">
      <PageHeader
        title="Plugin Manager"
        description={`${pluginsData?.plugins.length || 0} plugins installed${updatesAvailable > 0 ? ` · ${updatesAvailable} update${updatesAvailable > 1 ? 's' : ''} available` : ''}`}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkUpdatesMutation.mutate()}
            disabled={checkUpdatesMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 ${checkUpdatesMutation.isPending ? 'animate-spin' : ''}`} />
            {checkUpdatesMutation.isPending ? 'Checking...' : 'Check Updates'}
          </Button>
        }
      />

      <div className="p-6">
        <Tabs defaultValue="installed">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="installed">Installed ({pluginsData?.plugins.length || 0})</TabsTrigger>
              <TabsTrigger value="search">Search & Install</TabsTrigger>
              <TabsTrigger value="upload">Upload ZIP</TabsTrigger>
            </TabsList>
          </div>

          {/* ── Installed ── */}
          <TabsContent value="installed" className="mt-0">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Search plugins..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>

            <div className="space-y-4">
              {activePlugins.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Active ({activePlugins.length})</h3>
                  <div className="space-y-2">
                    {activePlugins.map(plugin => (
                      <PluginRow
                        key={plugin.file}
                        plugin={plugin}
                        onToggle={() => toggleMutation.mutate({ plugin: plugin.file, active: plugin.active })}
                        onDelete={() => setDeleteTarget(plugin)}
                        onExport={() => exportMutation.mutate(plugin.file)}
                        onUpdate={() => updateMutation.mutate(plugin.file)}
                        onVersions={() => openVersions(plugin)}
                        isTogglingPending={toggleMutation.isPending}
                        isExporting={exportMutation.isPending}
                        isUpdating={updateMutation.isPending && updateMutation.variables === plugin.file}
                      />
                    ))}
                  </div>
                </div>
              )}

              {inactivePlugins.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Inactive ({inactivePlugins.length})</h3>
                  <div className="space-y-2">
                    {inactivePlugins.map(plugin => (
                      <PluginRow
                        key={plugin.file}
                        plugin={plugin}
                        onToggle={() => toggleMutation.mutate({ plugin: plugin.file, active: plugin.active })}
                        onDelete={() => setDeleteTarget(plugin)}
                        onExport={() => exportMutation.mutate(plugin.file)}
                        onUpdate={() => updateMutation.mutate(plugin.file)}
                        onVersions={() => openVersions(plugin)}
                        isTogglingPending={toggleMutation.isPending}
                        isExporting={exportMutation.isPending}
                        isUpdating={updateMutation.isPending && updateMutation.variables === plugin.file}
                      />
                    ))}
                  </div>
                </div>
              )}

              {filtered.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No plugins found</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Search & Install ── */}
          <TabsContent value="search" className="mt-0">
            <div className="mb-6 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search WordPress.org plugins..."
                  value={wpSearch}
                  onChange={e => setWpSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && setWpSearchQuery(wpSearch)}
                  className="pl-9"
                />
              </div>
              <Button onClick={() => setWpSearchQuery(wpSearch)} disabled={!wpSearch}>
                <Search className="w-4 h-4" /> Search
              </Button>
            </div>

            {isSearching && (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                <span className="ml-2 text-slate-500">Searching WordPress.org...</span>
              </div>
            )}

            {isSearchError && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
                <p className="text-sm font-medium text-slate-700">Search failed</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">{(searchError as Error)?.message || 'Could not reach WordPress.org.'}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setWpSearchQuery(wpSearch)}>
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </Button>
              </div>
            )}

            {wpPlugins && !isSearchError && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {wpPlugins.plugins.map(plugin => {
                  const installed = installedMap.get(plugin.slug)
                  return (
                    <Card key={plugin.slug}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3 mb-3">
                          {plugin.icon ? (
                            <img src={plugin.icon} alt={plugin.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                              <Download className="w-5 h-5 text-slate-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm text-slate-900 truncate">{plugin.name}</h3>
                            <p className="text-xs text-slate-500">by {stripHtml(plugin.author)}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              <span className="text-xs text-slate-500">{(plugin.rating / 20).toFixed(1)}</span>
                              <span className="text-xs text-slate-400">({plugin.num_ratings.toLocaleString()})</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 mb-3 line-clamp-2">{stripHtml(plugin.short_description)}</p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-400">v{plugin.version}</span>
                          {installed ? (
                            installed.has_update ? (
                              <Button
                                size="sm"
                                className="bg-amber-500 hover:bg-amber-600 text-white"
                                onClick={() => updateMutation.mutate(installed.file)}
                                disabled={updateMutation.isPending}
                              >
                                {updateMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ArrowUpCircle className="w-3 h-3" />}
                                Update
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" disabled className="text-green-600 border-green-200 cursor-default">
                                <CheckCircle2 className="w-3 h-3" /> Installed
                              </Button>
                            )
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => installMutation.mutate(plugin.slug)}
                              disabled={installing === plugin.slug || !!installing}
                            >
                              {installing === plugin.slug ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                              Install
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}

            {!wpSearchQuery && !isSearching && (
              <div className="text-center py-12 text-slate-400">
                <Download className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Search for plugins to install from WordPress.org</p>
              </div>
            )}
          </TabsContent>

          {/* ── Upload ZIP ── */}
          <TabsContent value="upload" className="mt-0">
            <div className="max-w-xl mx-auto space-y-5">
              <input type="file" ref={uploadInputRef} className="hidden" accept=".zip"
                onChange={e => { const f = e.target.files?.[0]; if (f) setUploadFile(f); e.target.value = '' }} />

              <div
                className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                onClick={() => uploadInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <Package className="w-10 h-10 mx-auto mb-3 text-slate-400" />
                {uploadFile ? (
                  <div>
                    <p className="font-medium text-slate-700">{uploadFile.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                    <button className="mt-2 text-xs text-blue-500 hover:underline" onClick={e => { e.stopPropagation(); setUploadFile(null) }}>Remove</button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-slate-600">Drop a plugin ZIP here or click to browse</p>
                    <p className="text-xs text-slate-400 mt-1">Only .zip files are accepted</p>
                  </div>
                )}
              </div>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Overwrite if exists</p>
                  <p className="text-xs text-slate-400">Replace plugin files if already installed</p>
                </div>
              </label>

              <Button className="w-full" onClick={handleUploadSubmit} disabled={!uploadFile || uploadMutation.isPending}>
                {uploadMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploadMutation.isPending ? 'Installing...' : 'Upload & Install Plugin'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Delete Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" /> Delete Plugin
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.file)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete Plugin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Version History Dialog ── */}
      <Dialog open={!!versionsPlugin} onOpenChange={() => setVersionsPlugin(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-slate-500" /> {versionsPlugin?.name}
            </DialogTitle>
            <DialogDescription>
              Select a version to install. Installing an older version will downgrade the plugin.
            </DialogDescription>
          </DialogHeader>

          {versionsPlugin && (() => {
            const currentVer = pluginsData?.plugins.find(p => p.file === versionsPlugin.file)?.version
            return currentVer ? (
              <p className="text-xs text-slate-500 -mt-1">Currently installed: <strong>v{currentVer}</strong></p>
            ) : null
          })()}

          {isLoadingVersions && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
              <span className="ml-2 text-sm text-slate-500">Loading versions...</span>
            </div>
          )}

          {versionsData?.versions.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-6">No version history available.</p>
          )}

          {versionsData && versionsData.versions.length > 0 && (
            <ScrollArea className="h-64 rounded border border-slate-100">
              <div className="p-2 space-y-0.5">
                {versionsData.versions.map(version => {
                  const currentVer = pluginsData?.plugins.find(p => p.file === versionsPlugin?.file)?.version
                  const isCurrent = version === currentVer
                  const isInstalling = installVersionMutation.isPending && installVersionMutation.variables?.version === version
                  return (
                    <div key={version} className={`flex items-center justify-between px-3 py-2 rounded-md ${isCurrent ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-50'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-slate-700">v{version}</span>
                        {isCurrent && <Badge variant="secondary" className="text-[10px]">Current</Badge>}
                      </div>
                      <Button
                        size="sm"
                        variant={isCurrent ? 'outline' : 'ghost'}
                        className="h-7 text-xs"
                        disabled={isCurrent || installVersionMutation.isPending}
                        onClick={() => versionsPlugin && installVersionMutation.mutate({ slug: versionsPlugin.slug, version })}
                      >
                        {isInstalling ? <RefreshCw className="w-3 h-3 animate-spin" /> : isCurrent ? 'Installed' : 'Install'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setVersionsPlugin(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PluginRow({
  plugin, onToggle, onDelete, onExport, onUpdate, onVersions,
  isTogglingPending, isExporting, isUpdating,
}: {
  plugin: Plugin
  onToggle: () => void
  onDelete: () => void
  onExport: () => void
  onUpdate: () => void
  onVersions: () => void
  isTogglingPending: boolean
  isExporting: boolean
  isUpdating: boolean
}) {
  return (
    <div className={`flex items-center justify-between p-4 rounded-lg border bg-white hover:shadow-sm transition-shadow ${plugin.active ? 'border-slate-200' : 'border-slate-100 opacity-70'}`}>
      <div className="flex-1 min-w-0 mr-4">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-medium text-sm text-slate-900">{plugin.name}</h3>
          {plugin.active && <Badge variant="success" className="text-[10px]">Active</Badge>}
          {plugin.has_update && <Badge variant="warning" className="text-[10px]">Update</Badge>}
        </div>
        <p className="text-xs text-slate-500 truncate">{stripHtml(truncate(plugin.description, 120))}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-slate-400">v{plugin.version}</span>
          <span className="text-[10px] text-slate-300">•</span>
          <span className="text-[10px] text-slate-400">{stripHtml(plugin.author)}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {plugin.has_update && (
          <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white h-8" onClick={onUpdate} disabled={isUpdating}>
            {isUpdating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpCircle className="w-3.5 h-3.5" />}
            Update
          </Button>
        )}
        <Button variant={plugin.active ? 'outline' : 'default'} size="sm" className="h-8" onClick={onToggle} disabled={isTogglingPending}>
          <Power className="w-3.5 h-3.5" />
          {plugin.active ? 'Deactivate' : 'Activate'}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={onVersions} title="Version history">
          <History className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-700" onClick={onExport} disabled={isExporting} title="Export as ZIP">
          {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
