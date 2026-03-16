import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ScanLine, ShieldCheck, ShieldAlert, ShieldOff, RefreshCw, AlertTriangle,
  CheckCircle2, XCircle, Lock, Globe, Code2, Cpu, ExternalLink, Key,
  Eye, EyeOff, Loader2, ChevronDown, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageHeader } from '@/components/PageHeader'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MalwareFinding {
  area: string
  file: string
  pattern: string
  severity: 'critical' | 'warning'
  line: number
  snippet: string
}

interface MalwareResult {
  scanned: number
  clean: boolean
  findings: MalwareFinding[]
  scope: string
}

interface VulnEntry {
  id: string
  title: string
  type: string
  severity: string
  score: number | null
  fixed_in: string | null
  references: { type: string; url: string }[]
}

interface VulnItem {
  type: 'plugin' | 'theme'
  slug: string
  name: string
  version: string
  latest_version: string | null
  vulnerabilities: VulnEntry[]
}

interface VulnResult {
  results: VulnItem[]
  total: number
  with_vulns: number
  error?: string
  message?: string
  api_key_url?: string
}

interface SslResult {
  host: string
  https: boolean
  valid: boolean
  error: string | null
  days_remaining?: number
  cert?: {
    subject: string
    issuer: string
    valid_from: string
    valid_to: string
    san: string
    serial: string
    version: string
  }
}

