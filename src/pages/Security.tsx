import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  Shield, ShieldCheck, ShieldOff, RefreshCw, Save, Lock, Copy,
  ExternalLink, AlertTriangle, CheckCircle2, Ban, FileSearch,
  Smartphone, Unlock, Trash2, Plus, Activity,
} from 'lucide-react'
import { useState, useEffect } from 'react'

interface OverviewData {
  admin_url_enabled: boolean
  admin_url_slug: string
  custom_url: string
  login_url: string
  limiter_enabled: boolean
  limiter_threshold: number
  limiter_window: number
  limiter_duration: number
  lockout_count: number
  ip_blocklist_count: number
  xmlrpc_disabled: boolean
  hide_wp_version: boolean
  tfa_enabled: boolean
  wp_version: string
  wp_locale: string
}

interface LockoutEntry { ip: string; username: string; time: number; duration: number; attempts: number }
interface BlocklistEntry { ip: string; note: string; added: number }
interface IntegrityResult {
  version: string; locale: string; checked: number; ok: number
  modified: { path: string; expected: string; actual: string; size: number; modified: number }[]
  missing: string[]; clean: boolean
}
interface TfaSetupData { secret: string; otp_url: string; qr_url: string }

export function Security() {
  const queryClient = useQueryClient()

  const { data: overview, isLoading } = useQuery<OverviewData>({
    queryKey: ['security-overview'],
    queryFn: () => api.get('/security/overview'),
  })

  const { data: lockoutsData, refetch: refetchLockouts } = useQuery<{ items: LockoutEntry[] }>({
    queryKey: ['security-lockouts'],
    queryFn: () => api.get('/security/lockouts'),
    enabled: false,
  })

  const { data: blocklistData, refetch: refetchBlocklist } = useQuery<{ items: BlocklistEntry[] }>({
    queryKey: ['security-blocklist'],
    queryFn: () => api.get('/security/ip-blocklist'),
    enabled: false,
  })

  const [slug, setSlug] = useState('')
  const [slugInit, setSlugInit] = useState(false)
  const [limiter, setLimiter] = useState({ enabled: false, threshold: 5, window: 300, duration: 900 })
  const [limiterInit, setLimiterInit] = useState(false)
  const [hardening, setHardening] = useState({ disable_xmlrpc: false, hide_wp_version: false })
  const [hardeningInit, setHardeningInit] = useState(false)
  const [newIp, setNewIp] = useState('')
  const [newIpNote, setNewIpNote] = useState('')
  const [tfaStep, setTfaStep] = useState<'idle' | 'setup' | 'verified'>('idle')
  const [tfaSetupData, setTfaSetupData] = useState<TfaSetupData | null>(null)
  const [tfaCode, setTfaCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [integrityResult, setIntegrityResult] = useState<IntegrityResult | null>(null)

  useEffect(() => {
    if (!overview) return
    if (!slugInit)     { setSlug(overview.admin_url_slug || ''); setSlugInit(true) }
    if (!limiterInit)  { setLimiter({ enabled: overview.limiter_enabled, threshold: overview.limiter_threshold, window: overview.limiter_window, duration: overview.limiter_duration }); setLimiterInit(true) }
    if (!hardeningInit){ setHardening({ disable_xmlrpc: overview.xmlrpc_disabled, hide_wp_version: overview.hide_wp_version }); setHardeningInit(true) }
  }, [overview, slugInit, limiterInit, hardeningInit])

  const enableSlugMutation = useMutation({
    mutationFn: () => api.post('/security/admin-url', { slug }),
    onSuccess: () => { toast.success('Admin URL protection enabled'); queryClient.invalidateQueries({ queryKey: ['security-overview'] }) },
    onError: (err: Error) => toast.error(err.message),
  })
  const disableSlugMutation = useMutation({
    mutationFn: () => api.delete('/security/admin-url'),
    onSuccess: () => { toast.info('Admin URL protection disabled'); queryClient.invalidateQueries({ queryKey: ['security-overview'] }) },
    onError: (err: Error) => toast.error(err.message),
  })
  const saveLimiterMutation = useMutation({
    mutationFn: () => api.post('/security/limiter', limiter),
    onSuccess: () => { toast.success('Limiter settings saved'); queryClient.invalidateQueries({ queryKey: ['security-overview'] }) },
    onError: (err: Error) => toast.error(err.message),
  })
  const clearLockoutsMutation = useMutation({
    mutationFn: () => api.delete('/security/lockouts'),
    onSuccess: () => { toast.success('Lockout log cleared'); queryClient.invalidateQueries({ queryKey: ['security-lockouts'] }); queryClient.invalidateQueries({ queryKey: ['security-overview'] }) },
    onError: (err: Error) => toast.error(err.message),
  })
  const unlockIpMutation = useMutation<unknown, Error, string>({
    mutationFn: (ip) => api.post('/security/lockouts/unlock', { ip }),
    onSuccess: () => { toast.success('IP unlocked'); refetchLockouts() },
    onError: (err: Error) => toast.error(err.message),
  })
  const addBlockMutation = useMutation({
    mutationFn: () => api.post('/security/ip-blocklist', { ip: newIp, note: newIpNote }),
    onSuccess: () => { toast.success('IP blocked'); setNewIp(''); setNewIpNote(''); refetchBlocklist(); queryClient.invalidateQueries({ queryKey: ['security-overview'] }) },
    onError: (err: Error) => toast.error(err.message),
  })
  const removeBlockMutation = useMutation<unknown, Error, string>({
    mutationFn: (ip) => api.delete('/security/ip-blocklist', { ip }),
    onSuccess: () => { toast.success('IP removed'); refetchBlocklist(); queryClient.invalidateQueries({ queryKey: ['security-overview'] }) },
    onError: (err: Error) => toast.error(err.message),
  })
  const saveHardeningMutation = useMutation({
    mutationFn: () => api.post('/security/hardening', hardening),
    onSuccess: () => { toast.success('Hardening settings saved'); queryClient.invalidateQueries({ queryKey: ['security-overview'] }) },
    onError: (err: Error) => toast.error(err.message),
  })
  const checkIntegrityMutation = useMutation<IntegrityResult, Error, void>({
    mutationFn: () => api.post<IntegrityResult>('/security/integrity', {}),
    onSuccess: (data) => { setIntegrityResult(data); data.clean ? toast.success('All core files are clean!') : toast.warning(`${data.modified.length + data.missing.length} issue(s) found`) },
    onError: (err: Error) => toast.error(err.message),
  })
  const setup2faMutation = useMutation<TfaSetupData, Error, void>({
    mutationFn: () => api.post<TfaSetupData>('/security/2fa/setup', {}),
    onSuccess: (data) => { setTfaSetupData(data); setTfaStep('setup') },
    onError: (err: Error) => toast.error(err.message),
  })
  const verify2faMutation = useMutation<{ success: boolean; backup_codes: string[] }, Error, void>({
    mutationFn: () => api.post<{ success: boolean; backup_codes: string[] }>('/security/2fa/verify', { code: tfaCode }),
    onSuccess: (data) => { setBackupCodes(data.backup_codes); setTfaStep('verified'); queryClient.invalidateQueries({ queryKey: ['security-overview'] }) },
    onError: (err: Error) => toast.error(err.message),
  })
  const disable2faMutation = useMutation({
    mutationFn: () => api.delete('/security/2fa'),
    onSuccess: () => { toast.success('2FA disabled'); setTfaStep('idle'); setTfaSetupData(null); setBackupCodes([]); queryClient.invalidateQueries({ queryKey: ['security-overview'] }) },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) return <PageLoader text="Loading security settings..." />

  const copyText = (text: string, label = 'Copied!') =>
    navigator.clipboard.writeText(text).then(() => toast.success(label))

  const featureCards = [
    { label: 'Admin URL', desc: overview?.admin_url_enabled ? `/${overview.admin_url_slug}` : 'wp-login.php exposed', on: overview?.admin_url_enabled ?? false, Icon: Lock },
    { label: 'Login Limiter', desc: overview?.limiter_enabled ? `${overview.limiter_threshold} attempts max` : 'No brute-force limit', on: overview?.limiter_enabled ?? false, Icon: Activity },
    { label: 'IP Blocklist', desc: `${overview?.ip_blocklist_count ?? 0} IP(s) blocked`, on: (overview?.ip_blocklist_count ?? 0) > 0, Icon: Ban },
    { label: 'XML-RPC', desc: overview?.xmlrpc_disabled ? 'Disabled' : 'Enabled (default)', on: overview?.xmlrpc_disabled ?? false, Icon: ShieldCheck },
    { label: 'Hide WP Version', desc: overview?.hide_wp_version ? 'Version hidden' : 'Version visible', on: overview?.hide_wp_version ?? false, Icon: Shield },
    { label: 'Two-Factor Auth', desc: overview?.tfa_enabled ? 'TOTP active' : 'Not configured', on: overview?.tfa_enabled ?? false, Icon: Smartphone },
  ]

  return (
    <div className="fade-in">
      <PageHeader title="Security" description="Protect your WordPress site with multiple layers of security" />
      <div className="p-6 max-w-4xl">
        <Tabs defaultValue="overview" onValueChange={(tab) => {
          if (tab === 'login') refetchLockouts()
          if (tab === 'hardening') refetchBlocklist()
        }}>
          <TabsList className="mb-6 grid grid-cols-5 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="hardening">Hardening</TabsTrigger>
            <TabsTrigger value="integrity">Integrity</TabsTrigger>
            <TabsTrigger value="2fa">Two-Factor</TabsTrigger>
          </TabsList>

          {/* ── Overview ──────────────────────────────────────────────────── */}
          <TabsContent value="overview">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              {featureCards.map(({ label, desc, on, Icon }) => (
                <Card key={label} className={on ? 'border-green-300 dark:border-green-800' : ''}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${on ? 'bg-green-100 dark:bg-green-900/40' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      <Icon className={`w-4 h-4 ${on ? 'text-green-600' : 'text-slate-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs text-slate-900 dark:text-slate-100">{label}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{desc}</p>
                    </div>
                    <Badge variant={on ? 'success' : 'secondary'} className="shrink-0 text-xs">{on ? 'On' : 'Off'}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="text-sm text-slate-500">
              Running <strong>WordPress {overview?.wp_version}</strong> ({overview?.wp_locale})
              {' — '}use the <strong>Integrity</strong> tab to verify core files.
            </p>
          </TabsContent>

          {/* ── Login Protection ──────────────────────────────────────────── */}
          <TabsContent value="login" className="space-y-6">
            {/* Custom Login URL */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Lock className="w-4 h-4" />Custom Login URL</CardTitle>
                <CardDescription>Replace wp-login.php with a secret slug. Direct access will be blocked.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription className="text-xs">Save your login URL before leaving this page. Password resets still work normally.</AlertDescription>
                </Alert>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                    <span className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-500 text-sm border-r border-slate-200 dark:border-slate-700 shrink-0">/</span>
                    <input
                      type="text"
                      value={slug}
                      onChange={e => setSlug(e.target.value.replace(/[^a-z0-9-_]/g, '').toLowerCase())}
                      placeholder="my-secret-login"
                      className="flex-1 px-3 py-2 bg-transparent text-sm outline-none dark:text-slate-100"
                    />
                  </div>
                  <Button onClick={() => enableSlugMutation.mutate()} disabled={enableSlugMutation.isPending || slug.length < 4}>
                    {enableSlugMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {overview?.admin_url_enabled ? 'Update' : 'Enable'}
                  </Button>
                </div>
                {overview?.admin_url_enabled && overview.custom_url && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                    <code className="flex-1 text-sm text-green-800 dark:text-green-300 break-all font-mono">{overview.custom_url}</code>
                    <Button size="sm" variant="ghost" onClick={() => copyText(overview.custom_url!, 'Login URL copied!')} className="text-green-700 shrink-0 h-7 px-2"><Copy className="w-3.5 h-3.5" /></Button>
                    <a href={overview.custom_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="ghost" className="text-green-700 h-7 px-2"><ExternalLink className="w-3.5 h-3.5" /></Button>
                    </a>
                  </div>
                )}
                {overview?.admin_url_enabled && (
                  <Button variant="outline" onClick={() => disableSlugMutation.mutate()} disabled={disableSlugMutation.isPending} className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800">
                    {disableSlugMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
                    Disable Protection
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Login Limiter */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4" />Login Attempt Limiter</CardTitle>
                <CardDescription>Block IPs that exceed a failed-login threshold within a time window.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch checked={limiter.enabled} onCheckedChange={v => setLimiter(s => ({ ...s, enabled: v }))} id="limiter-on" />
                  <Label htmlFor="limiter-on">Enable login limiter</Label>
                </div>
                {limiter.enabled && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Max Attempts</Label>
                      <Input type="number" min={1} max={20} value={limiter.threshold} onChange={e => setLimiter(s => ({ ...s, threshold: +e.target.value || 5 }))} />
                      <p className="text-xs text-slate-500">before lockout</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Window (seconds)</Label>
                      <Input type="number" min={60} value={limiter.window} onChange={e => setLimiter(s => ({ ...s, window: +e.target.value || 300 }))} />
                      <p className="text-xs text-slate-500">counting period</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Lockout (seconds)</Label>
                      <Input type="number" min={60} value={limiter.duration} onChange={e => setLimiter(s => ({ ...s, duration: +e.target.value || 900 }))} />
                      <p className="text-xs text-slate-500">block duration</p>
                    </div>
                  </div>
                )}
                <Button onClick={() => saveLimiterMutation.mutate()} disabled={saveLimiterMutation.isPending}>
                  {saveLimiterMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Settings
                </Button>
              </CardContent>
            </Card>

            {/* Lockout Log */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4" />Lockout Log
                    {(overview?.lockout_count ?? 0) > 0 && <Badge variant="secondary">{overview?.lockout_count}</Badge>}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => refetchLockouts()}><RefreshCw className="w-3.5 h-3.5" />Refresh</Button>
                    {(lockoutsData?.items?.length ?? 0) > 0 && (
                      <Button size="sm" variant="outline" onClick={() => clearLockoutsMutation.mutate()} disabled={clearLockoutsMutation.isPending} className="text-red-600 border-red-200">
                        <Trash2 className="w-3.5 h-3.5" />Clear
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!lockoutsData ? (
                  <p className="text-sm text-slate-500">Loading lockout history…</p>
                ) : lockoutsData.items.length === 0 ? (
                  <p className="text-sm text-slate-500">No lockouts recorded.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          {['IP', 'Username', 'Time', 'Attempts', ''].map(h => (
                            <th key={h} className="text-left py-2 px-2 font-medium text-slate-600 dark:text-slate-400 text-xs">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {lockoutsData.items.map((e, i) => (
                          <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="py-2 px-2 font-mono text-xs">{e.ip}</td>
                            <td className="py-2 px-2 text-xs text-slate-600 dark:text-slate-400">{e.username}</td>
                            <td className="py-2 px-2 text-xs text-slate-500">{new Date(e.time * 1000).toLocaleString()}</td>
                            <td className="py-2 px-2 text-xs">{e.attempts}</td>
                            <td className="py-2 px-2">
                              <Button size="sm" variant="ghost" onClick={() => unlockIpMutation.mutate(e.ip)} className="h-6 px-2 text-xs text-blue-600">
                                <Unlock className="w-3 h-3" />Unlock
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Hardening ─────────────────────────────────────────────────── */}
          <TabsContent value="hardening" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4" />WordPress Hardening</CardTitle>
                <CardDescription>Reduce the attack surface of your WordPress installation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { id: 'xmlrpc', key: 'disable_xmlrpc' as const, label: 'Disable XML-RPC', desc: 'Prevents brute-force and DDoS attacks via xmlrpc.php.' },
                  { id: 'wpver', key: 'hide_wp_version' as const, label: 'Hide WordPress Version', desc: 'Removes the WP version from the generator meta tag and asset query strings.' },
                ].map(({ id, key, label, desc }) => (
                  <div key={id} className="flex items-start gap-4 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <Switch checked={hardening[key]} onCheckedChange={v => setHardening(s => ({ ...s, [key]: v }))} id={id} />
                    <div>
                      <Label htmlFor={id} className="font-medium cursor-pointer">{label}</Label>
                      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
                <Button onClick={() => saveHardeningMutation.mutate()} disabled={saveHardeningMutation.isPending}>
                  {saveHardeningMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Hardening Settings
                </Button>
              </CardContent>
            </Card>

            {/* IP Blocklist */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Ban className="w-4 h-4" />IP Blocklist
                    {(overview?.ip_blocklist_count ?? 0) > 0 && <Badge variant="secondary">{overview?.ip_blocklist_count}</Badge>}
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={() => refetchBlocklist()}><RefreshCw className="w-3.5 h-3.5" />Refresh</Button>
                </div>
                <CardDescription>Block specific IPs or CIDR ranges (e.g. 10.0.0.0/24) from your site.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input placeholder="IP or CIDR (e.g. 192.168.1.1)" value={newIp} onChange={e => setNewIp(e.target.value)} className="flex-1" />
                  <Input placeholder="Note (optional)" value={newIpNote} onChange={e => setNewIpNote(e.target.value)} className="w-40" />
                  <Button onClick={() => addBlockMutation.mutate()} disabled={addBlockMutation.isPending || !newIp}>
                    <Plus className="w-4 h-4" />Block
                  </Button>
                </div>
                {!blocklistData ? (
                  <p className="text-sm text-slate-500">Loading blocklist…</p>
                ) : blocklistData.items.length === 0 ? (
                  <p className="text-sm text-slate-500">No IPs blocked.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          {['IP / CIDR', 'Note', 'Added', ''].map(h => (
                            <th key={h} className="text-left py-2 px-2 font-medium text-slate-600 dark:text-slate-400 text-xs">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {blocklistData.items.map((e, i) => (
                          <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="py-2 px-2 font-mono text-xs">{e.ip}</td>
                            <td className="py-2 px-2 text-xs text-slate-500">{e.note || '—'}</td>
                            <td className="py-2 px-2 text-xs text-slate-500">{new Date(e.added * 1000).toLocaleDateString()}</td>
                            <td className="py-2 px-2">
                              <Button size="sm" variant="ghost" onClick={() => removeBlockMutation.mutate(e.ip)} className="h-6 px-2 text-xs text-red-600">
                                <Trash2 className="w-3 h-3" />Remove
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── File Integrity ─────────────────────────────────────────────── */}
          <TabsContent value="integrity">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><FileSearch className="w-4 h-4" />Core File Integrity Checker</CardTitle>
                <CardDescription>
                  Compares <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">wp-admin/</code> and{' '}
                  <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">wp-includes/</code> against official checksums from wordpress.org.
                  User content in <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">wp-content/</code> is excluded.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={() => checkIntegrityMutation.mutate()} disabled={checkIntegrityMutation.isPending}>
                  {checkIntegrityMutation.isPending
                    ? <><RefreshCw className="w-4 h-4 animate-spin" />Checking files…</>
                    : <><FileSearch className="w-4 h-4" />Run Integrity Check</>
                  }
                </Button>

                {integrityResult && (
                  <div className="space-y-4">
                    <div className={`flex items-center gap-3 p-4 rounded-lg border ${integrityResult.clean ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'}`}>
                      {integrityResult.clean
                        ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                        : <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                      }
                      <div>
                        <p className="font-medium text-sm">
                          {integrityResult.clean
                            ? `All ${integrityResult.checked} checked files are clean`
                            : `${integrityResult.modified.length + integrityResult.missing.length} issue(s) found in ${integrityResult.checked} files`
                          }
                        </p>
                        <p className="text-xs text-slate-500">
                          WordPress {integrityResult.version} ({integrityResult.locale})
                          {' — '}{integrityResult.ok} clean, {integrityResult.modified.length} modified, {integrityResult.missing.length} missing
                        </p>
                      </div>
                    </div>

                    {integrityResult.modified.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-sm font-medium text-red-700 dark:text-red-400">Modified ({integrityResult.modified.length})</p>
                        {integrityResult.modified.map(f => (
                          <div key={f.path} className="flex justify-between p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded text-xs">
                            <code className="font-mono text-red-800 dark:text-red-300">{f.path}</code>
                            <span className="text-slate-500 ml-2 shrink-0">{new Date(f.modified * 1000).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {integrityResult.missing.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-sm font-medium text-orange-700 dark:text-orange-400">Missing ({integrityResult.missing.length})</p>
                        {integrityResult.missing.map(f => (
                          <div key={f} className="p-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded text-xs">
                            <code className="font-mono text-orange-800 dark:text-orange-300">{f}</code>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Two-Factor Auth ─────────────────────────────────────────────── */}
          <TabsContent value="2fa">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Smartphone className="w-4 h-4" />Two-Factor Authentication</CardTitle>
                <CardDescription>
                  Add TOTP-based 2FA to your admin account. Compatible with Google Authenticator, Authy, and any TOTP app.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {overview?.tfa_enabled && tfaStep === 'idle' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                      <div>
                        <p className="font-medium text-sm text-green-800 dark:text-green-300">Two-Factor Authentication is active</p>
                        <p className="text-xs text-slate-500 mt-0.5">Your account is protected with a TOTP authenticator app.</p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => disable2faMutation.mutate()} disabled={disable2faMutation.isPending} className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800">
                      {disable2faMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
                      Disable 2FA
                    </Button>
                  </div>
                ) : tfaStep === 'idle' ? (
                  <div className="space-y-4">
                    <Alert>
                      <Smartphone className="w-4 h-4" />
                      <AlertDescription className="text-xs">
                        Install <strong>Google Authenticator</strong> or <strong>Authy</strong> on your phone before proceeding.
                      </AlertDescription>
                    </Alert>
                    <Button onClick={() => setup2faMutation.mutate()} disabled={setup2faMutation.isPending}>
                      {setup2faMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                      Set Up Two-Factor Auth
                    </Button>
                  </div>
                ) : tfaStep === 'setup' && tfaSetupData ? (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Step 1 — Scan the QR code with your authenticator app</p>
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                        <img src={tfaSetupData.qr_url} alt="QR Code" className="w-40 h-40 border border-slate-200 dark:border-slate-700 rounded-lg" />
                        <div className="space-y-2 flex-1">
                          <p className="text-xs text-slate-500">Or enter this secret key manually:</p>
                          <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded font-mono text-sm break-all">
                            <span className="flex-1">{tfaSetupData.secret}</span>
                            <Button size="sm" variant="ghost" onClick={() => copyText(tfaSetupData.secret, 'Secret copied!')} className="shrink-0 h-6 px-2">
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Step 2 — Enter the 6-digit code from your app</p>
                      <div className="flex gap-3">
                        <Input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={tfaCode}
                          onChange={e => setTfaCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="000000"
                          className="w-36 font-mono text-center text-lg tracking-widest"
                        />
                        <Button onClick={() => verify2faMutation.mutate()} disabled={verify2faMutation.isPending || tfaCode.length !== 6}>
                          {verify2faMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          Verify & Enable
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : tfaStep === 'verified' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                      <div>
                        <p className="font-medium text-sm text-green-800 dark:text-green-300">2FA enabled successfully!</p>
                        <p className="text-xs text-slate-500 mt-0.5">Save these backup codes — they will only be shown once.</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Backup Codes</Label>
                        <Button size="sm" variant="outline" onClick={() => copyText(backupCodes.join('\n'), 'Codes copied!')}>
                          <Copy className="w-3.5 h-3.5" />Copy All
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        {backupCodes.map((c, i) => (
                          <code key={i} className="text-sm font-mono text-center text-slate-700 dark:text-slate-300 py-1">{c}</code>
                        ))}
                      </div>
                    </div>
                    <Button onClick={() => setTfaStep('idle')}>Done</Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
