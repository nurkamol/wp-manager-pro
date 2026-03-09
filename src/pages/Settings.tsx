import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, getConfig } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Save, RefreshCw, Palette, BookOpen, HelpCircle, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BrandingSettings {
  plugin_name: string
  menu_label: string
  logo_url: string
}

// ── Changelog data ─────────────────────────────────────────────────────────────
const changelog: { version: string; date: string; features: string[] }[] = [
  {
    version: '1.8.0',
    date: '2026-03-10',
    features: [
      'Sidebar redesign — icon-rail collapsed mode with visible button boxes, group spacing, and user avatar in footer',
      'WP Admin menu toggle — hide / show the WordPress main navigation menu from within the plugin UI, state persisted in localStorage',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-03-09',
    features: [
      'Monaco Editor in Code Snippets — syntax highlighting for PHP, CSS & JS',
      'Scheduled Backups — daily / weekly / monthly auto-backup via WP Cron with configurable retention limit',
      'Server Config Generator — Nginx & Apache snippets for WebP serving, security headers, and browser cache rules',
      'White-label / Branding — custom plugin name, admin menu label, and sidebar logo URL',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-03-09',
    features: [
      'WebP Delivery — transparently serve WebP sidecars via WP filter and Apache rewrite rules',
      'Replace Original with WebP — optionally delete JPEG/PNG originals on upload or batch convert',
      'Auto-Delete Sidecar Files — removes .webp / .avif sidecars when the parent attachment is deleted',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-03-09',
    features: [
      'Image Tools batch convert — WebP & AVIF conversion for existing media library with live progress bar',
      'Maintenance Mode — scope control (whole site / home / paths), secret bypass URL, live countdown preview',
      'Dashboard quick actions expanded to 12 (added Snippets, Image Tools, Email/SMTP, Backup)',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-03-09',
    features: [
      'Code Snippets Manager — PHP / CSS / JS snippets with per-snippet enable/disable toggle',
      'Redirect Manager — 301–308 redirects with wildcard support, hit counter, CSV import/export',
      'Email / SMTP — configure SMTP, send test emails, email log viewer',
      'Database Backup — full SQL dumps stored in wp-content/wmp-backups/ with download & delete',
      'Audit Log — tracks plugin, theme, user, and post events with CSV export',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-03-08',
    features: [
      'Maintenance Mode — gradient presets, custom colour pickers, countdown timer, live preview pane',
      'Database Manager — row edit / insert / delete, pagination, per-page selector',
      'Security page — admin URL protection (custom login slug, blocks direct wp-login.php access)',
      'Image Tools — AVIF upload support (PHP 8.1+ GD or ImageMagick)',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-03-08',
    features: [
      'Plugin & Theme Manager — one-click update, full version history & downgrade',
      'Light / Dark mode toggle — persisted in localStorage',
      'Smart WP.org search buttons — auto-detects Install / Update / Already Installed state',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-03-08',
    features: [
      'File Manager — Monaco editor, file upload, rename',
      'Plugin & Theme Manager — ZIP upload & ZIP export',
      'User Manager — username rename',
      'Debug Tools — SCRIPT_DEBUG toggle, log level filter, copy log',
      'Image Tools — SVG support with server-side sanitisation',
      'Reset Tools — bulk content deletion with double-confirmation',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-03-07',
    features: [
      'Initial release — Dashboard, Plugin Manager, Theme Manager, File Manager, Database Manager, User Manager, System Info, Maintenance Mode, Debug Tools, Image Tools, Notes',
    ],
  },
]

// ── FAQ data ───────────────────────────────────────────────────────────────────
const faq: { q: string; a: string }[] = [
  {
    q: 'How do I upgrade the plugin to a new version?',
    a: 'Go to Plugins → Add New → Upload Plugin and upload the new .zip file. WordPress will automatically replace the existing files in-place and keep the plugin active — no manual deletion needed. Make sure the ZIP contains the wp-manager-pro/ folder at its root (not loose files).',
  },
  {
    q: 'How do I restore a database backup?',
    a: 'Download the .sql backup file from the DB Backup page. Import it via phpMyAdmin (Database → Import tab), WP-CLI (wp db import backup.sql), or any MySQL client. Always test the restore on a staging environment before applying it to production.',
  },
  {
    q: 'Is it safe to use on a production site?',
    a: 'Yes. All REST routes require the manage_options capability (administrators only) and are protected by a WordPress nonce. For risky operations — like replacing images, editing files, or running Search & Replace — enable Maintenance Mode first to keep the site stable while you work.',
  },
  {
    q: 'What happens if I deactivate or delete the plugin?',
    a: 'On deactivation, the maintenance.php file is removed so your site returns to normal immediately. All settings stored in wp_options (branding, SMTP config, scheduled backup schedule, etc.) remain in the database and will be reused if you reactivate. Backup files in wp-content/wmp-backups/ are never deleted automatically.',
  },
  {
    q: 'How do Code Snippets run?',
    a: 'PHP snippets are hooked onto WordPress\'s init action (priority 1) and run on every request when enabled. CSS snippets are output via wp_head; JS snippets via wp_footer. Disabling a snippet is instant — it is un-hooked without touching any files. If a snippet causes a fatal error you can disable it directly in the database by setting enabled = 0 in the wp_wmp_snippets table.',
  },
  {
    q: 'Is the "Login As User" feature a security risk?',
    a: 'No. The feature generates a single-use cryptographic token stored as a WordPress transient with a 5-minute expiry. No passwords are stored, bypassed, or transmitted. The token is only accessible to an authenticated administrator and is deleted immediately after first use.',
  },
  {
    q: 'Are database backups encrypted?',
    a: 'No — backups are plain SQL text files. The wp-content/wmp-backups/ directory is protected from direct web access via an .htaccess deny-all rule. For additional security, download your backups and store them in a separate offsite location promptly after creation.',
  },
  {
    q: 'Does WP Manager Pro support WordPress Multisite?',
    a: 'Not officially. The plugin is designed for standard single-site WordPress installations. Multisite compatibility is planned for a future release.',
  },
  {
    q: 'Why does the admin menu label not update immediately after saving?',
    a: 'The WordPress admin menu is rendered server-side on every page load. After saving a new menu label in Settings → Branding, simply reload the browser tab and the new label will appear in the WordPress left-hand menu.',
  },
]

// ── Component ──────────────────────────────────────────────────────────────────

export function Settings() {
  const queryClient = useQueryClient()
  const config = getConfig()

  const { data, isLoading } = useQuery<BrandingSettings>({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings'),
  })

  const [pluginName, setPluginName] = useState('')
  const [menuLabel, setMenuLabel] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [initialized, setInitialized] = useState(false)

  if (data && !initialized) {
    setPluginName(data.plugin_name)
    setMenuLabel(data.menu_label)
    setLogoUrl(data.logo_url)
    setInitialized(true)
  }

  const saveMutation = useMutation({
    mutationFn: (d: BrandingSettings) => api.post('/settings', d),
    onSuccess: () => {
      toast.success('Settings saved — reload the page to see menu label changes')
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Changelog accordion state — latest version open by default
  const [expandedVersion, setExpandedVersion] = useState<string | null>(changelog[0].version)
  // FAQ accordion state — first item open by default
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0)

  if (isLoading) return <PageLoader text="Loading settings..." />

  return (
    <div className="fade-in">
      <PageHeader
        title="Settings"
        description="Plugin configuration, version history, and help"
      />

      <div className="p-6">
        <Tabs defaultValue="branding">
          <TabsList className="mb-6">
            <TabsTrigger value="branding" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Branding
            </TabsTrigger>
            <TabsTrigger value="changelog" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Changelog
            </TabsTrigger>
            <TabsTrigger value="faq" className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              FAQ
            </TabsTrigger>
          </TabsList>

          {/* ── Branding Tab ─────────────────────────────────────────────────── */}
          <TabsContent value="branding">
            <Card>
              <CardHeader>
                <CardTitle>White-label / Branding</CardTitle>
                <CardDescription>
                  Customize how WP Manager Pro appears in the WordPress admin.
                  Leave fields blank to use the default values.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">

                <div className="space-y-2">
                  <Label htmlFor="plugin-name">Plugin Name</Label>
                  <Input
                    id="plugin-name"
                    placeholder="WP Manager Pro"
                    value={pluginName}
                    onChange={e => setPluginName(e.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    Shown in the sidebar header. Defaults to "WP Manager Pro".
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="menu-label">Admin Menu Label</Label>
                  <Input
                    id="menu-label"
                    placeholder="WP Manager"
                    value={menuLabel}
                    onChange={e => setMenuLabel(e.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    Text shown in the WordPress left-hand admin menu. Defaults to "WP Manager".
                    Changes take effect after saving and reloading.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logo-url">Custom Logo URL</Label>
                  <Input
                    id="logo-url"
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={logoUrl}
                    onChange={e => setLogoUrl(e.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    If set, this image will replace the default icon in the sidebar header.
                    Recommended size: 28×28 px.
                  </p>
                </div>

                {logoUrl && (
                  <div className="space-y-1">
                    <Label>Logo Preview</Label>
                    <div className="w-12 h-12 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-800">
                      <img
                        src={logoUrl}
                        alt="Logo preview"
                        className="w-8 h-8 object-contain"
                        onError={e => (e.currentTarget.style.display = 'none')}
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <Button
                    onClick={() =>
                      saveMutation.mutate({ plugin_name: pluginName, menu_label: menuLabel, logo_url: logoUrl })
                    }
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Changelog Tab ────────────────────────────────────────────────── */}
          <TabsContent value="changelog">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>Version History</CardTitle>
                    <CardDescription className="mt-1">
                      What's changed in each release of WP Manager Pro
                    </CardDescription>
                  </div>
                  <span className="shrink-0 text-xs font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-full px-3 py-1">
                    Current: v{config.version}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {changelog.map((entry) => {
                  const isOpen    = expandedVersion === entry.version
                  const isCurrent = entry.version === config.version
                  return (
                    <div
                      key={entry.version}
                      className={cn(
                        'border rounded-lg overflow-hidden transition-colors',
                        isCurrent
                          ? 'border-blue-200 dark:border-blue-700'
                          : 'border-slate-200 dark:border-slate-700',
                      )}
                    >
                      {/* Header row */}
                      <button
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                          isOpen
                            ? 'bg-slate-50 dark:bg-slate-800/60'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
                        )}
                        onClick={() => setExpandedVersion(isOpen ? null : entry.version)}
                      >
                        {isOpen
                          ? <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
                          : <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
                        }
                        <span className={cn(
                          'text-sm font-semibold font-mono',
                          isCurrent ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300',
                        )}>
                          v{entry.version}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                            current
                          </span>
                        )}
                        <span className="text-xs text-slate-400 ml-auto">{entry.date}</span>
                      </button>

                      {/* Expanded feature list */}
                      {isOpen && (
                        <ul className="px-4 py-3 space-y-2 border-t border-slate-100 dark:border-slate-800">
                          {entry.features.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}

                {/* Footer links */}
                <div className="pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800">
                  <a
                    href="https://github.com/nurkamol/wp-manager-pro"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    github.com/nurkamol/wp-manager-pro
                  </a>
                  <a
                    href="https://github.com/nurkamol/wp-manager-pro/blob/main/CHANGELOG.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Full Changelog
                  </a>
                  <span>License: GPL-2.0-or-later</span>
                  <span>Stack: React 19 · TypeScript · Vite 6 · Tailwind CSS · shadcn/ui</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── FAQ Tab ──────────────────────────────────────────────────────── */}
          <TabsContent value="faq">
            <Card>
              <CardHeader>
                <CardTitle>Frequently Asked Questions</CardTitle>
                <CardDescription>Common questions about using WP Manager Pro</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 p-3 mb-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-500">
                  <HelpCircle className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span>Can't find an answer?</span>
                  <a
                    href="https://github.com/nurkamol/wp-manager-pro/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    Open an issue on GitHub
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {faq.map((item, i) => {
                  const isOpen = expandedFaq === i
                  return (
                    <div
                      key={i}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
                    >
                      <button
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                          isOpen
                            ? 'bg-slate-50 dark:bg-slate-800/60'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
                        )}
                        onClick={() => setExpandedFaq(isOpen ? null : i)}
                      >
                        {isOpen
                          ? <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
                          : <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
                        }
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {item.q}
                        </span>
                      </button>
                      {isOpen && (
                        <p className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 leading-relaxed">
                          {item.a}
                        </p>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  )
}
