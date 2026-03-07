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
import { Search, Power, Trash2, Download, RefreshCw, AlertTriangle, Star } from 'lucide-react'
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
  const [search, setSearch] = useState('')
  const [wpSearch, setWpSearch] = useState('')
  const [wpSearchQuery, setWpSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Plugin | null>(null)
  const [installing, setInstalling] = useState<string | null>(null)

  const { data: pluginsData, isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: () => api.get<{ plugins: Plugin[] }>('/plugins'),
  })

  const { data: wpPlugins, isLoading: isSearching } = useQuery({
    queryKey: ['wp-plugins-search', wpSearchQuery],
    queryFn: () => api.get<{ plugins: WpPlugin[] }>(`/plugins/search?q=${encodeURIComponent(wpSearchQuery)}`),
    enabled: !!wpSearchQuery,
  })

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
      toast.success(`Plugin deleted successfully`)
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

  const filtered = pluginsData?.plugins.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.author.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  const activePlugins = filtered.filter(p => p.active)
  const inactivePlugins = filtered.filter(p => !p.active)

  if (isLoading) return <PageLoader text="Loading plugins..." />

  return (
    <div className="fade-in">
      <PageHeader
        title="Plugin Manager"
        description={`${pluginsData?.plugins.length || 0} plugins installed`}
        actions={
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['plugins'] })}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        }
      />

      <div className="p-6">
        <Tabs defaultValue="installed">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="installed">
                Installed ({pluginsData?.plugins.length || 0})
              </TabsTrigger>
              <TabsTrigger value="search">Search & Install</TabsTrigger>
            </TabsList>
          </div>

          {/* Installed Plugins Tab */}
          <TabsContent value="installed" className="mt-0">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search plugins..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-4">
              {activePlugins.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Active ({activePlugins.length})
                  </h3>
                  <div className="space-y-2">
                    {activePlugins.map(plugin => (
                      <PluginRow
                        key={plugin.file}
                        plugin={plugin}
                        onToggle={() => toggleMutation.mutate({ plugin: plugin.file, active: plugin.active })}
                        onDelete={() => setDeleteTarget(plugin)}
                        isLoading={toggleMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}

              {inactivePlugins.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Inactive ({inactivePlugins.length})
                  </h3>
                  <div className="space-y-2">
                    {inactivePlugins.map(plugin => (
                      <PluginRow
                        key={plugin.file}
                        plugin={plugin}
                        onToggle={() => toggleMutation.mutate({ plugin: plugin.file, active: plugin.active })}
                        onDelete={() => setDeleteTarget(plugin)}
                        isLoading={toggleMutation.isPending}
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

          {/* Search Tab */}
          <TabsContent value="search" className="mt-0">
            <div className="mb-6">
              <div className="flex gap-2">
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
            </div>

            {isSearching && (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                <span className="ml-2 text-slate-500">Searching WordPress.org...</span>
              </div>
            )}

            {wpPlugins && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {wpPlugins.plugins.map(plugin => (
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
                      <p className="text-xs text-slate-600 mb-3 line-clamp-2">
                        {stripHtml(plugin.short_description)}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">v{plugin.version}</span>
                        <Button
                          size="sm"
                          onClick={() => installMutation.mutate(plugin.slug)}
                          disabled={installing === plugin.slug || !!installing}
                        >
                          {installing === plugin.slug ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                          Install
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!wpSearchQuery && !isSearching && (
              <div className="text-center py-12 text-slate-400">
                <Download className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Search for plugins to install from WordPress.org</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Delete Plugin
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.file)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete Plugin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PluginRow({ plugin, onToggle, onDelete, isLoading }: {
  plugin: Plugin
  onToggle: () => void
  onDelete: () => void
  isLoading: boolean
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
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant={plugin.active ? 'outline' : 'default'}
          size="sm"
          onClick={onToggle}
          disabled={isLoading}
        >
          <Power className="w-3.5 h-3.5" />
          {plugin.active ? 'Deactivate' : 'Activate'}
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
