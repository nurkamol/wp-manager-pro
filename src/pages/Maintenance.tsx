import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Construction, Power, CheckCircle2, AlertTriangle, Eye,
  RefreshCw, Save, Palette, FileText, Clock, Smile, Users, Copy, Globe,
} from 'lucide-react'
import { useState, useEffect } from 'react'

interface MaintenanceStatus {
  active: boolean
  message: string
  title: string
  end_time: string
  bg_start: string
  bg_end: string
  accent: string
  text_color: string
  logo: string
  badge_text: string
  show_badge: boolean
  show_countdown: boolean
  bypass_roles: string[]
  available_roles: Record<string, string>
  bypass_key: string
  scope: string
  scope_paths: string
  show_adminbar_toggle: boolean
  home_url: string
}

const GRADIENT_PRESETS = [
  { label: 'Midnight', start: '#1e1e2e', end: '#0f3460', accent: '#4f8ef7' },
  { label: 'Sunset', start: '#ff6b6b', end: '#ffa500', accent: '#fff' },
  { label: 'Forest', start: '#1a3a2a', end: '#2d6a4f', accent: '#95d5b2' },
  { label: 'Royal', start: '#2d1b69', end: '#11998e', accent: '#c9b1ff' },
  { label: 'Slate', start: '#1e293b', end: '#334155', accent: '#94a3b8' },
  { label: 'Candy', start: '#833ab4', end: '#fd1d1d', accent: '#fcb045' },
]

const LOGO_PRESETS = ['⚙️', '🔧', '🚀', '🛠️', '⚡', '🌙', '🔒', '🎯']