interface CoreResult {
  wp: {
    version: string
    latest: string | null
    is_latest: boolean
    site_url: string
    multisite: boolean
  }
  php: {
    version: string
    short: string
    is_eol: boolean
    eol_soon: boolean
    eol_date: string | null
  }
  db: { version: string }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function severityBadge(sev: string, small = false) {
  const cls = small ? 'text-[10px] px-1.5 py-0' : ''
  if (sev === 'critical') return <Badge className={cn('bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-0', cls)}>Critical</Badge>
  if (sev === 'high')     return <Badge className={cn('bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-0', cls)}>High</Badge>
  if (sev === 'medium')   return <Badge className={cn('bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-0', cls)}>Medium</Badge>
  if (sev === 'low')      return <Badge className={cn('bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0', cls)}>Low</Badge>
  if (sev === 'warning')  return <Badge className={cn('bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-0', cls)}>Warning</Badge>
  return <Badge variant="outline" className={cls}>{sev}</Badge>
}

function computeScore(
  malware: MalwareResult | undefined,
  vulns: VulnResult | undefined,
  ssl: SslResult | undefined,
  core: CoreResult | undefined,
): { score: number; grade: string; gradeColor: string } {
  let score = 100

  // Malware.
  if (malware) {
    const criticals = malware.findings.filter(f => f.severity === 'critical').length
    const warnings  = malware.findings.filter(f => f.severity === 'warning').length
    score -= criticals * 20
    score -= warnings  * 5
  }

  // Vulnerabilities.
  if (vulns?.results) {
    for (const item of vulns.results) {
      for (const v of item.vulnerabilities) {
        if (v.severity === 'critical') score -= 15
        else if (v.severity === 'high') score -= 10
        else if (v.severity === 'medium') score -= 5
        else score -= 2
      }
    }
  }

  // SSL.
  if (ssl) {
    if (!ssl.https) score -= 20
    else if (!ssl.valid) score -= 20
    else if ((ssl.days_remaining ?? 999) < 14) score -= 10
    else if ((ssl.days_remaining ?? 999) < 30) score -= 5
  }

  // Core.
  if (core) {
    if (!core.wp.is_latest) score -= 10
    if (core.php.is_eol)    score -= 15
    else if (core.php.eol_soon) score -= 5
  }

  score = Math.max(0, score)

  let grade = 'A+'
  let gradeColor = 'text-green-600 dark:text-green-400'
  if (score < 90) { grade = 'A';  gradeColor = 'text-green-500 dark:text-green-400' }
  if (score < 80) { grade = 'B';  gradeColor = 'text-blue-500 dark:text-blue-400' }
  if (score < 70) { grade = 'C';  gradeColor = 'text-yellow-500 dark:text-yellow-400' }
  if (score < 50) { grade = 'D';  gradeColor = 'text-orange-500 dark:text-orange-400' }
  if (score < 30) { grade = 'F';  gradeColor = 'text-red-500 dark:text-red-400' }

  return { score, grade, gradeColor }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreRing({ score, grade, gradeColor }: { score: number; grade: string; gradeColor: string }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444'
  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/20" />
        <circle
          cx="60" cy="60" r={r}
          fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-3xl font-black leading-none', gradeColor)}>{grade}</span>
        <span className="text-lg font-bold text-foreground">{score}</span>
        <span className="text-[11px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SecurityScanner() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('overview')
  const [malwareScope, setMalwareScope] = useState('all')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [expandedVuln, setExpandedVuln] = useState<Set<string>>(new Set())

  // Track which scans have been manually triggered.
  const [malwareEnabled, setMalwareEnabled] = useState(false)
  const [vulnsEnabled, setVulnsEnabled]     = useState(false)
  const [sslEnabled, setSslEnabled]         = useState(false)
  const [coreEnabled, setCoreEnabled]       = useState(false)

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: malwareData, isFetching: malwareFetching, refetch: refetchMalware } = useQuery<MalwareResult>({
    queryKey: ['scanner-malware', malwareScope],
    queryFn: () => api.get(`/scanner/malware?scope=${malwareScope}`),
    enabled: malwareEnabled,
    staleTime: Infinity,
  })

  const { data: vulnsData, isFetching: vulnsFetching, refetch: refetchVulns } = useQuery<VulnResult>({
    queryKey: ['scanner-vulns'],
    queryFn: () => api.get('/scanner/vulns'),
    enabled: vulnsEnabled,
    staleTime: Infinity,
  })

  const { data: sslData, isFetching: sslFetching, refetch: refetchSsl } = useQuery<SslResult>({
    queryKey: ['scanner-ssl'],
    queryFn: () => api.get('/scanner/ssl'),
    enabled: sslEnabled,
    staleTime: Infinity,
  })

  const { data: coreData, isFetching: coreFetching, refetch: refetchCore } = useQuery<CoreResult>({
    queryKey: ['scanner-core'],
    queryFn: () => api.get('/scanner/core'),
    enabled: coreEnabled,
    staleTime: Infinity,
  })

  const { data: apiKeyStatus, refetch: refetchApiKey } = useQuery<{ configured: boolean; masked: string }>({
    queryKey: ['scanner-api-key'],
    queryFn: () => api.get('/scanner/api-key'),
    staleTime: 60000,
  })

  // ── Mutations ────────────────────────────────────────────────────────────

  const saveApiKeyMutation = useMutation({
    mutationFn: (key: string) => api.post('/scanner/api-key', { api_key: key }),
    onSuccess: () => {
      toast.success('API key saved')
      setApiKeyInput('')
      refetchApiKey()
    },
    onError: () => toast.error('Failed to save API key'),
  })

  // ── Run All ──────────────────────────────────────────────────────────────

  function runAllScans() {
    if (!malwareEnabled) { setMalwareEnabled(true) } else { refetchMalware() }
    if (!sslEnabled)     { setSslEnabled(true)     } else { refetchSsl() }
    if (!coreEnabled)    { setCoreEnabled(true)     } else { refetchCore() }
    if (!vulnsEnabled)   { setVulnsEnabled(true)    } else { refetchVulns() }
  }

  const anyRunning = malwareFetching || vulnsFetching || sslFetching || coreFetching
  const hasResults = malwareData || vulnsData || sslData || coreData

  const { score, grade, gradeColor } = computeScore(malwareData, vulnsData, sslData, coreData)

  // ── Summary cards for Overview ───────────────────────────────────────────

  function MalwareSummaryCard() {
    if (!malwareData && !malwareFetching) return (
      <button onClick={() => { setMalwareEnabled(true); setTimeout(() => refetchMalware(), 0) }}
        className="text-left w-full p-4 rounded-lg border border-dashed hover:border-primary/50 transition-colors text-muted-foreground text-sm">
        Click to run malware scan
      </button>
    )
    if (malwareFetching) return <div className="p-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Scanning files…</div>
    const criticals = malwareData!.findings.filter(f => f.severity === 'critical').length
    const warnings  = malwareData!.findings.filter(f => f.severity === 'warning').length
    return (
      <div className={cn('p-4 rounded-lg border', malwareData!.clean ? 'border-green-500/30 bg-green-50/50 dark:bg-green-900/10' : 'border-red-500/30 bg-red-50/50 dark:bg-red-900/10')}>
        <div className="flex items-center gap-2 mb-1">
          {malwareData!.clean ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
          <span className="font-medium text-sm">Malware Scanner</span>
        </div>
        {malwareData!.clean
          ? <p className="text-xs text-muted-foreground">{malwareData!.scanned.toLocaleString()} files scanned — clean</p>
          : <p className="text-xs text-red-600 dark:text-red-400">{criticals} critical, {warnings} warning{warnings !== 1 ? 's' : ''} in {malwareData!.scanned.toLocaleString()} files</p>
        }
      </div>
    )
  }

  function VulnSummaryCard() {
    if (vulnsData?.error === 'no_api_key') return (
      <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-50/50 dark:bg-yellow-900/10">
        <div className="flex items-center gap-2 mb-1"><Key className="w-4 h-4 text-yellow-500" /><span className="font-medium text-sm">Vulnerabilities</span></div>
        <p className="text-xs text-muted-foreground">WPScan API key required — configure below</p>
      </div>
    )
    if (!vulnsData && !vulnsFetching) return (
      <button onClick={() => { setVulnsEnabled(true); setTimeout(() => refetchVulns(), 0) }}
        className="text-left w-full p-4 rounded-lg border border-dashed hover:border-primary/50 transition-colors text-muted-foreground text-sm">
        Click to check vulnerabilities
      </button>
    )
    if (vulnsFetching) return <div className="p-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Checking CVE database…</div>
    const count = vulnsData!.with_vulns
    return (
      <div className={cn('p-4 rounded-lg border', count === 0 ? 'border-green-500/30 bg-green-50/50 dark:bg-green-900/10' : 'border-red-500/30 bg-red-50/50 dark:bg-red-900/10')}>
        <div className="flex items-center gap-2 mb-1">
          {count === 0 ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <ShieldAlert className="w-4 h-4 text-red-500" />}
          <span className="font-medium text-sm">Vulnerabilities</span>
        </div>
        {count === 0
          ? <p className="text-xs text-muted-foreground">{vulnsData!.total} plugins/themes checked — no known CVEs</p>
          : <p className="text-xs text-red-600 dark:text-red-400">{count} item{count !== 1 ? 's' : ''} with known vulnerabilities</p>
        }
      </div>
    )
  }

  function SslSummaryCard() {
    if (!sslData && !sslFetching) return (
      <button onClick={() => { setSslEnabled(true); setTimeout(() => refetchSsl(), 0) }}
        className="text-left w-full p-4 rounded-lg border border-dashed hover:border-primary/50 transition-colors text-muted-foreground text-sm">
        Click to check SSL certificate
      </button>
    )
    if (sslFetching) return <div className="p-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Checking SSL…</div>
    const ok = sslData!.valid && (sslData!.days_remaining ?? 0) > 14
    const soon = sslData!.valid && (sslData!.days_remaining ?? 0) <= 14
    return (
      <div className={cn('p-4 rounded-lg border',
        ok    ? 'border-green-500/30 bg-green-50/50 dark:bg-green-900/10' :
        soon  ? 'border-yellow-500/30 bg-yellow-50/50 dark:bg-yellow-900/10' :
                'border-red-500/30 bg-red-50/50 dark:bg-red-900/10'
      )}>
        <div className="flex items-center gap-2 mb-1">
          {ok ? <Lock className="w-4 h-4 text-green-500" /> : <ShieldOff className="w-4 h-4 text-red-500" />}
          <span className="font-medium text-sm">SSL Certificate</span>
        </div>
        {!sslData!.https
          ? <p className="text-xs text-red-600 dark:text-red-400">Site not using HTTPS</p>
          : !sslData!.valid
          ? <p className="text-xs text-red-600 dark:text-red-400">Certificate invalid or expired</p>
          : soon
          ? <p className="text-xs text-yellow-600 dark:text-yellow-400">Expires in {sslData!.days_remaining} days — renew soon</p>
          : <p className="text-xs text-muted-foreground">Valid · {sslData!.days_remaining} days remaining · {sslData!.cert?.issuer}</p>
        }
      </div>
    )
  }

  function CoreSummaryCard() {
    if (!coreData && !coreFetching) return (
      <button onClick={() => { setCoreEnabled(true); setTimeout(() => refetchCore(), 0) }}
        className="text-left w-full p-4 rounded-lg border border-dashed hover:border-primary/50 transition-colors text-muted-foreground text-sm">
        Click to check core versions
      </button>
    )
    if (coreFetching) return <div className="p-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Checking versions…</div>
    const issues = []
    if (!coreData!.wp.is_latest) issues.push(`WP ${coreData!.wp.version} → ${coreData!.wp.latest} available`)
    if (coreData!.php.is_eol)    issues.push(`PHP ${coreData!.php.version} is EOL`)
    else if (coreData!.php.eol_soon) issues.push(`PHP ${coreData!.php.version} EOL soon (${coreData!.php.eol_date})`)
    return (
      <div className={cn('p-4 rounded-lg border', issues.length === 0 ? 'border-green-500/30 bg-green-50/50 dark:bg-green-900/10' : 'border-yellow-500/30 bg-yellow-50/50 dark:bg-yellow-900/10')}>
        <div className="flex items-center gap-2 mb-1">
          {issues.length === 0 ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <AlertTriangle className="w-4 h-4 text-yellow-500" />}
          <span className="font-medium text-sm">Core & PHP</span>
        </div>
        {issues.length === 0
          ? <p className="text-xs text-muted-foreground">WordPress {coreData!.wp.version} (latest) · PHP {coreData!.php.version}</p>
          : issues.map((i, idx) => <p key={idx} className="text-xs text-yellow-600 dark:text-yellow-400">{i}</p>)
        }
      </div>
    )
  }

  return (
    <div className="fade-in">
      <PageHeader
        title="Security Scanner"
        description="Proactive threat detection — malware, CVEs, SSL, and core version checks"
        actions={
          <Button onClick={runAllScans} disabled={anyRunning} size="sm">
            {anyRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Run All Scans
          </Button>
        }
      />

      <div className="p-6 space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <ShieldCheck className="w-4 h-4 mr-1.5" />Overview
          </TabsTrigger>
          <TabsTrigger value="malware">
            <Code2 className="w-4 h-4 mr-1.5" />Malware Scanner
          </TabsTrigger>
          <TabsTrigger value="vulns">
            <ShieldAlert className="w-4 h-4 mr-1.5" />Vulnerabilities
          </TabsTrigger>
          <TabsTrigger value="ssl-core">
            <Globe className="w-4 h-4 mr-1.5" />SSL &amp; Core
          </TabsTrigger>
        </TabsList>

        {/* ── Overview ──────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Security Score</CardTitle>
                <CardDescription>Based on completed scans</CardDescription>
              </CardHeader>
              <CardContent>
                {!hasResults
                  ? <div className="text-center py-6 text-muted-foreground text-sm">
                      Run scans to compute your security score.
                    </div>
                  : <div className="space-y-4">
                      <ScoreRing score={score} grade={grade} gradeColor={gradeColor} />
                      <p className="text-center text-xs text-muted-foreground">
                        {score >= 90 ? 'Excellent — keep it up!' :
                         score >= 70 ? 'Good — a few things to fix.' :
                         score >= 50 ? 'Fair — address the issues below.' :
                         'Poor — immediate action required.'}
                      </p>
                    </div>
                }
              </CardContent>
            </Card>

            {/* Summary cards */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
              <MalwareSummaryCard />
              <VulnSummaryCard />
              <SslSummaryCard />
              <CoreSummaryCard />
            </div>
          </div>

          {!hasResults && !anyRunning && (
            <Alert>
              <ScanLine className="w-4 h-4" />
              <AlertDescription>
                Click <strong>Run All Scans</strong> to analyse your site, or click individual cards to run specific checks.
                Each scan can also be configured independently in its tab.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* ── Malware Scanner ───────────────────────────────────────── */}
        <TabsContent value="malware" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Malware Scanner</CardTitle>
                  <CardDescription>Scan PHP, JS, and HTML files for known malicious code patterns</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={malwareScope} onValueChange={setMalwareScope}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All (plugins + themes)</SelectItem>
                      <SelectItem value="plugins">Plugins only</SelectItem>
                      <SelectItem value="themes">Themes only</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm" variant="outline"
                    disabled={malwareFetching}
                    onClick={() => { setMalwareEnabled(true); setTimeout(() => refetchMalware(), 0) }}
                  >
                    {malwareFetching ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ScanLine className="w-4 h-4 mr-1.5" />}
                    Scan Now
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!malwareData && !malwareFetching && (
                <div className="text-center py-12 text-muted-foreground">
                  <Code2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Click <strong>Scan Now</strong> to start scanning.</p>
                  <p className="text-xs mt-1">Scans up to 8,000 PHP/JS/HTML files. Large files (&gt;512 KB) are skipped.</p>
                </div>
              )}

              {malwareFetching && (
                <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Scanning files… this may take a few seconds.</span>
                </div>
              )}

              {malwareData && !malwareFetching && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    {malwareData.clean
                      ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                      : <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                    }
                    <div className="text-sm">
                      <span className="font-medium">{malwareData.scanned.toLocaleString()} files scanned</span>
                      {malwareData.clean
                        ? <span className="text-green-600 dark:text-green-400 ml-2">— No malicious patterns found.</span>
                        : <span className="text-red-600 dark:text-red-400 ml-2">— {malwareData.findings.length} suspicious file{malwareData.findings.length !== 1 ? 's' : ''} found.</span>
                      }
                    </div>
                  </div>

                  {malwareData.findings.length > 0 && (
                    <div className="border rounded-lg divide-y">
                      {malwareData.findings.map((f, i) => (
                        <div key={i} className="p-3 space-y-1">
                          <div className="flex items-start gap-2">
                            {severityBadge(f.severity, true)}
                            <span className="text-xs font-mono text-foreground break-all">{f.file}</span>
                            {f.line > 0 && (
                              <span className="text-[10px] text-muted-foreground shrink-0 ml-auto">line {f.line}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground pl-1">{f.pattern}</p>
                          {f.snippet && (
                            <pre className="text-[11px] bg-muted/60 rounded px-2 py-1 overflow-x-auto text-red-700 dark:text-red-400 mt-1">
                              {f.snippet}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Vulnerabilities ───────────────────────────────────────── */}
        <TabsContent value="vulns" className="space-y-4 mt-4">
          {/* API Key card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="w-4 h-4" />WPScan API Key
              </CardTitle>
              <CardDescription>
                A free API key from <a href="https://wpscan.com/register" target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">wpscan.com</a> allows up to 25 API requests per day.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder={apiKeyStatus?.configured ? apiKeyStatus.masked : 'Paste your WPScan API token…'}
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button
                  size="sm"
                  disabled={!apiKeyInput || saveApiKeyMutation.isPending}
                  onClick={() => saveApiKeyMutation.mutate(apiKeyInput)}
                >
                  {saveApiKeyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </Button>
                {apiKeyStatus?.configured && (
                  <Button size="sm" variant="outline" onClick={() => saveApiKeyMutation.mutate('')}>
                    Clear
                  </Button>
                )}
              </div>
              {apiKeyStatus?.configured && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />API key configured ({apiKeyStatus.masked})
                </p>
              )}
            </CardContent>
          </Card>

          {/* Vulnerability results card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Plugin &amp; Theme CVEs</CardTitle>
                  <CardDescription>Checked against the WPScan vulnerability database</CardDescription>
                </div>
                <Button
                  size="sm" variant="outline"
                  disabled={vulnsFetching}
                  onClick={() => { setVulnsEnabled(true); setTimeout(() => refetchVulns(), 0) }}
                >
                  {vulnsFetching ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
                  Check Now
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!vulnsData && !vulnsFetching && (
                <div className="text-center py-10 text-muted-foreground">
                  <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Configure an API key above, then click <strong>Check Now</strong>.</p>
                </div>
              )}

              {vulnsFetching && (
                <div className="flex items-center justify-center gap-3 py-10 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Checking CVE database…</span>
                </div>
              )}

              {vulnsData?.error === 'no_api_key' && (
                <Alert>
                  <Key className="w-4 h-4" />
                  <AlertDescription>
                    {vulnsData.message}{' '}
                    <a href={vulnsData.api_key_url} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline inline-flex items-center gap-1">
                      Get a free key <ExternalLink className="w-3 h-3" />
                    </a>
                  </AlertDescription>
                </Alert>
              )}

              {vulnsData && !vulnsData.error && !vulnsFetching && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 text-sm">
                    {vulnsData.with_vulns === 0
                      ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                      : <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
                    }
                    <span>
                      <strong>{vulnsData.total}</strong> plugins/themes checked —{' '}
                      {vulnsData.with_vulns === 0
                        ? <span className="text-green-600 dark:text-green-400">no known vulnerabilities.</span>
                        : <span className="text-red-600 dark:text-red-400">{vulnsData.with_vulns} with active CVEs.</span>
                      }
                    </span>
                  </div>

                  {vulnsData.results.length > 0 && (
                    <div className="border rounded-lg divide-y">
                      {vulnsData.results.map((item) => {
                        const key = `${item.type}-${item.slug}`
                        const expanded = expandedVuln.has(key)
                        return (
                          <div key={key}>
                            <button
                              className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40 transition-colors"
                              onClick={() => setExpandedVuln(prev => {
                                const next = new Set(prev)
                                next.has(key) ? next.delete(key) : next.add(key)
                                return next
                              })}
                            >
                              {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium truncate">{item.name}</span>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                                    {item.type}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground shrink-0">v{item.version}</span>
                                </div>
                              </div>
                              {item.vulnerabilities.length > 0
                                ? <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-0 shrink-0">
                                    {item.vulnerabilities.length} CVE{item.vulnerabilities.length !== 1 ? 's' : ''}
                                  </Badge>
                                : <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0 shrink-0">Clean</Badge>
                              }
                            </button>

                            {expanded && item.vulnerabilities.length > 0 && (
                              <div className="bg-muted/30 px-4 pb-3 space-y-2">
                                {item.vulnerabilities.map((v) => (
                                  <div key={v.id} className="border rounded p-3 bg-background space-y-1.5">
                                    <div className="flex items-start gap-2 flex-wrap">
                                      {severityBadge(v.severity, true)}
                                      <span className="text-sm font-medium">{v.title}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                      {v.type && <span>Type: {v.type}</span>}
                                      {v.score && <span>CVSS: {v.score}</span>}
                                      {v.fixed_in && <span className="text-green-600 dark:text-green-400">Fixed in v{v.fixed_in}</span>}
                                    </div>
                                    {v.references.length > 0 && (
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {v.references.slice(0, 3).map((ref, ri) => (
                                          <a key={ri} href={ref.url} target="_blank" rel="noopener noreferrer"
                                            className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5">
                                            {ref.type === 'cve' ? 'CVE' : 'Reference'} <ExternalLink className="w-2.5 h-2.5" />
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SSL & Core ────────────────────────────────────────────── */}
        <TabsContent value="ssl-core" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* SSL */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lock className="w-4 h-4" />SSL Certificate
                    </CardTitle>
                    <CardDescription>Certificate validity and expiry</CardDescription>
                  </div>
                  <Button
                    size="sm" variant="outline"
                    disabled={sslFetching}
                    onClick={() => { setSslEnabled(true); setTimeout(() => refetchSsl(), 0) }}
                  >
                    {sslFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!sslData && !sslFetching && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Click refresh to check SSL certificate.
                  </div>
                )}
                {sslFetching && (
                  <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />Connecting to {window.location.hostname}:443…
                  </div>
                )}
                {sslData && !sslFetching && (
                  <div className="space-y-3">
                    <div className={cn('flex items-center gap-3 p-3 rounded-lg',
                      !sslData.https ? 'bg-red-50 dark:bg-red-900/10' :
                      !sslData.valid ? 'bg-red-50 dark:bg-red-900/10' :
                      (sslData.days_remaining ?? 0) < 14 ? 'bg-yellow-50 dark:bg-yellow-900/10' :
                      'bg-green-50 dark:bg-green-900/10'
                    )}>
                      {!sslData.https || !sslData.valid
                        ? <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                        : (sslData.days_remaining ?? 0) < 14
                        ? <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                        : <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                      }
                      <div className="text-sm">
                        <p className="font-medium">
                          {!sslData.https ? 'No SSL (HTTP only)' :
                           !sslData.valid ? 'Certificate invalid / expired' :
                           `Valid · ${sslData.days_remaining} days remaining`}
                        </p>
                        {sslData.error && <p className="text-xs text-muted-foreground">{sslData.error}</p>}
                      </div>
                    </div>

                    {sslData.cert && (
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        {[
                          ['Host', sslData.host],
                          ['Subject', sslData.cert.subject],
                          ['Issuer', sslData.cert.issuer],
                          ['Valid From', sslData.cert.valid_from],
                          ['Valid To', sslData.cert.valid_to],
                          sslData.cert.san ? ['SAN', sslData.cert.san.replace(/DNS:/g, '').replace(/,\s*/g, ', ')] : null,
                        ].filter((item): item is [string, string] => Array.isArray(item)).map(([label, value]) => (
                          <div key={label}>
                            <dt className="text-muted-foreground font-medium">{label}</dt>
                            <dd className="truncate mt-0.5">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Core & PHP */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Cpu className="w-4 h-4" />Core &amp; PHP Versions
                    </CardTitle>
                    <CardDescription>WordPress, PHP, and database version status</CardDescription>
                  </div>
                  <Button
                    size="sm" variant="outline"
                    disabled={coreFetching}
                    onClick={() => { setCoreEnabled(true); setTimeout(() => refetchCore(), 0) }}
                  >
                    {coreFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!coreData && !coreFetching && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Click refresh to check versions.
                  </div>
                )}
                {coreFetching && (
                  <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />Fetching version data…
                  </div>
                )}
                {coreData && !coreFetching && (
                  <div className="space-y-3">
                    {/* WordPress */}
                    <div className={cn('flex items-center gap-3 p-3 rounded-lg',
                      coreData.wp.is_latest ? 'bg-green-50 dark:bg-green-900/10' : 'bg-yellow-50 dark:bg-yellow-900/10'
                    )}>
                      {coreData.wp.is_latest
                        ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                        : <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                      }
                      <div className="text-sm">
                        <p className="font-medium">WordPress {coreData.wp.version}</p>
                        {coreData.wp.is_latest
                          ? <p className="text-xs text-muted-foreground">Latest version installed</p>
                          : <p className="text-xs text-yellow-600 dark:text-yellow-400">
                              Update available: v{coreData.wp.latest}
                            </p>
                        }
                      </div>
                    </div>

                    {/* PHP */}
                    <div className={cn('flex items-center gap-3 p-3 rounded-lg',
                      coreData.php.is_eol    ? 'bg-red-50 dark:bg-red-900/10' :
                      coreData.php.eol_soon  ? 'bg-yellow-50 dark:bg-yellow-900/10' :
                                               'bg-green-50 dark:bg-green-900/10'
                    )}>
                      {coreData.php.is_eol
                        ? <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                        : coreData.php.eol_soon
                        ? <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                        : <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                      }
                      <div className="text-sm">
                        <p className="font-medium">PHP {coreData.php.version}</p>
                        {coreData.php.is_eol
                          ? <p className="text-xs text-red-600 dark:text-red-400">End-of-life since {coreData.php.eol_date} — upgrade immediately</p>
                          : coreData.php.eol_soon
                          ? <p className="text-xs text-yellow-600 dark:text-yellow-400">Reaches EOL on {coreData.php.eol_date}</p>
                          : <p className="text-xs text-muted-foreground">Actively maintained · EOL {coreData.php.eol_date}</p>
                        }
                      </div>
                    </div>

                    {/* DB */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                      <CheckCircle2 className="w-5 h-5 text-muted-foreground shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium">Database {coreData.db.version}</p>
                        <p className="text-xs text-muted-foreground">MySQL / MariaDB</p>
                      </div>
                    </div>

                    {coreData.wp.multisite && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 pl-1">
                        <Globe className="w-3 h-3" />Multisite network detected
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  )
}
