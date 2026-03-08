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
  Search, Trash2, Download, RefreshCw, AlertTriangle, CheckCircle2,
  Star, Palette, Upload, ArrowUpCircle, History,
} from 'lucide-react'

interface Theme {
  slug: string
  name: string
  version: string
  description: string
  author: string
  screenshot: string
  active: boolean
  is_child: boolean
  parent: string | null
  has_update: boolean
}

interface WpTheme {
  slug: string
  name: string
  version: string
  author: string
  screenshot_url: string
  rating: number
  num_ratings: number
}

export function Themes() {
  const queryClient = useQueryClient()
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [wpSearch, setWpSearch] = useState('')
  const [wpSearchQuery, setWpSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Theme | null>(null)
  const [installing, setInstalling] = useState<string | null>(null)
  const [versionsTheme, setVersionsTheme] = useState<{ slug: string; name: string } | null>(null)

  // Upload tab state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [overwrite, setOverwrite] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const { data: themesData, isLoading } = useQuery({
    queryKey: ['themes'],
    queryFn: () => api.get<{ themes: Theme[] }>('/themes'),
  })

  const { data: wpThemes, isLoading: isSearching, isError: isSearchError, error: searchError } = useQuery({
    queryKey: ['wp-themes-search', wpSearchQuery],
    queryFn: async () => {
      const url = new URL('https://api.wordpress.org/themes/info/1.2/')
      url.searchParams.set('action', 'query_themes')
      url.searchParams.set('request[search]', wpSearchQuery)
      url.searchParams.set('request[per_page]', '12')
      url.searchParams.set('request[fields][screenshot_url]', '1')
      url.searchParams.set('request[fields][rating]', '1')
      url.searchParams.set('request[fields][num_ratings]', '1')
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`WordPress.org API error: HTTP ${res.status}`)
      const data = await res.json()
      const themes: WpTheme[] = (data.themes || []).map((t: Record<string, unknown>) => {
        const rawAuthor = t.author
        const author = rawAuthor && typeof rawAuthor === 'object'
          ? ((rawAuthor as Record<string, string>).display_name || (rawAuthor as Record<string, string>).user_nicename || 'Unknown')
          : String(rawAuthor || 'Unknown')
        return {
          slug: t.slug as string,
          name: t.name as string,
          version: t.version as string,
          author,
          screenshot_url: (t.screenshot_url as string) || '',
          rating: (t.rating as number) || 0,
          num_ratings: (t.num_ratings as number) || 0,
        }
      })
      return { themes }
    },
    enabled: !!wpSearchQuery,
    retry: 1,
  })

  // Version history for selected theme
  const { data: versionsData, isLoading: isLoadingVersions } = useQuery({
    queryKey: ['theme-versions', versionsTheme?.slug],
    queryFn: async () => {
      const url = new URL('https://api.wordpress.org/themes/info/1.2/')
      url.searchParams.set('action', 'theme_information')
      url.searchParams.set('request[slug]', versionsTheme!.slug)
      url.searchParams.set('request[fields][versions]', '1')
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const versions = Object.keys(data.versions || {})
        .filter(v => v !== 'trunk')
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }))
      return { versions }
    },
    enabled: !!versionsTheme,
    staleTime: 60000,
  })

  // Map slug → theme for search-tab smart buttons
  const installedMap = useMemo(() => {
    const map = new Map<string, Theme>()
    themesData?.themes.forEach(t => map.set(t.slug, t))
    return map
  }, [themesData])

  const activateMutation = useMutation({
    mutationFn: (slug: string) => api.post('/themes/activate', { slug }),
    onSuccess: (_, slug) => {
      const name = themesData?.themes.find(t => t.slug === slug)?.name || slug
      toast.success(`Activated: ${name}`)
      queryClient.invalidateQueries({ queryKey: ['themes'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (slug: string) => api.delete('/themes/delete', { slug }),
    onSuccess: () => {
      toast.success('Theme deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['themes'] })
      setDeleteTarget(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const installMutation = useMutation({
    mutationFn: (slug: string) => {
      setInstalling(slug)
      return api.post('/themes/install', { slug })
    },
    onSuccess: (_, slug) => {
      toast.success(`Theme installed: ${slug}`)
      queryClient.invalidateQueries({ queryKey: ['themes'] })
      setInstalling(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
      setInstalling(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (slug: string) => api.post('/themes/update', { slug }),
    onSuccess: (_, slug) => {
      const name = themesData?.themes.find(t => t.slug === slug)?.name || slug
      toast.success(`Updated: ${name}`)
      queryClient.invalidateQueries({ queryKey: ['themes'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const installVersionMutation = useMutation({
    mutationFn: ({ slug, version }: { slug: string; version: string }) =>
      api.post('/themes/install-version', { slug, version }),
    onSuccess: (_, { version }) => {
      toast.success(`Theme v${version} installed`)
      queryClient.invalidateQueries({ queryKey: ['themes'] })
      setVersionsTheme(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const uploadMutation = useMutation({
    mutationFn: (fd: FormData) => api.upload('/themes/upload', fd),
    onSuccess: () => {
      toast.success('Theme uploaded and installed successfully')
      queryClient.invalidateQueries({ queryKey: ['themes'] })
      setUploadFile(null)
      setOverwrite(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const exportMutation = useMutation({
    mutationFn: (slug: string) => api.post<{ download_url: string }>('/themes/export', { slug }),
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
    if (file && file.name.endsWith('.zip')) {
      setUploadFile(file)
    } else {
      toast.error('Please drop a .zip file')
    }
  }

  const filtered = themesData?.themes.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.author.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  const updatesAvailable = themesData?.themes.filter(t => t.has_update).length ?? 0

  if (isLoading) return <PageLoader text="Loading themes..." />

  return (
    <div className="fade-in">
      <PageHeader
        title="Theme Manager"
        description={`${themesData?.themes.length || 0} themes installed${updatesAvailable > 0 ? ` · ${updatesAvailable} update${updatesAvailable > 1 ? 's' : ''} available` : ''}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['themes'] })}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        }
      />

      <div className="p-6">
        <Tabs defaultValue="installed">
          <TabsList className="mb-4">
            <TabsTrigger value="installed">Installed ({themesData?.themes.length || 0})</TabsTrigger>
            <TabsTrigger value="search">Search & Install</TabsTrigger>
            <TabsTrigger value="upload">Upload ZIP</TabsTrigger>
          </TabsList>

          {/* ── Installed ── */}
          <TabsContent value="installed" className="mt-0">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search themes..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(theme => (
                <Card key={theme.slug} className={`overflow-hidden ${theme.active ? 'ring-2 ring-blue-500' : ''}`}>
                  <div className="relative aspect-[16/9] bg-slate-100 dark:bg-slate-700">
                    {theme.screenshot ? (
                      <img
                        src={theme.screenshot}
                        alt={theme.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Palette className="w-8 h-8" />
                      </div>
                    )}
                    {theme.active && (
                      <div className="absolute top-2 left-2">
                        <Badge variant="default" className="bg-blue-600">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      </div>
                    )}
                    {theme.has_update && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="warning">Update</Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">{theme.name}</h3>
                      <span className="text-xs text-slate-400 ml-2 shrink-0">v{theme.version}</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-1">by {theme.author}</p>
                    {theme.is_child && theme.parent && (
                      <Badge variant="secondary" className="text-[10px] mb-2">Child of {theme.parent}</Badge>
                    )}

                    <div className="flex gap-1.5 mt-3">
                      {/* Update button */}
                      {theme.has_update && (
                        <Button
                          size="sm"
                          className="bg-amber-500 hover:bg-amber-600 text-white h-8 px-2"
                          onClick={() => updateMutation.mutate(theme.slug)}
                          disabled={updateMutation.isPending && updateMutation.variables === theme.slug}
                        >
                          {updateMutation.isPending && updateMutation.variables === theme.slug
                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            : <ArrowUpCircle className="w-3.5 h-3.5" />}
                          Update
                        </Button>
                      )}

                      {/* Activate / Active */}
                      {!theme.active ? (
                        <Button
                          size="sm"
                          className="flex-1 h-8"
                          onClick={() => activateMutation.mutate(theme.slug)}
                          disabled={activateMutation.isPending}
                        >
                          {activateMutation.isPending && activateMutation.variables === theme.slug
                            ? <RefreshCw className="w-3 h-3 animate-spin" />
                            : <CheckCircle2 className="w-3 h-3" />}
                          Activate
                        </Button>
                      ) : (
                        <div className={`${theme.has_update ? '' : 'flex-1'} text-center text-xs text-slate-500 dark:text-slate-400 pt-2 min-w-0`}>
                          Active
                        </div>
                      )}

                      {/* Version history button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600 shrink-0"
                        onClick={() => setVersionsTheme({ slug: theme.slug, name: theme.name })}
                        title="Version history"
                      >
                        <History className="w-3.5 h-3.5" />
                      </Button>

                      {/* Export button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-slate-700 shrink-0"
                        onClick={() => exportMutation.mutate(theme.slug)}
                        disabled={exportMutation.isPending}
                        title="Export theme as ZIP"
                      >
                        {exportMutation.isPending && exportMutation.variables === theme.slug
                          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          : <Download className="w-3.5 h-3.5" />}
                      </Button>

                      {/* Delete button */}
                      {!theme.active && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                          onClick={() => setDeleteTarget(theme)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No themes found</p>
              </div>
            )}
          </TabsContent>

          {/* ── Search & Install ── */}
          <TabsContent value="search" className="mt-0">
            <div className="mb-6">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search WordPress.org themes..."
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
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  {(searchError as Error)?.message || 'Could not reach WordPress.org. Check your internet connection.'}
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setWpSearchQuery(wpSearch)}>
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </Button>
              </div>
            )}

            {wpThemes && !isSearchError && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {wpThemes.themes.map(theme => {
                  const installed = installedMap.get(theme.slug)
                  return (
                    <Card key={theme.slug} className="overflow-hidden">
                      <div className="aspect-[16/9] bg-slate-100 dark:bg-slate-700">
                        {theme.screenshot_url ? (
                          <img src={theme.screenshot_url} alt={theme.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <Palette className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-sm mb-1 dark:text-slate-100">{theme.name}</h3>
                        <div className="flex items-center gap-1 mb-3">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          <span className="text-xs text-slate-500">{(theme.rating / 20).toFixed(1)}</span>
                          <span className="text-xs text-slate-400">v{theme.version}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-400">by {theme.author}</span>
                          {installed ? (
                            installed.has_update ? (
                              <Button
                                size="sm"
                                className="bg-amber-500 hover:bg-amber-600 text-white"
                                onClick={() => updateMutation.mutate(installed.slug)}
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
                              className="w-full"
                              onClick={() => installMutation.mutate(theme.slug)}
                              disabled={installing === theme.slug || !!installing}
                            >
                              {installing === theme.slug ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                              Install Theme
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
                <Palette className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Search for themes to install from WordPress.org</p>
              </div>
            )}
          </TabsContent>

          {/* ── Upload ZIP ── */}
          <TabsContent value="upload" className="mt-0">
            <div className="max-w-xl mx-auto space-y-5">
              <input
                type="file"
                ref={uploadInputRef}
                className="hidden"
                accept=".zip"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) setUploadFile(file)
                  e.target.value = ''
                }}
              />

              <div
                className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                  isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
                onClick={() => uploadInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <Palette className="w-10 h-10 mx-auto mb-3 text-slate-400" />
                {uploadFile ? (
                  <div>
                    <p className="font-medium text-slate-700">{uploadFile.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                    <button
                      className="mt-2 text-xs text-blue-500 hover:underline"
                      onClick={e => { e.stopPropagation(); setUploadFile(null) }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-slate-600">Drop a theme ZIP here or click to browse</p>
                    <p className="text-xs text-slate-400 mt-1">Only .zip files are accepted</p>
                  </div>
                )}
              </div>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={e => setOverwrite(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
                <div>
                  <p className="text-sm font-medium text-slate-700">Overwrite if exists</p>
                  <p className="text-xs text-slate-400">Replace theme files if the theme is already installed</p>
                </div>
              </label>

              <Button
                className="w-full"
                onClick={handleUploadSubmit}
                disabled={!uploadFile || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {uploadMutation.isPending ? 'Installing...' : 'Upload & Install Theme'}
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
              <AlertTriangle className="w-5 h-5 text-red-500" /> Delete Theme
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.slug)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              Delete Theme
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Version History Dialog ── */}
      <Dialog open={!!versionsTheme} onOpenChange={() => setVersionsTheme(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-slate-500" /> {versionsTheme?.name}
            </DialogTitle>
            <DialogDescription>
              Select a version to install. Installing an older version will downgrade the theme.
            </DialogDescription>
          </DialogHeader>

          {versionsTheme && (() => {
            const currentVer = themesData?.themes.find(t => t.slug === versionsTheme.slug)?.version
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
            <p className="text-center text-sm text-slate-400 py-6">No version history available from WordPress.org.</p>
          )}

          {versionsData && versionsData.versions.length > 0 && (
            <ScrollArea className="h-64 rounded border border-slate-100">
              <div className="p-2 space-y-0.5">
                {versionsData.versions.map(version => {
                  const currentVer = themesData?.themes.find(t => t.slug === versionsTheme?.slug)?.version
                  const isCurrent = version === currentVer
                  const isInstalling = installVersionMutation.isPending && installVersionMutation.variables?.version === version
                  return (
                    <div
                      key={version}
                      className={`flex items-center justify-between px-3 py-2 rounded-md ${
                        isCurrent ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-slate-700">v{version}</span>
                        {isCurrent && <Badge variant="secondary" className="text-[10px]">Current</Badge>}
                      </div>
                      <Button
                        size="sm"
                        variant={isCurrent ? 'outline' : 'ghost'}
                        className="h-7 text-xs"
                        disabled={isCurrent || installVersionMutation.isPending}
                        onClick={() => versionsTheme && installVersionMutation.mutate({ slug: versionsTheme.slug, version })}
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
            <Button variant="outline" onClick={() => setVersionsTheme(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