export function Maintenance() {
  const queryClient = useQueryClient()

  // Local state for settings
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [endTime, setEndTime] = useState('')
  const [bgStart, setBgStart] = useState('#1e1e2e')
  const [bgEnd, setBgEnd] = useState('#0f3460')
  const [accent, setAccent] = useState('#4f8ef7')
  const [textColor, setTextColor] = useState('#ffffff')
  const [logo, setLogo] = useState('⚙️')
  const [badgeText, setBadgeText] = useState('Maintenance Mode')
  const [showBadge, setShowBadge] = useState(true)
  const [showCountdown, setShowCountdown] = useState(false)
  const [bypassRoles, setBypassRoles] = useState<string[]>([])
  const [bypassKey, setBypassKey] = useState('')
  const [scope, setScope] = useState('all')
  const [showAdminBarToggle, setShowAdminBarToggle] = useState(true)
  const [scopePaths, setScopePaths] = useState('')
  const [initialized, setInitialized] = useState(false)

  // Live countdown for the preview panel — ticks every second
  const [previewCountdown, setPreviewCountdown] = useState({ d: 0, h: 0, m: 0, s: 0 })

  useEffect(() => {
    if (!showCountdown || !endTime) {
      setPreviewCountdown({ d: 0, h: 0, m: 0, s: 0 })
      return
    }
    const tick = () => {
      const diff = Math.max(0, new Date(endTime).getTime() - Date.now())
      setPreviewCountdown({
        d: Math.floor(diff / 864e5),
        h: Math.floor(diff % 864e5 / 36e5),
        m: Math.floor(diff % 36e5 / 6e4),
        s: Math.floor(diff % 6e4 / 1e3),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [showCountdown, endTime])

  const { data, isLoading } = useQuery<MaintenanceStatus>({
    queryKey: ['maintenance'],
    queryFn: () => api.get('/maintenance'),
  })

  // Populate local state from server on first load
  useEffect(() => {
    if (data && !initialized) {
      setTitle(data.title || '')
      setMessage(data.message || '')
      setEndTime(data.end_time || '')
      setBgStart(data.bg_start || '#1e1e2e')
      setBgEnd(data.bg_end || '#0f3460')
      setAccent(data.accent || '#4f8ef7')
      setTextColor(data.text_color || '#ffffff')
      setLogo(data.logo || '⚙️')
      setBadgeText(data.badge_text || 'Maintenance Mode')
      setShowBadge(data.show_badge ?? true)
      setShowCountdown(data.show_countdown ?? false)
      setBypassRoles(data.bypass_roles ?? [])
      setBypassKey(data.bypass_key ?? '')
      setScope(data.scope ?? 'all')
      setScopePaths(data.scope_paths ?? '')
      setShowAdminBarToggle(data.show_adminbar_toggle ?? true)
      setInitialized(true)
    }
  }, [data, initialized])

  // Helper to get current settings merged with server defaults
  const generateBypassKey = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  const copyBypassUrl = () => {
    const url = `${data?.home_url ?? '/'}?wmp_preview=${bypassKey}`
    navigator.clipboard.writeText(url).then(() => toast.success('Bypass URL copied!')).catch(() => toast.error('Copy failed'))
  }

  const currentSettings = () => ({
    title: title || data?.title || 'Site Under Maintenance',
    message: message || data?.message || 'We are performing scheduled maintenance. We will be back shortly.',
    end_time: endTime || data?.end_time || '',
    bg_start: bgStart,
    bg_end: bgEnd,
    accent,
    text_color: textColor,
    logo,
    badge_text: badgeText,
    show_badge: showBadge,
    show_countdown: showCountdown,
    bypass_roles: bypassRoles,
    bypass_key: bypassKey,
    scope,
    scope_paths: scopePaths,
    show_adminbar_toggle: showAdminBarToggle,
  })

  const saveSettingsMutation = useMutation({
    mutationFn: () => api.post('/maintenance/settings', currentSettings()),
    onSuccess: () => {
      toast.success('Maintenance settings saved')
      // Reload so the server-rendered admin bar reflects the new settings
      setTimeout(() => window.location.reload(), 800)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const toggleMutation = useMutation({
    mutationFn: (enable: boolean) => api.post('/maintenance/toggle', {
      enable,
      ...currentSettings(),
    }),
    onSuccess: (_, enable) => {
      toast[enable ? 'success' : 'info'](enable ? 'Maintenance mode enabled' : 'Maintenance mode disabled')
      queryClient.invalidateQueries({ queryKey: ['maintenance'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const applyPreset = (preset: typeof GRADIENT_PRESETS[0]) => {
    setBgStart(preset.start)
    setBgEnd(preset.end)
    setAccent(preset.accent)
  }

  if (isLoading) return <PageLoader text="Loading maintenance settings..." />

  const preview = currentSettings()

  return (
    <div className="fade-in">
      <PageHeader
        title="Maintenance Mode"
        description="Control when your site shows a maintenance page to visitors"
      />

      <div className="p-6 space-y-6">
        {/* Status Banner */}
        <Card className={data?.active ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700' : ''}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${data?.active ? 'bg-amber-100 dark:bg-amber-900/50' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  <Construction className={`w-6 h-6 ${data?.active ? 'text-amber-600' : 'text-slate-400'}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    Maintenance Mode is{' '}
                    {data?.active ? (
                      <span className="text-amber-600">Active</span>
                    ) : (
                      <span className="text-green-600">Inactive</span>
                    )}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {data?.active
                      ? `Visitors see the maintenance page. Admins${bypassRoles.length ? ` and ${bypassRoles.map(r => data?.available_roles?.[r] ?? r).join(', ')}` : ''} can still access the site.`
                      : 'Your site is accessible to all visitors.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {data?.active ? (
                  <Badge variant="warning" className="gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
                    Live
                  </Badge>
                ) : (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Online
                  </Badge>
                )}
                <Button
                  onClick={() => toggleMutation.mutate(!data?.active)}
                  disabled={toggleMutation.isPending}
                  variant={data?.active ? 'outline' : 'default'}
                  size="sm"
                >
                  {toggleMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : data?.active ? (
                    <Power className="w-4 h-4" />
                  ) : (
                    <Construction className="w-4 h-4" />
                  )}
                  {data?.active ? 'Disable' : 'Enable'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {data?.active && (
          <Alert variant="warning">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              <strong>Your site is in maintenance mode.</strong> Regular visitors cannot access your content.
              Only logged-in administrators can view the site normally.
            </AlertDescription>
          </Alert>
        )}

        {/* Two-column layout: Settings + Preview */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Settings (left) */}
          <div className="xl:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Maintenance Page Settings</CardTitle>
                <CardDescription>Customize content and appearance of the maintenance page</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="content">
                  <TabsList className="mb-5 w-full">
                    <TabsTrigger value="content" className="flex-1 gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Content
                    </TabsTrigger>
                    <TabsTrigger value="appearance" className="flex-1 gap-1.5">
                      <Palette className="w-3.5 h-3.5" />
                      Appearance
                    </TabsTrigger>
                    <TabsTrigger value="extras" className="flex-1 gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Access & Extras
                    </TabsTrigger>
                  </TabsList>

                  {/* Content Tab */}
                  <TabsContent value="content" className="space-y-4 mt-0">
                    <div className="space-y-2">
                      <Label htmlFor="title">Page Title</Label>
                      <Input
                        id="title"
                        placeholder="Site Under Maintenance"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        placeholder="We are performing scheduled maintenance. We will be back shortly."
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        rows={4}
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                      <div>
                        <Label className="text-sm font-medium">Show Badge</Label>
                        <p className="text-xs text-slate-500 mt-0.5">Display a status pill at the top of the page</p>
                      </div>
                      <Switch checked={showBadge} onCheckedChange={setShowBadge} />
                    </div>

                    {showBadge && (
                      <div className="space-y-2">
                        <Label htmlFor="badge-text">Badge Text</Label>
                        <Input
                          id="badge-text"
                          placeholder="Maintenance Mode"
                          value={badgeText}
                          onChange={e => setBadgeText(e.target.value)}
                          maxLength={30}
                        />
                      </div>
                    )}
                  </TabsContent>

                  {/* Appearance Tab */}
                  <TabsContent value="appearance" className="space-y-5 mt-0">
                    {/* Gradient Presets */}
                    <div className="space-y-2">
                      <Label>Gradient Presets</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {GRADIENT_PRESETS.map(preset => (
                          <button
                            key={preset.label}
                            onClick={() => applyPreset(preset)}
                            className="relative h-14 rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all group"
                            style={{ background: `linear-gradient(135deg, ${preset.start} 0%, ${preset.end} 100%)` }}
                            title={preset.label}
                          >
                            <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium opacity-0 group-hover:opacity-100 bg-black/20 transition-opacity">
                              {preset.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Colors */}
                    <div className="space-y-3">
                      <Label>Custom Colors</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="bg-start" className="text-xs text-slate-500">Background Start</Label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              id="bg-start"
                              value={bgStart}
                              onChange={e => setBgStart(e.target.value)}
                              className="w-10 h-9 rounded border border-slate-200 cursor-pointer p-0.5"
                            />
                            <Input
                              value={bgStart}
                              onChange={e => setBgStart(e.target.value)}
                              className="font-mono text-sm"
                              maxLength={7}
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="bg-end" className="text-xs text-slate-500">Background End</Label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              id="bg-end"
                              value={bgEnd}
                              onChange={e => setBgEnd(e.target.value)}
                              className="w-10 h-9 rounded border border-slate-200 cursor-pointer p-0.5"
                            />
                            <Input
                              value={bgEnd}
                              onChange={e => setBgEnd(e.target.value)}
                              className="font-mono text-sm"
                              maxLength={7}
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="accent" className="text-xs text-slate-500">Accent / Divider</Label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              id="accent"
                              value={accent}
                              onChange={e => setAccent(e.target.value)}
                              className="w-10 h-9 rounded border border-slate-200 cursor-pointer p-0.5"
                            />
                            <Input
                              value={accent}
                              onChange={e => setAccent(e.target.value)}
                              className="font-mono text-sm"
                              maxLength={7}
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="text-color" className="text-xs text-slate-500">Text Color</Label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              id="text-color"
                              value={textColor}
                              onChange={e => setTextColor(e.target.value)}
                              className="w-10 h-9 rounded border border-slate-200 cursor-pointer p-0.5"
                            />
                            <Input
                              value={textColor}
                              onChange={e => setTextColor(e.target.value)}
                              className="font-mono text-sm"
                              maxLength={7}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Icon / Logo */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Smile className="w-3.5 h-3.5" />
                        Page Icon
                      </Label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {LOGO_PRESETS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => setLogo(emoji)}
                            className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center border-2 transition-all ${
                              logo === emoji
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                                : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="custom-logo" className="text-xs text-slate-500">Or type any emoji</Label>
                        <Input
                          id="custom-logo"
                          value={logo}
                          onChange={e => setLogo(e.target.value)}
                          placeholder="⚙️"
                          maxLength={8}
                          className="max-w-[120px] text-2xl text-center"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Extras Tab */}
                  <TabsContent value="extras" className="space-y-4 mt-0">
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                      <div>
                        <Label className="text-sm font-medium">Show Countdown Timer</Label>
                        <p className="text-xs text-slate-500 mt-0.5">Display a live countdown clock on the maintenance page</p>
                      </div>
                      <Switch checked={showCountdown} onCheckedChange={setShowCountdown} />
                    </div>

                    {showCountdown && (
                      <div className="space-y-2">
                        <Label htmlFor="endtime">Countdown End Time</Label>
                        <Input
                          id="endtime"
                          type="datetime-local"
                          value={endTime}
                          onChange={e => setEndTime(e.target.value)}
                        />
                        <p className="text-xs text-slate-500">The countdown will tick down to this date/time.</p>
                      </div>
                    )}

                    {!showCountdown && (
                      <div className="space-y-2">
                        <Label htmlFor="endtime-info">Expected End Time (informational)</Label>
                        <Input
                          id="endtime-info"
                          type="datetime-local"
                          value={endTime}
                          onChange={e => setEndTime(e.target.value)}
                        />
                        <p className="text-xs text-slate-500">Optional. Can be referenced in your message text.</p>
                      </div>
                    )}

                    {/* Bypass Roles */}
                    {data?.available_roles && Object.keys(data.available_roles).length > 0 && (
                      <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                        <div>
                          <Label className="text-sm font-medium flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            Bypass Roles
                          </Label>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Logged-in users with these roles can view the site normally during maintenance.
                            Administrators always bypass.
                          </p>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(data.available_roles).map(([slug, label]) => {
                            const checked = bypassRoles.includes(slug)
                            return (
                              <label
                                key={slug}
                                className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded accent-blue-600"
                                  checked={checked}
                                  onChange={() =>
                                    setBypassRoles(prev =>
                                      checked ? prev.filter(r => r !== slug) : [...prev, slug]
                                    )
                                  }
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                                <span className="ml-auto text-xs font-mono text-slate-400">{slug}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Maintenance Scope */}
                    <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                      <div>
                        <Label className="text-sm font-medium">Maintenance Scope</Label>
                        <p className="text-xs text-slate-500 mt-0.5">Choose which pages show the maintenance screen.</p>
                      </div>
                      <Select value={scope} onValueChange={setScope}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Whole Site</SelectItem>
                          <SelectItem value="home">Home Page Only</SelectItem>
                          <SelectItem value="paths">Specific Paths</SelectItem>
                        </SelectContent>
                      </Select>
                      {scope === 'paths' && (
                        <div className="space-y-2">
                          <Label htmlFor="scope-paths" className="text-xs text-slate-500">URL paths to block (one per line)</Label>
                          <Textarea
                            id="scope-paths"
                            value={scopePaths}
                            onChange={e => setScopePaths(e.target.value)}
                            placeholder={'/shop/*\n/checkout\n/product/*'}
                            rows={4}
                            className="font-mono text-sm"
                          />
                          <p className="text-xs text-slate-500">
                            Supports wildcards: <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">/shop/*</code>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Admin Bar Toggle visibility */}
                    <div className="flex items-center justify-between py-2 border-t border-slate-100 dark:border-slate-700 pt-4">
                      <div>
                        <Label className="text-sm font-medium">Show Toggle in Admin Bar</Label>
                        <p className="text-xs text-slate-500 mt-0.5">Display the maintenance on/off switch in the WordPress admin bar</p>
                      </div>
                      <Switch checked={showAdminBarToggle} onCheckedChange={setShowAdminBarToggle} />
                    </div>

                    {/* Secret Bypass URL */}
                    <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                      <div>
                        <Label className="text-sm font-medium flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5" />
                          Secret Bypass URL
                        </Label>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Share this URL to let someone preview the site during maintenance. Sets a 7-day cookie.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400 font-mono shrink-0">{data?.home_url ?? '/'}?wmp_preview=</span>
                          <Input
                            value={bypassKey}
                            onChange={e => setBypassKey(e.target.value.replace(/\s/g, ''))}
                            className="font-mono text-sm flex-1 min-w-0"
                            placeholder="your-secret-word"
                            spellCheck={false}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={copyBypassUrl}
                            title="Copy full URL"
                            disabled={!bypassKey}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setBypassKey(generateBypassKey())}
                            title="Auto-generate a random key"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-slate-400">
                          Type your own word or click <RefreshCw className="w-3 h-3 inline" /> to auto-generate. Changing it invalidates old links. Save settings to apply.
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Save Button */}
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <Button
                    className="w-full"
                    onClick={() => saveSettingsMutation.mutate()}
                    disabled={saveSettingsMutation.isPending}
                  >
                    {saveSettingsMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Live Preview (right) */}
          <div className="xl:col-span-2">
            <Card className="sticky top-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Live Preview
                </CardTitle>
                <CardDescription className="text-xs">Updates as you change settings</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <style>{`
                  @keyframes wmpFloat {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-8px); }
                  }
                  @keyframes wmpFadeIn {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                `}</style>
                <div
                  className="rounded-b-lg overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${preview.bg_start} 0%, ${preview.bg_end} 100%)`,
                    minHeight: '340px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: preview.text_color,
                    padding: '32px 24px',
                  }}
                >
                  <div style={{ textAlign: 'center', animation: 'wmpFadeIn 0.4s ease', maxWidth: '320px', width: '100%' }}>
                    {/* Badge */}
                    {preview.show_badge && (
                      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 14px',
                          borderRadius: '9999px',
                          border: `1px solid ${preview.accent}50`,
                          background: `${preview.accent}20`,
                          color: preview.text_color,
                          fontSize: '11px',
                          fontWeight: 600,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase' as const,
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: preview.accent,
                            display: 'inline-block',
                          }} />
                          {preview.badge_text}
                        </span>
                      </div>
                    )}

                    {/* Logo */}
                    <div style={{
                      fontSize: '48px',
                      marginBottom: '16px',
                      animation: 'wmpFloat 3s ease-in-out infinite',
                      display: 'inline-block',
                    }}>
                      {preview.logo}
                    </div>

                    {/* Accent divider */}
                    <div style={{
                      width: '40px',
                      height: '3px',
                      borderRadius: '9999px',
                      background: preview.accent,
                      margin: '0 auto 16px',
                    }} />

                    {/* Title */}
                    <h2 style={{
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      marginBottom: '10px',
                      color: preview.text_color,
                      lineHeight: 1.3,
                    }}>
                      {preview.title}
                    </h2>

                    {/* Message */}
                    <p style={{
                      fontSize: '0.8125rem',
                      opacity: 0.75,
                      lineHeight: 1.6,
                      marginBottom: showCountdown && endTime ? '16px' : '0',
                    }}>
                      {preview.message}
                    </p>

                    {/* Countdown preview — live ticking */}
                    {preview.show_countdown && endTime && (
                      <div style={{
                        marginTop: '16px',
                        display: 'flex',
                        gap: '8px',
                        justifyContent: 'center',
                      }}>
                        {(['Days', 'Hrs', 'Min', 'Sec'] as const).map((lbl, i) => {
                          const val = [previewCountdown.d, previewCountdown.h, previewCountdown.m, previewCountdown.s][i]
                          return (
                            <div key={lbl} style={{
                              background: `${preview.accent}20`,
                              border: `1px solid ${preview.accent}40`,
                              borderRadius: '8px',
                              padding: '8px 6px',
                              minWidth: '44px',
                              textAlign: 'center',
                            }}>
                              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: preview.accent }}>
                                {String(val).padStart(2, '0')}
                              </div>
                              <div style={{ fontSize: '9px', opacity: 0.6, marginTop: '2px', textTransform: 'uppercase' as const }}>
                                {lbl}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
