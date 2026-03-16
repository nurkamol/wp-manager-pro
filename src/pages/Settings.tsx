import { useState, useRef, useCallback } from 'react'
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
import {
  Save, RefreshCw, Palette, BookOpen, HelpCircle, ChevronDown, ChevronRight, ExternalLink, Keyboard,
  Download, Upload, FileJson, Globe, CheckSquare, Square, FileDown, AlertTriangle, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface BrandingSettings {
  plugin_name: string
  menu_label: string
  logo_url: string
}

// ── Changelog data ─────────────────────────────────────────────────────────────
const changelog: { version: string; date: string; features: string[] }[] = [
  {
    version: '2.6.0',
    date: '2026-03-16',
    features: [
      'Update Manager — 3-tab page in the Management group for safe, informed plugin/theme/core updates',
      'Available Updates tab — lists all pending updates; "View Changelog" fetches live WordPress.org changelog before you commit; per-item Update button with animated status (updating / done / failed)',
      'Pre-update Backup — every update automatically zips the plugin/theme directory to wp-content/wmp-backups/updates/ before upgrading',
      'Batch Update — checkbox multi-select + "Update Selected" runs updates sequentially to avoid file-system conflicts',
      'History tab — persistent log of every update (name, version arrow, date, status); "Rollback" button restores from backup ZIP; "Clear History" deletes log and all backup files',
      'Scheduled Updates — queue any plugin/theme update for a specific future datetime via WP Cron; cancel anytime; backup runs automatically at scheduled time',
      '9 new REST endpoints under /updates/* (available, changelog, run, rollback, history, history/clear, scheduled, schedule, schedule/cancel)',
    ],
  },
  {
    version: '2.5.0',
    date: '2026-03-16',
    features: [
      'Command Palette — global Cmd+K / Ctrl+K overlay for instant navigation to any page or quick actions',
      'Navigation — all 24 pages searchable with fuzzy filter; keyboard navigation with ↑↓ and Enter',
      'Quick Actions — Flush Object Cache, Toggle Maintenance Mode, Clear Error Log, Purge Expired Transients, Create Backup from anywhere in the app',
      'Recent Pages — last 5 visited pages shown at top of palette when search is empty (stored in localStorage)',
      'Settings Export — export plugin configuration (Branding, Maintenance, SMTP, Images, Snippets, Redirects, Notes) as a JSON bundle with HMAC signature',
      'Settings Import — import a previously exported bundle with section-level overwrite controls and preview of detected sections',
      'WordPress Content Export — export site content as standard WordPress XML (all / posts / pages / media / custom post type)',
    ],
  },
  {
    version: '2.4.0',
    date: '2026-03-16',
    features: [
      'Dev Tools page — new 5-tab developer toolkit (Terminal icon in sidebar Tools group)',
      'wp-config.php Visual Editor — grouped constants (Database, Debug, Salts, URLs, Memory, Custom); Switches for booleans; DB_PASSWORD masked with eye toggle; "Regenerate All Salts" fetches fresh keys from wordpress.org',
      '.htaccess Editor — textarea editor with file info bar; auto-backup to .htaccess.wmp-backup before every save; Restore from backup button',
      'PHP Info Viewer — lazy-loaded on demand; search/filter across all sections; collapsible accordion tables; amber highlight when Local ≠ Master value',
      'Query Monitor — reads $wpdb->queries when SAVEQUERIES is on; stat cards for total queries/time/slow count/memory peak; query table with >50 ms highlight; "Show slow only" toggle',
      'Environment Badge — select Production / Staging / Development / Local from coloured cards; reads WP_ENVIRONMENT_TYPE constant or plugin option; badge shown in sidebar header',
      '8 new REST endpoints under /dev-tools/*',
    ],
  },
  {
    version: '2.3.1',
    date: '2026-03-16',
    features: [
      'Bundled Redis object-cache drop-in — install wp-content/object-cache.php without any third-party plugin',
      'Object Cache tab in Performance — Overview (status rows, connection details, live Redis stats) and Diagnostics tabs; Install / Enable / Disable / Flush actions',
      'Redis Cache admin bar node — green pulsing dot + Redis version badge; Flush Cache (AJAX with toast) and Object Cache Settings sub-items',
      'Maintenance admin bar toggle visibility setting — hidden by default on fresh installs; custom ?wmp_preview= slug for bypass URL',
      'Fix: JS/CSS versioned by filemtime() — browser always fetches the latest build after a deploy',
      'Fix: maintenance boolean options (show_badge, show_countdown, show_adminbar_toggle) stored as 0/1 integers',
      'Fix: page reloads ~800 ms after saving maintenance settings so admin bar reflects changes immediately',
    ],
  },
  {
    version: '2.3.0',
    date: '2026-03-11',
    features: [
      'Content Tools — 4-tab page for bulk content management without leaving WP Manager Pro',
      'Bulk Post Editor — filter by post type/status/search; select multiple posts; bulk-update status, author, or publish date',
      'Post Duplicator — clone any post/page/CPT as a draft with options to copy meta, taxonomies, and featured image',
      'Scheduled Post Manager — calendar-style list of all future-scheduled content across post types with time-until countdown',
      'Options Table Editor — paginated, searchable wp_options browser with type detection; inline edit and delete with serialized-data support',
      '10 new REST endpoints under /content/*',
    ],
  },
  {
    version: '2.2.0',
    date: '2026-03-11',
    features: [
      'Media Manager — 5-tab page for media library cleanup (Overview, Orphaned, Unused, Duplicates, Compress)',
      'Orphaned finder — lists attachments with missing physical files; bulk delete',
      'Unused media — lists unattached attachments not referenced in post content; shows thumbnails + file sizes; bulk delete',
      'Duplicate detector — groups by MD5 hash; shows wasted space per group; one-click delete of duplicate copies',
      'Image Compress tab — re-compress JPEG/PNG via wp_get_image_editor; adjustable quality (40–100); before/after size display',
      '9 new REST endpoints under /media/*',
    ],
  },
  {
    version: '2.1.0',
    date: '2026-03-10',
    features: [
      'Cron Manager — full WP-Cron visibility and control in a dedicated 3-tab page',
      'Event Browser — sortable list of all scheduled events with hook name, next run time, schedule label, and args count',
      'Manual Trigger — run any cron event on demand; captures output and execution time',
      'Delete Events — remove stuck or orphaned custom cron events with one click (core events protected)',
      'Custom Schedules — register new cron intervals from the UI (e.g. every 2 hours); persisted via wp_options',
      'Cron Health tab — DISABLE_WP_CRON status, ALTERNATE_WP_CRON, lock timeout, overdue event count, and real-cron setup instructions',
      '7 new REST endpoints: GET/POST/DELETE /cron/schedules, GET /cron/events, POST /cron/run, DELETE /cron/event, GET /cron/health',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-03-10',
    features: [
      'Security Suite — 5-tab Security page: Overview, Login Protection, Hardening, File Integrity, Two-Factor Auth',
      'Login Attempt Limiter — brute-force protection with configurable threshold, window, and lockout duration',
      'IP Blocklist — block individual IPs or CIDR ranges; stored in wp_options, enforced on init hook',
      'WordPress Hardening — disable XML-RPC and hide WordPress version from generator meta tag and asset query strings',
      'Core File Integrity Checker — compare wp-admin/ and wp-includes/ MD5s against official wordpress.org checksums API',
      'Two-Factor Authentication (TOTP) — per-user 2FA via Google Authenticator / Authy with one-time backup codes',
      'Lockout Log — view, clear, and unlock individual IPs from brute-force lockout history',
      '14 new REST endpoints under /security/: overview, limiter, lockouts, lockouts/unlock, ip-blocklist, hardening, integrity, 2fa',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-03-10',
    features: [
      'Performance page — database cleanup, transient manager, and object cache status under one roof',
      'DB Cleanup — remove post revisions, auto-drafts, trash, spam/pending comments, orphaned postmeta & commentmeta, expired transients',
      'Transient Manager — browse, search, and delete individual transients or purge all expired at once',
      'Object Cache Detection — banner shows Redis / Memcached / external cache status with install recommendation',
    ],
  },
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
    a: "PHP snippets are hooked onto WordPress's init action (priority 1) and run on every request when enabled. CSS snippets are output via wp_head; JS snippets via wp_footer. Disabling a snippet is instant — it is un-hooked without touching any files. If a snippet causes a fatal error you can disable it directly in the database by setting enabled = 0 in the wp_wmp_snippets table.",
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
  {
    q: 'How does the Update Manager differ from the standard WordPress update screen?',
    a: 'The Update Manager adds three things the native WordPress updater lacks: (1) Changelog Preview — click "View Changelog" to read the full WordPress.org changelog for any pending update before applying it; (2) Pre-update Backup — the plugin automatically zips the plugin or theme directory to wp-content/wmp-backups/updates/ before every update, so you can restore the exact previous version with one click from the History tab; (3) Scheduled Updates — queue updates to run automatically at an off-peak time via WP Cron instead of updating immediately. Core (WordPress itself) updates are supported but without a file-level backup due to size.',
  },
  {
    q: 'Can I roll back a plugin update if the site breaks?',
    a: 'Yes — as long as the update was run through the Update Manager (not the standard WP update screen) and the backup ZIP still exists. Go to Update Manager → History, find the entry, and click "Rollback". The plugin will extract the pre-update ZIP back into the plugins directory and mark the entry as rolled-back. Backup ZIPs are stored in wp-content/wmp-backups/updates/ and can be cleared from the History tab.',
  },
  {
    q: 'How do I open the Command Palette and can I change its shortcut?',
    a: 'Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux) from anywhere inside the plugin to open the Command Palette. You can change the shortcut to ⌘ Shift K or ⌘ K in Settings → Branding → Command Palette Shortcut. The shortcut is saved in localStorage so it takes effect immediately without a page reload. Note: ⌘ K conflicts with WordPress\'s own command palette on admin pages — the default ⌘ Shift P avoids this.',
  },
  {
    q: 'Is it safe to edit wp-config.php and .htaccess from inside the plugin?',
    a: 'Yes, with caveats. The wp-config.php editor in Dev Tools only modifies individual define() constants — it does not rewrite the whole file. The .htaccess editor saves a backup to .htaccess.wmp-backup before every save so you can restore the previous version instantly. Both files must be writable by the web server user. We recommend making a manual backup before editing production configuration files.',
  },
  {
    q: 'How does the Redis object cache drop-in work?',
    a: 'WP Manager Pro bundles its own object-cache.php drop-in at includes/object-cache.php. When you click "Install Drop-in" in Performance → Object Cache, the file is copied to wp-content/object-cache.php. WordPress automatically loads this file on every request, routing all wp_cache_* calls through Redis via the PhpRedis extension. No third-party redis-cache plugin is needed. You can enable, disable, or flush the cache from the Object Cache tab at any time.',
  },
  {
    q: 'What does Settings Export/Import include and is it safe to import on a different site?',
    a: 'The export bundle includes: Branding, Maintenance settings, SMTP/Email config, Image settings, Code Snippets, Redirects, and Notes. It is signed with an HMAC using the source site\'s WordPress auth salt. When importing on a different site, the plugin shows a cross-site warning (the signature will not match) but still allows the import — you choose which sections to overwrite. Sensitive values like SMTP passwords are included in plain text, so treat the bundle as a secret file.',
  },
]

// ── Export/Import section types ───────────────────────────────────────────────

const EXPORT_SECTIONS = [
  { id: 'branding',     label: 'Branding' },
  { id: 'maintenance',  label: 'Maintenance' },
  { id: 'smtp',         label: 'SMTP / Email' },
  { id: 'images',       label: 'Image Settings' },
  { id: 'snippets',     label: 'Code Snippets' },
  { id: 'redirects',    label: 'Redirects' },
  { id: 'notes',        label: 'Notes' },
]

const WP_EXPORT_CONTENT_TYPES = [
  { value: 'all',        label: 'All Content' },
  { value: 'post',       label: 'Posts only' },
  { value: 'page',       label: 'Pages only' },
  { value: 'attachment', label: 'Media only' },
  { value: 'custom',     label: 'Custom post type…' },
]

interface ImportPreview {
  sections: string[]
  exported_at: string
  site_url: string
  plugin_version: string
  same_site: boolean
}

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
  const [paletteShortcut, setPaletteShortcut] = useState<string>(
    () => { try { return localStorage.getItem('wmp-palette-shortcut') || 'shift+p' } catch { return 'shift+p' } }
  )

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

  // ── Export state ────────────────────────────────────────────────────────────
  const [exportSections, setExportSections] = useState<string[]>(EXPORT_SECTIONS.map(s => s.id))
  const [isExporting, setIsExporting] = useState(false)

  // ── Import state ────────────────────────────────────────────────────────────
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [importSections, setImportSections] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: string[]; skipped: string[]; warnings: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── WP XML export state ─────────────────────────────────────────────────────
  const [wpExportContent, setWpExportContent] = useState('all')
  const [wpExportCustomType, setWpExportCustomType] = useState('')
  const [isWpExporting, setIsWpExporting] = useState(false)

  function toggleExportSection(id: string) {
    setExportSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  function toggleImportSection(id: string) {
    setImportSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  async function handleExport() {
    if (exportSections.length === 0) {
      toast.error('Select at least one section to export')
      return
    }
    setIsExporting(true)
    try {
      const cfg = getConfig()
      const params = new URLSearchParams({ sections: exportSections.join(',') })
      const res = await fetch(`${cfg.apiUrl}/settings/export?${params}`, {
        method: 'GET',
        headers: { 'X-WP-Nonce': cfg.nonce },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
        throw new Error(err.message || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `wmp-settings-${date}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Settings exported successfully')
    } catch (err) {
      toast.error((err as Error).message || 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  function parseImportFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string)
        const sections: string[] = []
        EXPORT_SECTIONS.forEach(s => {
          if (json[s.id] !== undefined) sections.push(s.id)
        })
        const siteUrl = json._meta?.site_url || ''
        const currentSite = config.siteUrl || ''
        setImportPreview({
          sections,
          exported_at: json._meta?.exported_at || '',
          site_url: siteUrl,
          plugin_version: json._meta?.plugin_version || '',
          same_site: !!siteUrl && !!currentSite && siteUrl === currentSite,
        })
        setImportSections(sections)
        setImportResult(null)
      } catch {
        toast.error('Invalid JSON file — please select a valid WP Manager Pro export')
        setImportFile(null)
        setImportPreview(null)
      }
    }
    reader.readAsText(file)
  }

  function handleFileSelect(file: File) {
    if (!file.name.endsWith('.json')) {
      toast.error('Please select a .json file')
      return
    }
    setImportFile(file)
    parseImportFile(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [])

  async function handleImport() {
    if (!importFile) return
    setIsImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      formData.append('overwrite', JSON.stringify(importSections))
      const cfg = getConfig()
      const res = await fetch(`${cfg.apiUrl}/settings/import`, {
        method: 'POST',
        headers: { 'X-WP-Nonce': cfg.nonce },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`)
      setImportResult(data)
      toast.success(`Import complete — ${data.imported?.length ?? 0} sections imported`)
    } catch (err) {
      toast.error((err as Error).message || 'Import failed')
    } finally {
      setIsImporting(false)
    }
  }

  async function handleWpExport() {
    setIsWpExporting(true)
    const content = wpExportContent === 'custom' ? wpExportCustomType.trim() || 'post' : wpExportContent
    try {
      const cfg = getConfig()
      const res = await fetch(`${cfg.apiUrl}/settings/export-wp-xml`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': cfg.nonce,
        },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
        throw new Error(err.message || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `wordpress-export-${date}.xml`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('WordPress XML export downloaded')
    } catch (err) {
      toast.error((err as Error).message || 'Export failed')
    } finally {
      setIsWpExporting(false)
    }
  }

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
            <TabsTrigger value="export-import" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export / Import
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

                {/* ── Command Palette Shortcut ─────────────────────────── */}
                <div className="space-y-3 pt-2 border-t pt-4">
                  <div>
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Keyboard className="w-4 h-4" /> Command Palette Shortcut
                    </Label>
                    <p className="text-xs text-slate-500 mt-1">
                      WordPress uses <kbd className="bg-slate-100 border border-slate-200 rounded px-1 font-mono text-xs">⌘K</kbd> on all admin pages.
                      Choose a different shortcut to avoid conflict, or keep <kbd className="bg-slate-100 border border-slate-200 rounded px-1 font-mono text-xs">⌘K</kbd> if you prefer.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'shift+p', label: '⌘ Shift P', desc: 'VS Code style (default, no conflict)' },
                      { value: 'shift+k', label: '⌘ Shift K', desc: 'Shift variant' },
                      { value: 'k',       label: '⌘ K',       desc: 'Same as WordPress (may conflict)' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setPaletteShortcut(opt.value)
                          localStorage.setItem('wmp-palette-shortcut', opt.value)
                          toast.success(`Shortcut updated to ${opt.label}`)
                        }}
                        className={`flex flex-col items-start gap-0.5 border rounded-lg px-3 py-2 text-left transition-colors ${
                          paletteShortcut === opt.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <span className="font-mono font-semibold text-sm">{opt.label}</span>
                        <span className="text-[11px] text-slate-500">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

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

          {/* ── Export / Import Tab ───────────────────────────────────────────── */}
          <TabsContent value="export-import" className="space-y-6">

            {/* JSON Export */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileJson className="w-5 h-5 text-blue-500" />
                  Export Settings
                </CardTitle>
                <CardDescription>
                  Download a JSON bundle of selected plugin configuration sections.
                  The bundle is signed with an HMAC so you can verify it hasn't been tampered with.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Section checkboxes */}
                <div>
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Sections to export</span>
                    <button
                      onClick={() => setExportSections(EXPORT_SECTIONS.map(s => s.id))}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setExportSections([])}
                      className="text-xs text-slate-500 hover:underline"
                    >
                      None
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {EXPORT_SECTIONS.map(section => {
                      const checked = exportSections.includes(section.id)
                      return (
                        <button
                          key={section.id}
                          onClick={() => toggleExportSection(section.id)}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors text-left',
                            checked
                              ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          )}
                        >
                          {checked
                            ? <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                            : <Square className="w-3.5 h-3.5 shrink-0" />}
                          {section.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Metadata */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 space-y-1">
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Site: {config.siteUrl || window.location.origin}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5" />
                    <span>Plugin version: v{config.version}</span>
                  </div>
                </div>

                <Button onClick={handleExport} disabled={isExporting || exportSections.length === 0}>
                  {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                  Export Settings
                </Button>
              </CardContent>
            </Card>

            {/* JSON Import */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-green-500" />
                  Import Settings
                </CardTitle>
                <CardDescription>
                  Restore settings from a previously exported WP Manager Pro JSON bundle.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Drop zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                    isDragging
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/10'
                      : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) handleFileSelect(file)
                    }}
                  />
                  <FileJson className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  {importFile ? (
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{importFile.name}</p>
                  ) : (
                    <>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Drop a <strong>.json</strong> export file here, or click to browse
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Only WP Manager Pro export files are supported</p>
                    </>
                  )}
                </div>

                {/* Preview */}
                {importPreview && (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 space-y-1.5">
                      <p className="font-medium text-slate-700 dark:text-slate-300 text-sm">File Preview</p>
                      <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 shrink-0" />
                        <span>Exported from: {importPreview.site_url || 'unknown'}</span>
                        {!importPreview.same_site && importPreview.site_url && (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-3 h-3" /> different site
                          </span>
                        )}
                      </div>
                      {importPreview.exported_at && (
                        <div className="flex items-center gap-2">
                          <Info className="w-3.5 h-3.5 shrink-0" />
                          <span>Date: {new Date(importPreview.exported_at).toLocaleString()}</span>
                        </div>
                      )}
                      {importPreview.plugin_version && (
                        <div className="flex items-center gap-2">
                          <Info className="w-3.5 h-3.5 shrink-0" />
                          <span>Plugin version: v{importPreview.plugin_version}</span>
                        </div>
                      )}
                      <div>
                        <span>Sections detected: </span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {importPreview.sections.map(s => EXPORT_SECTIONS.find(x => x.id === s)?.label || s).join(', ') || 'none'}
                        </span>
                      </div>
                    </div>

                    {/* Overwrite checkboxes */}
                    {importPreview.sections.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Overwrite existing data for:
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {importPreview.sections.map(id => {
                            const label = EXPORT_SECTIONS.find(s => s.id === id)?.label || id
                            const checked = importSections.includes(id)
                            return (
                              <button
                                key={id}
                                onClick={() => toggleImportSection(id)}
                                className={cn(
                                  'flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors text-left',
                                  checked
                                    ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                )}
                              >
                                {checked
                                  ? <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                                  : <Square className="w-3.5 h-3.5 shrink-0" />}
                                {label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={handleImport}
                      disabled={isImporting || importSections.length === 0}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Import Settings
                    </Button>
                  </div>
                )}

                {/* Import result */}
                {importResult && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm space-y-1">
                    <p className="font-medium text-green-800 dark:text-green-200">Import Complete</p>
                    {importResult.imported.length > 0 && (
                      <p className="text-green-700 dark:text-green-300 text-xs">
                        Imported: {importResult.imported.map(s => EXPORT_SECTIONS.find(x => x.id === s)?.label || s).join(', ')}
                      </p>
                    )}
                    {importResult.skipped.length > 0 && (
                      <p className="text-slate-500 text-xs">
                        Skipped: {importResult.skipped.join(', ')}
                      </p>
                    )}
                    {importResult.warnings.length > 0 && (
                      <div className="mt-1">
                        {importResult.warnings.map((w, i) => (
                          <p key={i} className="text-amber-600 dark:text-amber-400 text-xs flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" />{w}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* WordPress XML Export */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-purple-500" />
                  WordPress Content Export
                </CardTitle>
                <CardDescription>
                  Export site content in standard WordPress XML format — importable on any WordPress site via Tools → Import.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Content type</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {WP_EXPORT_CONTENT_TYPES.map(ct => (
                      <button
                        key={ct.value}
                        onClick={() => setWpExportContent(ct.value)}
                        className={cn(
                          'px-3 py-2 rounded-md border text-sm text-left transition-colors',
                          wpExportContent === ct.value
                            ? 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        )}
                      >
                        {ct.label}
                      </button>
                    ))}
                  </div>
                  {wpExportContent === 'custom' && (
                    <div className="mt-2">
                      <Input
                        placeholder="Post type slug, e.g. product"
                        value={wpExportCustomType}
                        onChange={e => setWpExportCustomType(e.target.value)}
                        className="max-w-xs"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Standard WordPress export format — importable on any WordPress site via <strong>Tools → Import → WordPress</strong>.</span>
                </div>

                <Button
                  onClick={handleWpExport}
                  disabled={isWpExporting || (wpExportContent === 'custom' && !wpExportCustomType.trim())}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isWpExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Export as XML
                </Button>
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
                    className="flex items-center gap-1.5 hover:text-blue-600 transition-colors font-medium"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    GitHub
                  </a>
                  <a
                    href="https://github.com/nurkamol/wp-manager-pro/releases"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Releases
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
