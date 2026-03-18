import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Puzzle, Palette, Users, FileText, Database, Server,
  AlertTriangle, CheckCircle2, RefreshCw, ArrowRight,
  Construction, Bug, HardDrive, Upload, Image, Code2, Mail, ArchiveRestore,
  Settings2, Wifi, WifiOff, ShieldCheck, Layers, X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { timeAgo } from '@/lib/utils'
import { useState } from 'react'
import { useWidgetConfig, WIDGET_META } from '@/hooks/useWidgetConfig'

interface DashboardData {
  site: {
    name: string
    url: string
    wp: string
    php: string
    debug: boolean
    maintenance: boolean
  }
  counts: {
    posts: number
    pages: number
    plugins: number
    active_plugins: number
    themes: number
    users: number
  }
  updates: {
    plugins: number
    themes: number
    core: string | false
  }
  system: {
    memory_limit: string
    upload_max: string
    max_exec_time: string
    db_size: number
    uploads_size: string
  }
  active_theme: string
  recent_posts: Array<{ id: number; title: string; date: string; url: string }>
}

interface UptimeData {
  ok: boolean
  code: number
  ms: number
  url: string
  error: string | null
}

interface WidgetsData {
  audit: Array<{
    action: string
    object_type: string
    object_name: string
    user_login: string
    created_at: string
  }>
  cache: {
    enabled: boolean
    transient_count: number
  }
}

