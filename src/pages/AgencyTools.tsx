import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Mail, Eye, RotateCcw, Trash2, Shield, LayoutDashboard, FileBarChart2,
  Rocket, Download, Copy, Check, Loader2, ExternalLink, ImageIcon, X,
  Palette, Type, Layout, Image,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

// ── WordPress Media Library helper ────────────────────────────────────────────

declare global {
  interface Window {
    wp?: {
      media?: (args: {
        title?: string
        multiple?: boolean
        library?: { type?: string }
        button?: { text?: string }
      }) => {
        on: (event: string, cb: () => void) => void
        state: () => { get: (key: string) => { first: () => { toJSON: () => { url: string; width: number; height: number; filename: string } } } }
        open: () => void
      }
    }
  }
}

function openMediaPicker(title: string, onSelect: (url: string) => void) {
  if (typeof window === 'undefined' || !window.wp?.media) {
    const url = prompt('Enter image URL:')
    if (url) onSelect(url.trim())
    return
  }
  const frame = window.wp.media({
    title,
    multiple: false,
    library: { type: 'image' },
    button: { text: 'Use this image' },
  })
  frame.on('select', () => {
    const att = frame.state().get('selection').first().toJSON()
    onSelect(att.url)
  })
  frame.open()
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface MailSettings { dev_mode: boolean; log_count: number }
interface MailEntry {
  id: string; to: string; subject: string; message: string
  content_type: string; date: string; status: 'sent' | 'intercepted'
}
interface LoginSettings {
  enabled: boolean; logo_url: string; bg_color: string
  bg_image: string; heading: string; footer: string; btn_color: string
}
interface AdminCustomiser {
  hidden_menus: string[]; hidden_widgets: string[]
  available_menus: { slug: string; label: string }[]
  available_widgets: { id: string; label: string; context: string }[]
}
interface ReportData {
  site_name: string; site_url: string; generated_at: string
  wp_version: string; php_version: string; db_size_mb: number
  ssl: boolean; debug_disabled: boolean; updates_pending: number
  last_backup: string; score: number
  active_plugins: { name: string; version: string; author: string; has_update: boolean }[]
  theme: { name: string; version: string; author: string; has_update: boolean }
}
interface ComingSoonSettings {
  active: boolean; title: string; message: string; launch_date: string
  email_capture: boolean; emails: string[]; bg_color: string; accent_color: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AgencyTools() {
  const qc = useQueryClient()
  const [previewMail, setPreviewMail] = useState<MailEntry | null>(null)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [reportGenerating, setReportGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  // ── Mail Interceptor ────────────────────────────────────────────────────────

  const { data: mailSettings } = useQuery<MailSettings>({
    queryKey: ['agency-mail-settings'],
    queryFn: () => api.get('/agency/mail-settings'),
  })
  const { data: mailLog } = useQuery<{ items: MailEntry[] }>({
    queryKey: ['agency-mail-log'],
    queryFn: () => api.get('/agency/mail-log'),
  })

  const toggleDevMode = useMutation({
    mutationFn: (dev_mode: boolean) => api.post('/agency/mail-settings', { dev_mode }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agency-mail-settings'] }); toast.success('Mail settings saved') },
  })
  const clearMailLog = useMutation({
    mutationFn: () => api.delete('/agency/mail-log/clear'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agency-mail-log', 'agency-mail-settings'] }); toast.success('Mail log cleared') },
  })
  const resendMail = useMutation({
    mutationFn: (id: string) => api.post('/agency/mail-resend', { id }),
    onSuccess: () => toast.success('Email resent'),
    onError: (e: Error) => toast.error(e.message),
  })

  // ── Login Page ──────────────────────────────────────────────────────────────

  const { data: loginSettings } = useQuery<LoginSettings>({
    queryKey: ['agency-login'],
    queryFn: () => api.get('/agency/login-page'),
  })
  const [login, setLogin] = useState<Partial<LoginSettings>>({})

  const updateLogin = (key: keyof LoginSettings, val: string | boolean) =>
    setLogin(prev => ({ ...prev, [key]: val }))

  const saveLogin = useMutation({
    mutationFn: () => api.post('/agency/login-page', {
      ...loginSettings,
      ...login,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agency-login'] }); setLogin({}); toast.success('Login page settings saved') },
    onError: (e: Error) => toast.error(e.message),
  })

  const merged = { ...loginSettings, ...login } as LoginSettings

  // ── Admin Customiser ────────────────────────────────────────────────────────

  const { data: customiser } = useQuery<AdminCustomiser>({
    queryKey: ['agency-customiser'],
    queryFn: () => api.get('/agency/admin-customiser'),
  })
  const [hiddenMenus, setHiddenMenus] = useState<string[]>([])
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([])
  const [customiserInit, setCustomiserInit] = useState(false)

  if (customiser && !customiserInit) {
    setHiddenMenus(customiser.hidden_menus)
    setHiddenWidgets(customiser.hidden_widgets)
    setCustomiserInit(true)
  }

  const saveCustomiser = useMutation({
    mutationFn: () => api.post('/agency/admin-customiser', { hidden_menus: hiddenMenus, hidden_widgets: hiddenWidgets }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agency-customiser'] }); toast.success('Admin UI settings saved') },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleMenu = (slug: string) =>
    setHiddenMenus(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug])
  const toggleWidget = (id: string) =>
    setHiddenWidgets(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])

  // ── Client Report ───────────────────────────────────────────────────────────

  const generateReport = async () => {
    setReportGenerating(true)
    try {
      const data = await api.get<ReportData>('/agency/report')
      setReportData(data)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setReportGenerating(false)
    }
  }

  const downloadReport = () => {
    if (!reportData) return
    const html = buildReportHtml(reportData)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `site-report-${reportData.site_name.replace(/\s+/g, '-').toLowerCase()}.html`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Report downloaded')
  }

  const copyReport = async () => {
    if (!reportData) return
    await navigator.clipboard.writeText(buildReportHtml(reportData))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Report HTML copied to clipboard')
  }

  // ── Coming Soon ─────────────────────────────────────────────────────────────

  const { data: csData } = useQuery<ComingSoonSettings>({
    queryKey: ['agency-coming-soon'],
    queryFn: () => api.get('/agency/coming-soon'),
  })
  const [cs, setCs] = useState<Partial<ComingSoonSettings>>({})
  const updateCs = (key: keyof ComingSoonSettings, val: any) => setCs(prev => ({ ...prev, [key]: val }))
  const mergedCs = { ...csData, ...cs } as ComingSoonSettings

  const saveCs = useMutation({
    mutationFn: () => api.post('/agency/coming-soon', mergedCs),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agency-coming-soon'] }); setCs({}); toast.success('Coming Soon settings saved') },
    onError: (e: Error) => toast.error(e.message),
  })
  const clearCsEmails = useMutation({
    mutationFn: () => api.delete('/agency/coming-soon/emails/clear'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agency-coming-soon'] }); toast.success('Captured emails cleared') },
  })

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-200">
      <PageHeader
        title="Agency Tools"
        description="Client delivery, white-labelling, and professional workflow tools"
      />

      <Tabs defaultValue="mail">
        <TabsList className="mb-6">
          <TabsTrigger value="mail"><Mail className="w-3.5 h-3.5 mr-1.5" />Mail Interceptor</TabsTrigger>
          <TabsTrigger value="login"><Shield className="w-3.5 h-3.5 mr-1.5" />Login Page</TabsTrigger>
          <TabsTrigger value="customiser"><LayoutDashboard className="w-3.5 h-3.5 mr-1.5" />Admin UI</TabsTrigger>
          <TabsTrigger value="report"><FileBarChart2 className="w-3.5 h-3.5 mr-1.5" />Client Report</TabsTrigger>
          <TabsTrigger value="coming-soon"><Rocket className="w-3.5 h-3.5 mr-1.5" />Coming Soon</TabsTrigger>
        </TabsList>

        {/* ── Mail Interceptor ─────────────────────────────────────────────── */}
        <TabsContent value="mail" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Mail Interceptor</CardTitle>
                  <CardDescription>Log all outgoing WordPress emails. Dev mode prevents real delivery.</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-500">{mailSettings?.dev_mode ? 'Dev mode ON — emails intercepted' : 'Logging only — emails sent normally'}</span>
                  <Switch
                    checked={mailSettings?.dev_mode ?? false}
                    onCheckedChange={v => toggleDevMode.mutate(v)}
                  />
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Email Log <Badge variant="outline" className="ml-2">{mailLog?.items.length ?? 0}</Badge></CardTitle>
                <Button variant="outline" size="sm" onClick={() => clearMailLog.mutate()} disabled={!mailLog?.items.length}>
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Clear Log
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!mailLog?.items.length ? (
                <div className="text-center py-12 text-slate-400">
                  <Mail className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No emails logged yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {mailLog.items.map(entry => (
                    <div key={entry.id} className="flex items-center gap-4 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium truncate">{entry.subject}</span>
                          <Badge className={entry.status === 'intercepted' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-0 text-xs' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0 text-xs'}>
                            {entry.status === 'intercepted' ? 'Intercepted' : 'Sent'}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 truncate">To: {entry.to} &middot; {entry.date}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setPreviewMail(entry)}>
                          <Eye className="w-3.5 h-3.5 mr-1" /> Preview
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => resendMail.mutate(entry.id)} disabled={resendMail.isPending}>
                          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Resend
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── White-label Login Page ───────────────────────────────────────── */}
        <TabsContent value="login" className="space-y-4">
          {/* Header card: enable toggle */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">White-label Login Page</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Customise wp-login.php with your client's branding</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${merged.enabled ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                    {merged.enabled ? 'Active' : 'Inactive'}
                  </span>
                  <Switch checked={merged.enabled ?? false} onCheckedChange={v => updateLogin('enabled', v)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main layout: settings + live preview side-by-side */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">

            {/* ── Left: Settings ── */}
            <div className="xl:col-span-3 space-y-4">

              {/* Logo section */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-slate-500" /> Logo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Logo URL + thumbnail + media picker */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://example.com/logo.png"
                        value={merged.logo_url ?? ''}
                        onChange={e => updateLogin('logo_url', e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="outline" size="sm" type="button"
                        onClick={() => openMediaPicker('Choose Logo', url => updateLogin('logo_url', url))}
                        className="shrink-0 gap-1.5"
                      >
                        <ImageIcon className="w-3.5 h-3.5" /> Media
                      </Button>
                      {merged.logo_url && (
                        <Button
                          variant="ghost" size="sm" type="button"
                          onClick={() => updateLogin('logo_url', '')}
                          className="shrink-0 text-slate-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    {merged.logo_url && (
                      <div className="flex items-center gap-3 p-2.5 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <img
                          src={merged.logo_url} alt="Logo preview"
                          className="max-h-10 max-w-[140px] object-contain rounded"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                        <p className="text-xs text-slate-400 truncate">{merged.logo_url}</p>
                      </div>
                    )}
                    <p className="text-xs text-slate-400">Recommended: transparent PNG, 220×80 px or wider</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5" /> Logo tooltip / heading text
                    </Label>
                    <Input
                      placeholder="Log in to your site"
                      value={merged.heading ?? ''}
                      onChange={e => updateLogin('heading', e.target.value)}
                    />
                    <p className="text-xs text-slate-400">Replaces the "Powered by WordPress" tooltip shown on hover</p>
                  </div>
                </CardContent>
              </Card>

              {/* Colours section */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Palette className="w-4 h-4 text-slate-500" /> Colours
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Background colour</Label>
                    <div className="flex gap-2 items-center">
                      <label className="relative cursor-pointer shrink-0">
                        <input
                          type="color"
                          value={merged.bg_color ?? '#f0f0f1'}
                          onChange={e => updateLogin('bg_color', e.target.value)}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        />
                        <span
                          className="block w-9 h-9 rounded-md border-2 border-white dark:border-slate-700 shadow-sm"
                          style={{ background: merged.bg_color ?? '#f0f0f1' }}
                        />
                      </label>
                      <Input
                        value={merged.bg_color ?? '#f0f0f1'}
                        onChange={e => updateLogin('bg_color', e.target.value)}
                        className="font-mono text-sm"
                        maxLength={7}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Button colour</Label>
                    <div className="flex gap-2 items-center">
                      <label className="relative cursor-pointer shrink-0">
                        <input
                          type="color"
                          value={merged.btn_color ?? '#2271b1'}
                          onChange={e => updateLogin('btn_color', e.target.value)}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        />
                        <span
                          className="block w-9 h-9 rounded-md border-2 border-white dark:border-slate-700 shadow-sm"
                          style={{ background: merged.btn_color ?? '#2271b1' }}
                        />
                      </label>
                      <Input
                        value={merged.btn_color ?? '#2271b1'}
                        onChange={e => updateLogin('btn_color', e.target.value)}
                        className="font-mono text-sm"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Background image section */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Image className="w-4 h-4 text-slate-500" /> Background Image
                    <span className="text-xs font-normal text-slate-400">(optional)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://example.com/bg.jpg"
                      value={merged.bg_image ?? ''}
                      onChange={e => updateLogin('bg_image', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline" size="sm" type="button"
                      onClick={() => openMediaPicker('Choose Background Image', url => updateLogin('bg_image', url))}
                      className="shrink-0 gap-1.5"
                    >
                      <ImageIcon className="w-3.5 h-3.5" /> Media
                    </Button>
                    {merged.bg_image && (
                      <Button
                        variant="ghost" size="sm" type="button"
                        onClick={() => updateLogin('bg_image', '')}
                        className="shrink-0 text-slate-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">Overrides background colour when set. Recommended: 1920×1080 JPG.</p>
                </CardContent>
              </Card>

              {/* Text section */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Layout className="w-4 h-4 text-slate-500" /> Page Text
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Footer text</Label>
                    <Input
                      placeholder="© 2026 Your Company. All rights reserved."
                      value={merged.footer ?? ''}
                      onChange={e => updateLogin('footer', e.target.value)}
                    />
                    <p className="text-xs text-slate-400">Small text shown below the login form</p>
                  </div>
                </CardContent>
              </Card>

              {/* Save + open */}
              <div className="flex items-center justify-between pt-1">
                <a
                  href={typeof window !== 'undefined' ? `${window.wpManagerPro?.siteUrl || ''}/wp-login.php` : '#'}
                  target="_blank" rel="noopener"
                  className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1.5 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open login page
                </a>
                <Button onClick={() => saveLogin.mutate()} disabled={saveLogin.isPending}>
                  {saveLogin.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Save Login Settings
                </Button>
              </div>
            </div>

            {/* ── Right: Live preview ── */}
            <div className="xl:col-span-2 sticky top-6">
              <Card className="overflow-hidden">
                <CardHeader className="py-3 px-4 border-b border-slate-100 dark:border-slate-800">
                  <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-slate-500 uppercase tracking-wide">
                    <Eye className="w-3.5 h-3.5" /> Live Preview
                  </CardTitle>
                </CardHeader>
                {/* Simulated login page */}
                <div
                  className="min-h-[460px] flex flex-col items-center justify-center gap-4 p-6 transition-all duration-300"
                  style={{
                    background: merged.bg_image
                      ? `url(${merged.bg_image}) center/cover no-repeat`
                      : (merged.bg_color ?? '#f0f0f1'),
                  }}
                >
                  {/* Logo */}
                  <div className="mb-1">
                    {merged.logo_url ? (
                      <img
                        src={merged.logo_url} alt="Logo"
                        className="max-h-16 max-w-[200px] object-contain drop-shadow"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center shadow-md">
                        <Shield className="w-8 h-8 text-white/70" />
                      </div>
                    )}
                  </div>

                  {/* Simulated login form */}
                  <div className="w-full max-w-[280px] bg-white dark:bg-slate-900 rounded-lg shadow-xl p-5 space-y-3">
                    {merged.heading && (
                      <p className="text-center text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        {merged.heading}
                      </p>
                    )}
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500 mb-0.5">Username or Email</div>
                      <div className="h-8 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500 mb-0.5">Password</div>
                      <div className="h-8 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div
                        className="flex-1 h-8 rounded text-xs font-semibold text-white flex items-center justify-center shadow-sm transition-colors"
                        style={{ background: merged.btn_color ?? '#2271b1' }}
                      >
                        Log In
                      </div>
                    </div>
                    <div className="text-center">
                      <span className="text-xs text-slate-400 hover:text-slate-600 cursor-default">Lost your password?</span>
                    </div>
                  </div>

                  {/* Footer text */}
                  {merged.footer && (
                    <p
                      className="text-xs text-center max-w-[240px] opacity-80 mt-1"
                      style={{ color: merged.bg_image ? '#fff' : '#64748b' }}
                    >
                      {merged.footer}
                    </p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── Admin UI Customiser ──────────────────────────────────────────── */}
        <TabsContent value="customiser" className="space-y-4">
          <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            Hidden items are only applied to <strong>non-administrator</strong> roles. Admins always see the full menu.
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Admin Menu Items</CardTitle>
                <CardDescription>Check items to hide from non-admin users</CardDescription>
              </CardHeader>
              <CardContent className="max-h-80 overflow-y-auto space-y-1">
                {!customiser?.available_menus.length ? (
                  <p className="text-sm text-slate-400 py-4 text-center">No menu items available — open WP Admin to populate this list.</p>
                ) : customiser.available_menus.map(item => (
                  <label key={item.slug} className="flex items-center gap-2.5 py-1.5 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 accent-blue-600"
                      checked={hiddenMenus.includes(item.slug)}
                      onChange={() => toggleMenu(item.slug)}
                    />
                    <span className="text-sm">{item.label}</span>
                    <code className="text-xs text-slate-400 ml-auto">{item.slug}</code>
                  </label>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dashboard Widgets</CardTitle>
                <CardDescription>Check widgets to hide from non-admin users</CardDescription>
              </CardHeader>
              <CardContent className="max-h-80 overflow-y-auto space-y-1">
                {!customiser?.available_widgets.length ? (
                  <p className="text-sm text-slate-400 py-4 text-center">No widgets available — open WP Dashboard to populate this list.</p>
                ) : customiser.available_widgets.map(w => (
                  <label key={w.id} className="flex items-center gap-2.5 py-1.5 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 accent-blue-600"
                      checked={hiddenWidgets.includes(w.id)}
                      onChange={() => toggleWidget(w.id)}
                    />
                    <span className="text-sm">{w.label}</span>
                    <Badge variant="outline" className="text-xs ml-auto">{w.context}</Badge>
                  </label>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => saveCustomiser.mutate()} disabled={saveCustomiser.isPending}>
              {saveCustomiser.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Admin UI Settings
            </Button>
          </div>
        </TabsContent>

        {/* ── Client Report ────────────────────────────────────────────────── */}
        <TabsContent value="report" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Client Report Generator</CardTitle>
                  <CardDescription>Generate a professional HTML report summarising site health for your client.</CardDescription>
                </div>
                <Button onClick={generateReport} disabled={reportGenerating}>
                  {reportGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileBarChart2 className="w-4 h-4 mr-2" />}
                  Generate Report
                </Button>
              </div>
            </CardHeader>
            {reportData && (
              <CardContent className="space-y-5">
                {/* Score */}
                <div className="flex items-center gap-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="relative w-20 h-20 shrink-0">
                    <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="15.9" fill="none"
                        stroke={reportData.score >= 80 ? '#22c55e' : reportData.score >= 60 ? '#f59e0b' : '#ef4444'}
                        strokeWidth="3"
                        strokeDasharray={`${reportData.score} ${100 - reportData.score}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold">{reportData.score}</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{reportData.site_name}</p>
                    <p className="text-sm text-slate-500">{reportData.site_url}</p>
                    <p className="text-xs text-slate-400 mt-1">Generated {reportData.generated_at}</p>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'WordPress', value: `v${reportData.wp_version}` },
                    { label: 'PHP', value: `v${reportData.php_version}` },
                    { label: 'Database', value: `${reportData.db_size_mb} MB` },
                    { label: 'Pending Updates', value: String(reportData.updates_pending), alert: reportData.updates_pending > 0 },
                    { label: 'SSL', value: reportData.ssl ? 'Active' : 'Not active', ok: reportData.ssl },
                    { label: 'WP_DEBUG', value: reportData.debug_disabled ? 'Off' : 'On', ok: reportData.debug_disabled },
                    { label: 'Active Plugins', value: String(reportData.active_plugins.length) },
                    { label: 'Last Backup', value: reportData.last_backup, small: true },
                  ].map(s => (
                    <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                      <p className="text-xs text-slate-500 mb-0.5">{s.label}</p>
                      <p className={`font-semibold text-sm ${s.alert ? 'text-amber-600' : s.ok === false ? 'text-red-600' : s.ok === true ? 'text-green-600' : ''} ${s.small ? 'text-xs' : ''}`}>
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Plugin list */}
                <div>
                  <p className="text-sm font-medium mb-2">Active Plugins ({reportData.active_plugins.length})</p>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
                    {reportData.active_plugins.map(p => (
                      <div key={p.name} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span>{p.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">v{p.version}</span>
                          {p.has_update && <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Update available</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={copyReport}>
                    {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                    Copy HTML
                  </Button>
                  <Button size="sm" onClick={downloadReport}>
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Download Report
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* ── Coming Soon ──────────────────────────────────────────────────── */}
        <TabsContent value="coming-soon" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Coming Soon Mode</CardTitle>
                  <CardDescription>Show a pre-launch page to visitors. Admins see the live site normally.</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${mergedCs.active ? 'text-green-600 dark:text-green-400' : 'text-slate-500'}`}>
                    {mergedCs.active ? 'Active' : 'Inactive'}
                  </span>
                  <Switch checked={mergedCs.active ?? false} onCheckedChange={v => updateCs('active', v)} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label>Page Title</Label>
                  <Input value={mergedCs.title ?? ''} onChange={e => updateCs('title', e.target.value)} placeholder="Coming Soon" />
                </div>
                <div className="space-y-1.5">
                  <Label>Launch Date & Time</Label>
                  <Input type="datetime-local" value={mergedCs.launch_date ?? ''} onChange={e => updateCs('launch_date', e.target.value)} />
                  <p className="text-xs text-slate-400">Leave empty to hide the countdown</p>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Message</Label>
                  <Textarea
                    rows={3}
                    value={mergedCs.message ?? ''}
                    onChange={e => updateCs('message', e.target.value)}
                    placeholder="We're working on something great. Stay tuned!"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Background Colour</Label>
                  <div className="flex gap-2">
                    <input type="color" value={mergedCs.bg_color ?? '#0f172a'} onChange={e => updateCs('bg_color', e.target.value)} className="h-9 w-14 rounded border border-slate-200 p-0.5 cursor-pointer" />
                    <Input value={mergedCs.bg_color ?? '#0f172a'} onChange={e => updateCs('bg_color', e.target.value)} className="font-mono" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Accent Colour</Label>
                  <div className="flex gap-2">
                    <input type="color" value={mergedCs.accent_color ?? '#6366f1'} onChange={e => updateCs('accent_color', e.target.value)} className="h-9 w-14 rounded border border-slate-200 p-0.5 cursor-pointer" />
                    <Input value={mergedCs.accent_color ?? '#6366f1'} onChange={e => updateCs('accent_color', e.target.value)} className="font-mono" />
                  </div>
                </div>
              </div>

              {/* Email capture */}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div>
                  <p className="font-medium text-sm">Email Capture Form</p>
                  <p className="text-xs text-slate-400 mt-0.5">Show "Notify Me" form on the coming soon page</p>
                </div>
                <Switch checked={mergedCs.email_capture ?? false} onCheckedChange={v => updateCs('email_capture', v)} />
              </div>

              {mergedCs.email_capture && csData?.emails && csData.emails.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                    <p className="text-sm font-medium">{csData.emails.length} captured email{csData.emails.length !== 1 ? 's' : ''}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        const csv = csData.emails.join('\n')
                        navigator.clipboard.writeText(csv)
                        toast.success('Emails copied')
                      }}>
                        <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy All
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => clearCsEmails.mutate()}>
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Clear
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {csData.emails.map((email, i) => (
                      <p key={i} className="px-4 py-2 text-sm font-mono">{email}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={() => saveCs.mutate()} disabled={saveCs.isPending}>
                  {saveCs.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Coming Soon Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Mail Preview Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!previewMail} onOpenChange={() => setPreviewMail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{previewMail?.subject}</DialogTitle>
          </DialogHeader>
          <div className="text-xs text-slate-500 space-y-0.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <p><strong>To:</strong> {previewMail?.to}</p>
            <p><strong>Date:</strong> {previewMail?.date}</p>
            <p><strong>Type:</strong> {previewMail?.content_type}</p>
          </div>
          <div className="flex-1 overflow-y-auto mt-3">
            {previewMail?.content_type?.includes('html') ? (
              <iframe
                srcDoc={previewMail.message}
                className="w-full h-96 border-0 rounded"
                sandbox="allow-same-origin"
                title="Email preview"
              />
            ) : (
              <pre className="text-sm whitespace-pre-wrap font-mono bg-slate-50 dark:bg-slate-900 rounded p-3">{previewMail?.message}</pre>
            )}
          </div>
          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={() => setPreviewMail(null)}>Close</Button>
            <Button onClick={() => { if (previewMail) resendMail.mutate(previewMail.id); setPreviewMail(null) }}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Resend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Report HTML builder ────────────────────────────────────────────────────────

function buildReportHtml(d: ReportData): string {
  const scoreColor = d.score >= 80 ? '#22c55e' : d.score >= 60 ? '#f59e0b' : '#ef4444'
  const scoreLabel = d.score >= 80 ? 'Good' : d.score >= 60 ? 'Fair' : 'Needs Attention'
  const dash = (val: number) => `${val} ${100 - val}`

  const pluginRows = d.active_plugins.map(p =>
    `<tr><td>${p.name}</td><td>v${p.version}</td><td>${p.author}</td><td>${p.has_update ? '<span style="color:#f59e0b;font-weight:600;">Update available</span>' : '<span style="color:#22c55e;">Up to date</span>'}</td></tr>`
  ).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Site Report — ${d.site_name}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:2rem;color:#1e293b;background:#f8fafc}
  .header{background:#0f172a;color:#fff;padding:2rem 2.5rem;border-radius:12px;margin-bottom:2rem;display:flex;justify-content:space-between;align-items:center}
  .header h1{margin:0;font-size:1.6rem;font-weight:800}
  .header p{margin:4px 0 0;opacity:.6;font-size:.9rem}
  .score-ring{position:relative;width:80px;height:80px}
  .score-ring svg{transform:rotate(-90deg)}
  .score-inner{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.3rem;color:${scoreColor}}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:2rem}
  .stat{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:1rem}
  .stat-label{font-size:.75rem;color:#64748b;margin-bottom:4px}
  .stat-value{font-weight:700;font-size:1rem}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0}
  th{background:#f1f5f9;padding:.65rem 1rem;text-align:left;font-size:.8rem;font-weight:600;color:#475569}
  td{padding:.65rem 1rem;border-top:1px solid #f1f5f9;font-size:.85rem}
  h2{font-size:1rem;font-weight:700;margin:2rem 0 .75rem}
  .footer{text-align:center;margin-top:2.5rem;font-size:.75rem;color:#94a3b8}
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>${d.site_name}</h1>
    <p>${d.site_url}</p>
    <p>Generated: ${d.generated_at}</p>
  </div>
  <div class="score-ring">
    <svg viewBox="0 0 36 36" width="80" height="80">
      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#334155" stroke-width="3"/>
      <circle cx="18" cy="18" r="15.9" fill="none" stroke="${scoreColor}" stroke-width="3"
        stroke-dasharray="${dash(d.score)}" stroke-linecap="round"/>
    </svg>
    <div class="score-inner">${d.score}</div>
  </div>
</div>

<div class="grid">
  <div class="stat"><div class="stat-label">Health Score</div><div class="stat-value" style="color:${scoreColor}">${d.score}/100 — ${scoreLabel}</div></div>
  <div class="stat"><div class="stat-label">WordPress</div><div class="stat-value">v${d.wp_version}</div></div>
  <div class="stat"><div class="stat-label">PHP</div><div class="stat-value">v${d.php_version}</div></div>
  <div class="stat"><div class="stat-label">Database Size</div><div class="stat-value">${d.db_size_mb} MB</div></div>
  <div class="stat"><div class="stat-label">SSL</div><div class="stat-value" style="color:${d.ssl ? '#22c55e' : '#ef4444'}">${d.ssl ? 'Active ✓' : 'Not active ✗'}</div></div>
  <div class="stat"><div class="stat-label">WP_DEBUG</div><div class="stat-value" style="color:${d.debug_disabled ? '#22c55e' : '#ef4444'}">${d.debug_disabled ? 'Disabled ✓' : 'Enabled ✗'}</div></div>
  <div class="stat"><div class="stat-label">Pending Updates</div><div class="stat-value" style="color:${d.updates_pending > 0 ? '#f59e0b' : '#22c55e'}">${d.updates_pending}</div></div>
  <div class="stat"><div class="stat-label">Last Backup</div><div class="stat-value" style="font-size:.8rem">${d.last_backup}</div></div>
</div>

<h2>Active Theme</h2>
<table>
  <tr><th>Name</th><th>Version</th><th>Author</th><th>Status</th></tr>
  <tr><td>${d.theme.name}</td><td>v${d.theme.version}</td><td>${d.theme.author}</td><td>${d.theme.has_update ? '<span style="color:#f59e0b;font-weight:600;">Update available</span>' : '<span style="color:#22c55e;">Up to date</span>'}</td></tr>
</table>

<h2>Active Plugins (${d.active_plugins.length})</h2>
<table>
  <tr><th>Plugin</th><th>Version</th><th>Author</th><th>Status</th></tr>
  ${pluginRows}
</table>

<div class="footer">Report generated by WP Manager Pro &mdash; ${d.site_url}</div>
</body>
</html>`
}
