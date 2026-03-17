import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Clock, Play, Trash2, Plus, RefreshCw, AlertTriangle,
  CheckCircle2, XCircle, Timer, Calendar, Cpu, Info, Terminal,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow, fromUnixTime } from 'date-fns'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CronEvent {
  hook: string
  timestamp: number
  next_run_human: string
  schedule: string
  schedule_label: string
  interval: number
  args: unknown[]
  args_hash: string
  is_core: boolean
}

interface CronSchedule {
  key: string
  display: string
  interval: number
  is_custom: boolean
}

interface CronHealth {
  disabled: boolean
  alternate_cron: boolean
  lock_timeout: number
  doing_cron: boolean
  total_events: number
  overdue_count: number
  overdue_events: { hook: string; timestamp: number; overdue_s: number }[]
  real_cron_command: string
  wp_cli_command: string
}

interface RunResult {
  success: boolean
  hook: string
  duration: number
  output: string
  error: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

function nextRunColor(ts: number): string {
  const diff = ts - Math.floor(Date.now() / 1000)
  if (diff < 0) return 'text-red-500'
  if (diff < 300) return 'text-amber-500'
  return 'text-green-600'
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Cron() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [runResult, setRunResult] = useState<RunResult | null>(null)
  const [newSched, setNewSched] = useState({ key: '', display: '', interval: '' })

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: events = [], isLoading: eventsLoading } = useQuery<CronEvent[]>({
    queryKey: ['cron-events'],
    queryFn: () => api.get<CronEvent[]>('/cron/events'),
  })

  const { data: schedules = [], isLoading: schedsLoading } = useQuery<CronSchedule[]>({
    queryKey: ['cron-schedules'],
    queryFn: () => api.get<CronSchedule[]>('/cron/schedules'),
  })

  const { data: health, isLoading: healthLoading } = useQuery<CronHealth>({
    queryKey: ['cron-health'],
    queryFn: () => api.get<CronHealth>('/cron/health'),
  })

  // ── Mutations ──────────────────────────────────────────────────────────────

