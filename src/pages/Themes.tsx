import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { Search, Trash2, Download, RefreshCw, AlertTriangle, CheckCircle2, Star, Palette } from 'lucide-react'

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
  const [search, setSearch] = useState('')
  const [wpSearch, setWpSearch] = useState('')
  const [wpSearchQuery, setWpSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Theme | null>(null)
  const [installing, setInstalling] = useState<string | null>(null)

  const { data: themesData, isLoading } = useQuery({
    queryKey: ['themes'],
    queryFn: () => api.get<{ themes: Theme[] }>('/themes'),
  })

  const { data: wpThemes, isLoading: isSearching } = useQuery({
    queryKey: ['wp-themes-search', wpSearchQuery],
    queryFn: () => api.get<{ themes: WpTheme[] }>(`/themes/search?q=${encodeURIComponent(wpSearchQuery)}`),
    enabled: !!wpSearchQuery,
  })

  const activateMutation = useMutation({
    mutationFn: (slug: string) => api.post('/themes/activate', { slug }),
    onSuccess: () => {
      toast.success('Theme activated successfully')
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

  const filtered = themesData?.themes.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.author.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  if (isLoading) return <PageLoader text="Loading themes..." />

  return (
    <div className="fade-in">
      <PageHeader
        title="Theme Manager"
        description={`${themesData?.themes.length || 0} themes installed`}
      />

      <div className="p-6">
        <Tabs defaultValue="installed">
          <TabsList className="mb-4">
            <TabsTrigger value="installed">Installed ({themesData?.themes.length || 0})</TabsTrigger>
            <TabsTrigger value="search">Search & Install</TabsTrigger>
          </TabsList>

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
                  <div className="relative aspect-[16/9] bg-slate-100">
                    {theme.screenshot ? (
                      <img
                        src={theme.screenshot}
                        alt={theme.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Trash2 className="w-8 h-8" />
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
                      <h3 className="font-semibold text-sm text-slate-900">{theme.name}</h3>
                      <span className="text-xs text-slate-400 ml-2 shrink-0">v{theme.version}</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-1">by {theme.author}</p>
                    {theme.is_child && theme.parent && (
                      <Badge variant="secondary" className="text-[10px] mb-2">Child of {theme.parent}</Badge>
                    )}
                    <div className="flex gap-2 mt-3">
                      {!theme.active && (
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => activateMutation.mutate(theme.slug)}
                          disabled={activateMutation.isPending}
                        >
                          {activateMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          Activate
                        </Button>
                      )}
                      {theme.active && (
                        <div className="flex-1 text-center text-xs text-slate-500 pt-2">Currently Active</div>
                      )}
                      {!theme.active && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
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
          </TabsContent>

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

            {wpThemes && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {wpThemes.themes.map(theme => (
                  <Card key={theme.slug} className="overflow-hidden">
                    <div className="aspect-[16/9] bg-slate-100">
                      {theme.screenshot_url ? (
                        <img src={theme.screenshot_url} alt={theme.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Palette className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm mb-1">{theme.name}</h3>
                      <div className="flex items-center gap-1 mb-3">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-xs text-slate-500">{(theme.rating / 20).toFixed(1)}</span>
                        <span className="text-xs text-slate-400">v{theme.version}</span>
                      </div>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => installMutation.mutate(theme.slug)}
                        disabled={installing === theme.slug || !!installing}
                      >
                        {installing === theme.slug ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        Install Theme
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!wpSearchQuery && !isSearching && (
              <div className="text-center py-12 text-slate-400">
                <Palette className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Search for themes to install from WordPress.org</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

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
    </div>
  )
}