export function Dashboard() {
  const navigate = useNavigate()
  const [customizing, setCustomizing] = useState(false)
  const { config, toggle, isVisible } = useWidgetConfig()

  const { data, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard'),
    refetchInterval: 30000,
  })

  const { data: uptime, isLoading: uptimeLoading } = useQuery<UptimeData>({
    queryKey: ['dashboard-uptime'],
    queryFn: () => api.get('/dashboard/uptime'),
    refetchInterval: 60000,
    enabled: isVisible('uptime'),
    retry: false,
  })

  const { data: widgets } = useQuery<WidgetsData>({
    queryKey: ['dashboard-widgets'],
    queryFn: () => api.get('/dashboard/widgets'),
    refetchInterval: 60000,
    enabled: isVisible('recentAudit') || isVisible('cacheStatus'),
  })

  if (isLoading) return <PageLoader text="Loading dashboard..." />

  const totalUpdates = (data?.updates.plugins || 0) + (data?.updates.themes || 0) + (data?.updates.core ? 1 : 0)

  return (
    <div className="fade-in">
      <PageHeader
        title={`Welcome to ${data?.site.name || 'WP Manager Pro'}`}
        description={data?.site.url}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <Button
              variant={customizing ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCustomizing(v => !v)}
              className="gap-1.5 h-8 text-xs"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Customize
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">

        {/* Widget Customizer Panel */}
        {customizing && (
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Settings2 className="w-4 h-4" />
                  Customize Dashboard Widgets
                </CardTitle>
                <button onClick={() => setCustomizing(false)}>
                  <X className="w-4 h-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {WIDGET_META.map(w => (
                  <button
                    key={w.id}
                    onClick={() => toggle(w.id)}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      config[w.id]
                        ? 'border-blue-400 bg-white dark:bg-blue-900/40 dark:border-blue-500'
                        : 'border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-transparent opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{w.label}</span>
                      <div className={`w-3 h-3 rounded-full border-2 ${config[w.id] ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600'}`} />
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">{w.description}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alerts */}
        {(data?.site.maintenance || data?.site.debug || totalUpdates > 0) && (
          <div className="space-y-2">
            {data?.site.maintenance && (
              <Alert variant="warning">
                <Construction className="h-4 w-4" />
                <AlertDescription>
                  <strong>Maintenance mode is active.</strong> Your site is currently showing a maintenance page to visitors.
                  <button onClick={() => navigate('/maintenance')} className="ml-2 text-yellow-700 underline text-sm">Manage →</button>
                </AlertDescription>
              </Alert>
            )}
            {data?.site.debug && (
              <Alert variant="warning">
                <Bug className="h-4 w-4" />
                <AlertDescription>
                  <strong>Debug mode is enabled.</strong> This should only be used in development environments.
                  <button onClick={() => navigate('/debug')} className="ml-2 text-yellow-700 underline text-sm">Manage →</button>
                </AlertDescription>
              </Alert>
            )}
            {totalUpdates > 0 && (
              <Alert>
                <RefreshCw className="h-4 w-4" />
                <AlertDescription>
                  <strong>{totalUpdates} update{totalUpdates > 1 ? 's' : ''} available.</strong>{' '}
                  {data?.updates.core && <span>WordPress {data.updates.core} is available. </span>}
                  {data?.updates.plugins! > 0 && <span>{data?.updates.plugins} plugin update{data?.updates.plugins! > 1 ? 's' : ''}. </span>}
                  {data?.updates.themes! > 0 && <span>{data?.updates.themes} theme update{data?.updates.themes! > 1 ? 's' : ''}. </span>}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Quick Stats */}
        {isVisible('quickStats') && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {[
              { label: 'Posts',   value: data?.counts.posts,  icon: FileText, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950',    to: null },
              { label: 'Pages',   value: data?.counts.pages,  icon: FileText, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950', to: null },
              { label: 'Plugins', value: `${data?.counts.active_plugins}/${data?.counts.plugins}`, icon: Puzzle,  color: 'text-violet-500 bg-violet-50 dark:bg-violet-950', to: '/plugins', badge: data?.updates.plugins || 0 },
              { label: 'Themes',  value: data?.counts.themes, icon: Palette,  color: 'text-pink-500 bg-pink-50 dark:bg-pink-950',      to: '/themes',  badge: data?.updates.themes || 0 },
              { label: 'Users',   value: data?.counts.users,  icon: Users,    color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950', to: '/users' },
              { label: 'DB Size', value: `${data?.system.db_size} MB`, icon: Database, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950', to: '/database' },
            ].map((stat) => (
              <Card
                key={stat.label}
                className={stat.to ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
                onClick={() => stat.to && navigate(stat.to)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className={`p-2 rounded-lg ${stat.color}`}>
                      <stat.icon className="w-4 h-4" />
                    </div>
                    {stat.badge ? (
                      <Badge variant="warning" className="text-[10px] px-1.5 py-0">{stat.badge}</Badge>
                    ) : null}
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Row: Site Status + System Resources + Recent Posts */}
        {(isVisible('siteStatus') || isVisible('systemResources') || isVisible('recentPosts')) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {isVisible('siteStatus') && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Site Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: 'WordPress',    value: `v${data?.site.wp}`,              ok: true },
                    { label: 'PHP',          value: `v${data?.site.php}`,             ok: true },
                    { label: 'Active Theme', value: data?.active_theme,               ok: true },
                    { label: 'Debug Mode',   value: data?.site.debug ? 'Enabled' : 'Disabled', ok: !data?.site.debug },
                    { label: 'Maintenance',  value: data?.site.maintenance ? 'Active' : 'Off',  ok: !data?.site.maintenance },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-1 border-b border-slate-50 dark:border-slate-800 last:border-0">
                      <span className="text-sm text-slate-600 dark:text-slate-400">{item.label}</span>
                      <div className="flex items-center gap-1.5">
                        {item.ok
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        }
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.value}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {isVisible('systemResources') && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">System Resources</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: 'Memory Limit',  value: data?.system.memory_limit,            icon: Server },
                    { label: 'Upload Max',    value: data?.system.upload_max,              icon: Upload },
                    { label: 'Max Exec Time', value: `${data?.system.max_exec_time}s`,     icon: RefreshCw },
                    { label: 'Database Size', value: `${data?.system.db_size} MB`,         icon: Database },
                    { label: 'Uploads Size',  value: data?.system.uploads_size,            icon: HardDrive },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-1 border-b border-slate-50 dark:border-slate-800 last:border-0">
                      <div className="flex items-center gap-2">
                        <item.icon className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">{item.label}</span>
                      </div>
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {isVisible('recentPosts') && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Recent Posts</CardTitle>
                </CardHeader>
                <CardContent>
                  {data?.recent_posts.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No posts yet</p>
                  ) : (
                    <div className="space-y-2">
                      {data?.recent_posts.map((post) => (
                        <a
                          key={post.id}
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between py-1.5 group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate group-hover:text-blue-600 transition-colors">
                              {post.title || '(No title)'}
                            </p>
                            <p className="text-xs text-slate-400">{timeAgo(post.date)}</p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0 ml-2" />
                        </a>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Row: Uptime + Cache Status + Recent Audit */}
        {(isVisible('uptime') || isVisible('cacheStatus') || isVisible('recentAudit')) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {isVisible('uptime') && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Wifi className="w-4 h-4" />
                    Uptime Ping
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {uptimeLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                      <RefreshCw className="w-4 h-4 animate-spin" /> Checking…
                    </div>
                  ) : uptime ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        {uptime.ok
                          ? <><Wifi className="w-5 h-5 text-green-500" /><span className="text-base font-semibold text-green-600 dark:text-green-400">Online</span></>
                          : <><WifiOff className="w-5 h-5 text-red-500" /><span className="text-base font-semibold text-red-600 dark:text-red-400">Offline</span></>
                        }
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Response code</span>
                          <span className={`font-mono font-medium ${uptime.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{uptime.code || '—'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Response time</span>
                          <span className={`font-mono font-medium ${uptime.ms < 500 ? 'text-green-600 dark:text-green-400' : uptime.ms < 1500 ? 'text-amber-500' : 'text-red-500'}`}>
                            {uptime.ms} ms
                          </span>
                        </div>
                        {uptime.error && (
                          <p className="text-xs text-red-500 mt-1">{uptime.error}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 py-2">Could not reach site.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {isVisible('cacheStatus') && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Cache Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between py-1 border-b border-slate-50 dark:border-slate-800">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Object Cache</span>
                    <div className="flex items-center gap-1.5">
                      {widgets?.cache.enabled
                        ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /><span className="text-sm font-medium text-green-600 dark:text-green-400">Active</span></>
                        : <><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /><span className="text-sm font-medium text-amber-600 dark:text-amber-400">Inactive</span></>
                      }
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Transients stored</span>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200 font-mono">{widgets?.cache.transient_count ?? '—'}</span>
                  </div>
                  {!widgets?.cache.enabled && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Consider a Redis / Memcached object cache plugin for better performance.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {isVisible('recentAudit') && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      Recent Audit Events
                    </CardTitle>
                    <button onClick={() => navigate('/audit-log')} className="text-xs text-blue-500 hover:text-blue-600 transition-colors">View all →</button>
                  </div>
                </CardHeader>
                <CardContent>
                  {!widgets?.audit?.length ? (
                    <p className="text-sm text-slate-400 text-center py-4">No audit events yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {widgets.audit.map((ev, i) => (
                        <div key={i} className="flex items-start gap-2 py-1 border-b border-slate-50 dark:border-slate-800 last:border-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                              <span className="text-slate-400 mr-1">{ev.user_login}</span>
                              {ev.action} {ev.object_type}
                              {ev.object_name && <span className="text-slate-500 dark:text-slate-400"> — {ev.object_name}</span>}
                            </p>
                            <p className="text-[10px] text-slate-400">{timeAgo(ev.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Quick Actions */}
        {isVisible('quickActions') && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Manage Plugins', icon: Puzzle,        to: '/plugins',     desc: 'Install & manage plugins' },
                  { label: 'Manage Themes',  icon: Palette,       to: '/themes',      desc: 'Install & manage themes' },
                  { label: 'File Manager',   icon: FileText,      to: '/file-manager',desc: 'Browse & edit files' },
                  { label: 'Database',       icon: Database,      to: '/database',    desc: 'Search & replace' },
                  { label: 'User Manager',   icon: Users,         to: '/users',       desc: 'Manage users & roles' },
                  { label: 'Code Snippets',  icon: Code2,         to: '/snippets',    desc: 'PHP, CSS & JS snippets' },
                  { label: 'Image Tools',    icon: Image,         to: '/images',      desc: 'WebP, AVIF & thumbnails' },
                  { label: 'Email / SMTP',   icon: Mail,          to: '/email',       desc: 'Configure & test SMTP' },
                  { label: 'Backup',         icon: ArchiveRestore,to: '/backup',      desc: 'Database backups' },
                  { label: 'Maintenance',    icon: Construction,  to: '/maintenance', desc: 'Toggle maintenance mode' },
                  { label: 'Debug Tools',    icon: Bug,           to: '/debug',       desc: 'WP_DEBUG & error log' },
                  { label: 'System Info',    icon: Server,        to: '/system',      desc: 'PHP & server info' },
                ].map((action) => (
                  <button
                    key={action.to}
                    onClick={() => navigate(action.to)}
                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:bg-blue-50 dark:hover:border-blue-700 dark:hover:bg-blue-950/40 transition-all text-left group"
                  >
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                      <action.icon className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-700 dark:group-hover:text-blue-400">{action.label}</p>
                      <p className="text-xs text-slate-400">{action.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  )
}