  const runMutation = useMutation<RunResult, Error, CronEvent>({
    mutationFn: (event) =>
      api.post<RunResult>('/cron/run', { hook: event.hook, args: event.args }),
    onSuccess: (data) => {
      setRunResult(data)
      qc.invalidateQueries({ queryKey: ['cron-events'] })
      if (data.success) {
        toast.success(`Triggered ${data.hook} (${data.duration}ms)`)
      } else {
        toast.error(`Error: ${data.error}`)
      }
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteMutation = useMutation<unknown, Error, CronEvent>({
    mutationFn: (event) =>
      api.delete('/cron/event', { hook: event.hook, timestamp: event.timestamp, args: event.args }),
    onSuccess: (_d, event) => {
      toast.success(`Deleted ${event.hook}`)
      qc.invalidateQueries({ queryKey: ['cron-events'] })
      qc.invalidateQueries({ queryKey: ['cron-health'] })
    },
    onError: (e) => toast.error(e.message),
  })

  const createSchedMutation = useMutation<unknown, Error, typeof newSched>({
    mutationFn: (s) =>
      api.post('/cron/schedules', { key: s.key, display: s.display, interval: parseInt(s.interval, 10) }),
    onSuccess: () => {
      toast.success('Custom schedule created')
      setNewSched({ key: '', display: '', interval: '' })
      qc.invalidateQueries({ queryKey: ['cron-schedules'] })
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteSchedMutation = useMutation<unknown, Error, string>({
    mutationFn: (key) => api.delete('/cron/schedules', { key }),
    onSuccess: (_d, key) => {
      toast.success(`Deleted schedule "${key}"`)
      qc.invalidateQueries({ queryKey: ['cron-schedules'] })
    },
    onError: (e) => toast.error(e.message),
  })

  // ── Filtered events ────────────────────────────────────────────────────────

  const filtered = events.filter((e) =>
    e.hook.toLowerCase().includes(search.toLowerCase())
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title="Cron Manager"
        description="Inspect, trigger, and manage WordPress scheduled events"
      />

      <Tabs defaultValue="events">
        <TabsList className="mb-2">
          <TabsTrigger value="events" className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Events
            {events.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
                {events.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="schedules" className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Schedules
          </TabsTrigger>
          <TabsTrigger value="health" className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Health
            {health && health.overdue_count > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1">
                {health.overdue_count}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Events Tab ── */}
        <TabsContent value="events" className="space-y-6 mt-2">
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search hooks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ['cron-events'] })}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
            <span className="text-sm text-muted-foreground ml-auto">
              {filtered.length} event{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {runResult && (
            <Alert variant={runResult.success ? 'default' : 'destructive'}>
              <Terminal className="w-4 h-4" />
              <AlertDescription className="font-mono text-xs">
                <strong>{runResult.hook}</strong> — {runResult.success ? `OK (${runResult.duration}ms)` : `Error: ${runResult.error}`}
                {runResult.output && (
                  <pre className="mt-2 whitespace-pre-wrap break-all">{runResult.output}</pre>
                )}
              </AlertDescription>
            </Alert>
          )}

          {eventsLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading events…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No events found.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2.5">Hook</th>
                    <th className="text-left px-4 py-2.5">Next Run</th>
                    <th className="text-left px-4 py-2.5">Schedule</th>
                    <th className="text-right px-4 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((event, i) => (
                    <tr key={`${event.hook}-${event.timestamp}-${i}`} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          {event.hook}
                          {event.is_core && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1">core</Badge>
                          )}
                          {event.args.length > 0 && (
                            <Badge variant="secondary" className="text-[9px] h-4 px-1">
                              {event.args.length} arg{event.args.length !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${nextRunColor(event.timestamp)}`}>
                          {event.next_run_human}
                        </span>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(fromUnixTime(event.timestamp), { addSuffix: true })}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {event.schedule_label ? (
                          <div>
                            <span className="text-xs">{event.schedule_label}</span>
                            <span className="text-[10px] text-muted-foreground ml-1">
                              ({fmtInterval(event.interval)})
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">once</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                          disabled={runMutation.isPending}
                          onClick={() => runMutation.mutate(event)}
                          title="Run now"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </Button>
                        {!event.is_core && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                            disabled={deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate(event)}
                            title="Delete event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Schedules Tab ── */}
        <TabsContent value="schedules" className="space-y-6 mt-2">
          {/* Add custom schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Custom Schedule
              </CardTitle>
              <CardDescription>
                Register a new recurrence interval available to all WP-Cron jobs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="sched-key">Key</Label>
                  <Input
                    id="sched-key"
                    placeholder="every_2_hours"
                    value={newSched.key}
                    onChange={(e) => setNewSched((s) => ({ ...s, key: e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground">Lowercase, underscores</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sched-display">Display Name</Label>
                  <Input
                    id="sched-display"
                    placeholder="Every 2 Hours"
                    value={newSched.display}
                    onChange={(e) => setNewSched((s) => ({ ...s, display: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sched-interval">Interval (seconds)</Label>
                  <Input
                    id="sched-interval"
                    type="number"
                    min="60"
                    placeholder="7200"
                    value={newSched.interval}
                    onChange={(e) => setNewSched((s) => ({ ...s, interval: e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground">Minimum 60</p>
                </div>
              </div>
              <Button
                className="mt-3"
                disabled={!newSched.key || !newSched.display || !newSched.interval || createSchedMutation.isPending}
                onClick={() => createSchedMutation.mutate(newSched)}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Schedule
              </Button>
            </CardContent>
          </Card>

          {/* All schedules */}
          {schedsLoading ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading…
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2.5">Key</th>
                    <th className="text-left px-4 py-2.5">Display Name</th>
                    <th className="text-left px-4 py-2.5">Interval</th>
                    <th className="text-right px-4 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s) => (
                    <tr key={s.key} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">
                        {s.key}
                        {s.is_custom && (
                          <Badge variant="secondary" className="ml-2 text-[9px] h-4 px-1">custom</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">{s.display}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {fmtInterval(s.interval)}
                        <span className="ml-1 text-[10px]">({s.interval}s)</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.is_custom && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                            disabled={deleteSchedMutation.isPending}
                            onClick={() => deleteSchedMutation.mutate(s.key)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Health Tab ── */}
        <TabsContent value="health" className="space-y-6 mt-2">
          {healthLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading…
            </div>
          ) : health ? (
            <>
              {/* Status cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className={`border-2 ${health.disabled ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      {health.disabled
                        ? <XCircle className="w-4 h-4 text-red-500" />
                        : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      <span className="text-sm font-medium">WP-Cron</span>
                    </div>
                    <p className={`text-xs font-semibold ${health.disabled ? 'text-red-600' : 'text-green-700'}`}>
                      {health.disabled ? 'DISABLED' : 'Enabled'}
                    </p>
                    {health.disabled && (
                      <p className="text-[10px] text-red-500 mt-1">DISABLE_WP_CRON = true</p>
                    )}
                  </CardContent>
                </Card>

                <Card className={`border-2 ${health.overdue_count > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      {health.overdue_count > 0
                        ? <AlertTriangle className="w-4 h-4 text-amber-500" />
                        : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      <span className="text-sm font-medium">Overdue</span>
                    </div>
                    <p className={`text-xl font-bold ${health.overdue_count > 0 ? 'text-amber-600' : 'text-green-700'}`}>
                      {health.overdue_count}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{health.total_events} total events</p>
                  </CardContent>
                </Card>

                <Card className="border-2 border-slate-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Timer className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium">Lock Timeout</span>
                    </div>
                    <p className="text-xl font-bold text-slate-700">{health.lock_timeout}s</p>
                    <p className="text-[10px] text-muted-foreground">WP_CRON_LOCK_TIMEOUT</p>
                  </CardContent>
                </Card>

                <Card className={`border-2 ${health.alternate_cron ? 'border-blue-200 bg-blue-50' : 'border-slate-200'}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Cpu className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium">Alternate Cron</span>
                    </div>
                    <p className={`text-xs font-semibold ${health.alternate_cron ? 'text-blue-600' : 'text-muted-foreground'}`}>
                      {health.alternate_cron ? 'Enabled' : 'Off'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">ALTERNATE_WP_CRON</p>
                  </CardContent>
                </Card>
              </div>

              {/* Overdue events */}
              {health.overdue_count > 0 && (
                <Card className="border-amber-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
                      <AlertTriangle className="w-4 h-4" />
                      Overdue Events
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {health.overdue_events.map((e, i) => (
                        <div key={i} className="flex items-center justify-between text-sm bg-amber-50 rounded px-3 py-1.5">
                          <span className="font-mono text-xs">{e.hook}</span>
                          <span className="text-xs text-amber-600">
                            {fmtInterval(e.overdue_s)} overdue
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Real cron setup */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Real Cron Setup
                  </CardTitle>
                  <CardDescription>
                    Replace WP-Cron's visitor-triggered approach with a real system cron job for reliable scheduling.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {health.disabled && (
                    <Alert>
                      <AlertTriangle className="w-4 h-4" />
                      <AlertDescription className="text-sm">
                        <strong>DISABLE_WP_CRON is set to true</strong> in your wp-config.php — WP-Cron will not fire automatically. Make sure you have a real cron job configured below, or scheduled events will not run.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <p className="text-sm font-medium">1. Add to wp-config.php (to disable the built-in pseudo-cron)</p>
                    <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto">
                      {"define('DISABLE_WP_CRON', true);"}
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">2. Server crontab (every 5 minutes)</p>
                    <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto">
                      {health.real_cron_command}
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">3. Or use WP-CLI</p>
                    <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto">
                      {health.wp_cli_command}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}
