import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CheckCircle2, XCircle, RefreshCw, Copy } from 'lucide-react'
import { toast } from 'sonner'

interface SystemInfo {
  wordpress: Record<string, unknown>
  php: Record<string, unknown> & { extensions: string[] }
  database: Record<string, unknown>
  server: Record<string, unknown>
  constants: Record<string, string>
  active_plugins: Array<{ name: string; version: string; file: string }>
  cron: Array<{ hook: string; schedule: string; next_run: string }>
}

function InfoRow({ label, value, mono = false }: { label: string; value: unknown; mono?: boolean }) {
  const displayValue = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value ?? 'N/A')
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 text-sm">
      <span className="text-slate-600 shrink-0 mr-4">{label}</span>
      <span className={`font-medium text-slate-800 truncate ${mono ? 'font-mono text-xs' : ''}`} title={displayValue}>
        {displayValue}
      </span>
    </div>
  )
}

function StatusRow({ label, value }: { label: string; value: unknown }) {
  const isTrue = value === true || value === 1 || value === '1' || value === 'true'
  const isFalse = value === false || value === 0 || value === '0' || value === 'false'

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 text-sm">
      <span className="text-slate-600">{label}</span>
      <div className="flex items-center gap-1.5">
        {isTrue ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : null}
        {isFalse ? <XCircle className="w-3.5 h-3.5 text-slate-300" /> : null}
        <span className={`font-medium text-xs ${isTrue ? 'text-green-700' : isFalse ? 'text-slate-400' : 'text-slate-700'}`}>
          {isTrue ? 'Enabled' : isFalse ? 'Disabled' : String(value ?? 'N/A')}
        </span>
      </div>
    </div>
  )
}

export function SystemInfo() {
  const { data, isLoading, refetch } = useQuery<SystemInfo>({
    queryKey: ['system-info'],
    queryFn: () => api.get('/system'),
    staleTime: 60000,
  })

  const copyToClipboard = () => {
    const text = JSON.stringify(data, null, 2)
    navigator.clipboard.writeText(text).then(() => {
      toast.success('System info copied to clipboard')
    })
  }

  if (isLoading) return <PageLoader text="Loading system information..." />

  return (
    <div className="fade-in">
      <PageHeader
        title="System Information"
        description="WordPress, PHP, and server environment details"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyToClipboard}>
              <Copy className="w-4 h-4" /> Copy All
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
          </div>
        }
      />

      <div className="p-6">
        <Tabs defaultValue="wordpress">
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="wordpress">WordPress</TabsTrigger>
            <TabsTrigger value="php">PHP</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="server">Server</TabsTrigger>
            <TabsTrigger value="constants">Constants</TabsTrigger>
            <TabsTrigger value="plugins">Active Plugins</TabsTrigger>
            <TabsTrigger value="cron">Cron Jobs</TabsTrigger>
          </TabsList>

          {/* WordPress Tab */}
          <TabsContent value="wordpress" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">WordPress Core</CardTitle></CardHeader>
                <CardContent>
                  {data?.wordpress && Object.entries(data.wordpress)
                    .filter(([k]) => !['debug', 'debug_log', 'debug_display'].includes(k))
                    .map(([key, val]) => (
                      <InfoRow key={key} label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} value={val} />
                    ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Debug Settings</CardTitle></CardHeader>
                <CardContent>
                  {data?.wordpress && ['debug', 'debug_log', 'debug_display'].map(key => (
                    <StatusRow key={key} label={`WP_${key.toUpperCase()}`} value={(data.wordpress as any)[key]} />
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* PHP Tab */}
          <TabsContent value="php" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">PHP Configuration</CardTitle></CardHeader>
                <CardContent>
                  {data?.php && Object.entries(data.php)
                    .filter(([k]) => !['extensions', 'curl', 'gd', 'imagick', 'mbstring', 'openssl', 'zip', 'intl', 'opcache'].includes(k))
                    .map(([key, val]) => (
                      <InfoRow key={key} label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} value={val} mono={key === 'disabled_funcs'} />
                    ))}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">PHP Extensions</CardTitle></CardHeader>
                  <CardContent>
                    {[
                      { key: 'curl', label: 'cURL' },
                      { key: 'gd', label: 'GD Library' },
                      { key: 'imagick', label: 'ImageMagick' },
                      { key: 'mbstring', label: 'mbstring' },
                      { key: 'openssl', label: 'OpenSSL' },
                      { key: 'zip', label: 'ZIP' },
                      { key: 'intl', label: 'Intl' },
                      { key: 'opcache', label: 'OPcache' },
                    ].map(({ key, label }) => (
                      <StatusRow key={key} label={label} value={(data?.php as any)?.[key]} />
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">All Extensions ({data?.php?.extensions?.length || 0})</CardTitle></CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <div className="flex flex-wrap gap-1.5">
                        {data?.php?.extensions?.sort().map((ext: string) => (
                          <Badge key={ext} variant="secondary" className="text-[10px] font-mono">{ext}</Badge>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Database Tab */}
          <TabsContent value="database" className="mt-0">
            <Card className="max-w-lg">
              <CardHeader className="pb-3"><CardTitle className="text-sm">Database Configuration</CardTitle></CardHeader>
              <CardContent>
                {data?.database && Object.entries(data.database).map(([key, val]) => (
                  <InfoRow key={key} label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} value={val} mono={key === 'host' || key === 'name'} />
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Server Tab */}
          <TabsContent value="server" className="mt-0">
            <Card className="max-w-lg">
              <CardHeader className="pb-3"><CardTitle className="text-sm">Server Information</CardTitle></CardHeader>
              <CardContent>
                {data?.server && Object.entries(data.server).map(([key, val]) => (
                  key === 'https'
                    ? <StatusRow key={key} label="HTTPS" value={val} />
                    : <InfoRow key={key} label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} value={val} />
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Constants Tab */}
          <TabsContent value="constants" className="mt-0">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">WordPress Constants</CardTitle></CardHeader>
              <CardContent>
                {data?.constants && Object.entries(data.constants).map(([key, val]) => (
                  <div key={key} className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0 text-sm gap-4">
                    <span className="font-mono text-xs text-blue-700 shrink-0">{key}</span>
                    <span className="font-mono text-xs text-slate-600 break-all text-right">{String(val)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Active Plugins Tab */}
          <TabsContent value="plugins" className="mt-0">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Active Plugins ({data?.active_plugins?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div>
                  {data?.active_plugins?.map(plugin => (
                    <div key={plugin.file} className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{plugin.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{plugin.file}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">v{plugin.version}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cron Tab */}
          <TabsContent value="cron" className="mt-0">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Scheduled Cron Jobs</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div>
                  {data?.cron?.map((job, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
                      <div>
                        <p className="text-sm font-mono text-slate-800">{job.hook}</p>
                        <p className="text-xs text-slate-400">{job.next_run}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{job.schedule || 'once'}</Badge>
                    </div>
                  ))}
                  {(!data?.cron || data.cron.length === 0) && (
                    <p className="text-center py-8 text-slate-400 text-sm">No scheduled cron jobs</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
