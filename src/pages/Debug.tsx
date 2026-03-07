import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { Bug, RefreshCw, Trash2, AlertTriangle, Download, FileText, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { formatBytes } from '@/lib/utils'

interface DebugInfo {
  wp_debug: boolean
  wp_debug_log: boolean
  wp_debug_display: boolean
  savequeries: boolean
  log_file: string
  log_exists: boolean
  log_size: number
  config_writable: boolean
}

interface ErrorLog {
  exists: boolean
  content: string
  size: number
  path: string
}

export function Debug() {
  const queryClient = useQueryClient()

  const [wpDebug, setWpDebug] = useState<boolean | null>(null)
  const [wpDebugLog, setWpDebugLog] = useState<boolean | null>(null)
  const [wpDebugDisplay, setWpDebugDisplay] = useState<boolean | null>(null)
  const [saveQueries, setSaveQueries] = useState<boolean | null>(null)

  const { data: debugInfo, isLoading } = useQuery<DebugInfo>({
    queryKey: ['debug-info'],
    queryFn: () => api.get('/debug'),
  })

  const { data: errorLog, isLoading: logLoading, refetch: refetchLog } = useQuery<ErrorLog>({
    queryKey: ['error-log'],
    queryFn: () => api.get('/debug/log'),
  })

  const saveMutation = useMutation({
    mutationFn: () => api.post('/debug/toggle', {
      wp_debug: wpDebug ?? debugInfo?.wp_debug,
      wp_debug_log: wpDebugLog ?? debugInfo?.wp_debug_log,
      wp_debug_display: wpDebugDisplay ?? debugInfo?.wp_debug_display,
      savequeries: saveQueries ?? debugInfo?.savequeries,
    }),
    onSuccess: () => {
      toast.success('Debug settings saved')
      queryClient.invalidateQueries({ queryKey: ['debug-info'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const clearLogMutation = useMutation({
    mutationFn: () => api.delete('/debug/log/clear'),
    onSuccess: () => {
      toast.success('Error log cleared')
      queryClient.invalidateQueries({ queryKey: ['error-log'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) return <PageLoader text="Loading debug settings..." />

  const currentWpDebug = wpDebug ?? debugInfo?.wp_debug ?? false
  const currentWpDebugLog = wpDebugLog ?? debugInfo?.wp_debug_log ?? false
  const currentWpDebugDisplay = wpDebugDisplay ?? debugInfo?.wp_debug_display ?? false
  const currentSaveQueries = saveQueries ?? debugInfo?.savequeries ?? false

  return (
    <div className="fade-in">
      <PageHeader
        title="Debug Tools"
        description="Manage WordPress debug settings and error logs"
      />

      <div className="p-6 space-y-6">
        {/* Debug Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="w-4 h-4" />
                Debug Constants
              </CardTitle>
              <CardDescription>
                Configure WordPress debug settings in wp-config.php
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {!debugInfo?.config_writable && (
                <Alert variant="warning">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription className="text-xs">
                    wp-config.php is not writable. Cannot modify debug settings.
                  </AlertDescription>
                </Alert>
              )}

              {[
                {
                  id: 'wp_debug',
                  label: 'WP_DEBUG',
                  desc: 'Enable WordPress debug mode',
                  value: currentWpDebug,
                  onChange: setWpDebug,
                  danger: true,
                },
                {
                  id: 'wp_debug_log',
                  label: 'WP_DEBUG_LOG',
                  desc: 'Save errors to debug.log file',
                  value: currentWpDebugLog,
                  onChange: setWpDebugLog,
                },
                {
                  id: 'wp_debug_display',
                  label: 'WP_DEBUG_DISPLAY',
                  desc: 'Show errors on screen (dangerous in production)',
                  value: currentWpDebugDisplay,
                  onChange: setWpDebugDisplay,
                  danger: true,
                },
                {
                  id: 'savequeries',
                  label: 'SAVEQUERIES',
                  desc: 'Save all DB queries (slows down site)',
                  value: currentSaveQueries,
                  onChange: setSaveQueries,
                  danger: true,
                },
              ].map(setting => (
                <div key={setting.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={setting.id} className="font-mono text-sm cursor-pointer">
                        {setting.label}
                      </Label>
                      {setting.danger && setting.value && (
                        <Badge variant="destructive" className="text-[10px]">Production risk</Badge>
                      )}
                      {!setting.value && (
                        <Badge variant="secondary" className="text-[10px]">
                          <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                          Off
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{setting.desc}</p>
                  </div>
                  <Switch
                    id={setting.id}
                    checked={setting.value}
                    onCheckedChange={setting.onChange}
                    disabled={!debugInfo?.config_writable}
                  />
                </div>
              ))}

              <Button
                className="w-full mt-2"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !debugInfo?.config_writable}
              >
                {saveMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                Save Debug Settings
              </Button>
            </CardContent>
          </Card>

          {/* Log info card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Error Log Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {[
                  { label: 'Log File', value: errorLog?.path || debugInfo?.log_file || 'wp-content/debug.log' },
                  { label: 'Status', value: errorLog?.exists ? 'Exists' : 'Not created yet' },
                  { label: 'File Size', value: errorLog?.exists ? formatBytes(errorLog.size) : '0 B' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between py-1.5 border-b border-slate-50 last:border-0 text-sm">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="font-medium text-slate-800 font-mono text-xs truncate max-w-[200px]" title={item.value}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => refetchLog()} className="flex-1">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh Log
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  onClick={() => clearLogMutation.mutate()}
                  disabled={!errorLog?.exists || clearLogMutation.isPending}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear Log
                </Button>
              </div>

              {currentWpDebug && !currentWpDebugLog && (
                <Alert variant="warning">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <AlertDescription className="text-xs">
                    WP_DEBUG is enabled but WP_DEBUG_LOG is off. Errors won't be saved to file.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Error Log Viewer */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Error Log</CardTitle>
              <CardDescription>Last 200 lines of your WordPress error log</CardDescription>
            </div>
            {errorLog?.exists && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => refetchLog()}>
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => clearLogMutation.mutate()}
                  disabled={clearLogMutation.isPending}
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  Clear
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {logLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
              </div>
            ) : errorLog?.exists && errorLog.content ? (
              <ScrollArea className="h-[400px]">
                <pre className="p-4 text-xs font-mono text-slate-700 bg-slate-50 whitespace-pre-wrap leading-relaxed">
                  {errorLog.content}
                </pre>
              </ScrollArea>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">
                  {!debugInfo?.wp_debug
                    ? 'Enable WP_DEBUG and WP_DEBUG_LOG to start capturing errors'
                    : 'No errors logged yet'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
