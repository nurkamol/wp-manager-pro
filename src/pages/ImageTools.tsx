import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import {
  Image, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Save,
  ShieldCheck, Zap, Trash2, Globe, Replace, Copy, Server,
} from 'lucide-react'
import { useState, useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ImageSettings {
  webp_enabled: boolean
  avif_enabled: boolean
  avif_support: boolean
  max_width: number
  max_height: number
  jpeg_quality: number
  thumbnail_sizes: Record<string, { name: string; width: number; height: number; crop: boolean }>
  gd_support: boolean
  imagick_support: boolean
  webp_support: boolean
  svg_enabled: boolean
  svg_allowed_roles: string[]
  webp_serve_webp: boolean
  webp_delete_originals: boolean
}

interface ConvertStatsResponse { total: number; converted: number; remaining: number }
interface ConvertBatchResponse { converted: number; skipped: number; errors: number; has_more: boolean; next_offset: number }

const SVG_ROLES = [
  { key: 'administrator', label: 'Administrator' },
  { key: 'editor', label: 'Editor' },
  { key: 'author', label: 'Author' },
]

function ServerConfigBlock({ label, description, code }: { label: string; description: string; code: string }) {
  const copy = () => {
    navigator.clipboard.writeText(code).then(
      () => toast.success(`"${label}" config copied to clipboard`),
      () => toast.error('Copy failed — please select the text manually'),
    )
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <Button size="sm" variant="outline" onClick={copy} className="shrink-0 gap-1.5">
          <Copy className="w-3.5 h-3.5" /> Copy
        </Button>
      </div>
      <pre className="text-xs bg-slate-900 text-slate-100 dark:bg-slate-950 rounded-md p-3 overflow-x-auto font-mono leading-relaxed whitespace-pre">
        {code}
      </pre>
    </div>
  )
}

export function ImageTools() {
  const queryClient = useQueryClient()
  const [webpEnabled, setWebpEnabled] = useState<boolean | null>(null)
  const [maxWidth, setMaxWidth] = useState<number | null>(null)
  const [maxHeight, setMaxHeight] = useState<number | null>(null)
  const [jpegQuality, setJpegQuality] = useState<number | null>(null)
  const [avifEnabled, setAvifEnabled] = useState<boolean | null>(null)
  const [svgEnabled, setSvgEnabled] = useState<boolean | null>(null)
  const [svgRoles, setSvgRoles] = useState<string[] | null>(null)
  const [serveWebp, setServeWebp] = useState<boolean | null>(null)
  const [deleteOriginals, setDeleteOriginals] = useState<boolean | null>(null)

  // Batch convert state
  const [converting, setConverting] = useState(false)
  const [convertDone, setConvertDone] = useState(0)
  const [convertTotal, setConvertTotal] = useState(0)
  const stopRef = useRef(false)

  const { data: settings, isLoading } = useQuery<ImageSettings>({
    queryKey: ['image-settings'],
    queryFn: () => api.get('/images/settings'),
  })

  const saveMutation = useMutation({
    mutationFn: () => api.post('/images/settings', {
      webp_enabled: webpEnabled ?? settings?.webp_enabled,
      avif_enabled: avifEnabled ?? settings?.avif_enabled,
      max_width: maxWidth ?? settings?.max_width,
      max_height: maxHeight ?? settings?.max_height,
      jpeg_quality: jpegQuality ?? settings?.jpeg_quality,
      svg_enabled: svgEnabled ?? settings?.svg_enabled,
      svg_allowed_roles: svgRoles ?? settings?.svg_allowed_roles,
      webp_serve_webp: serveWebp ?? settings?.webp_serve_webp,
      webp_delete_originals: deleteOriginals ?? settings?.webp_delete_originals,
    }),
    onSuccess: () => {
      toast.success('Image settings saved')
      queryClient.invalidateQueries({ queryKey: ['image-settings'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const regenerateMutation = useMutation({
    mutationFn: () => api.post('/images/regenerate', {}),
    onSuccess: (data: any) => toast.success(data.message),
    onError: (err: Error) => toast.error(err.message),
  })

  const { data: webpStats, refetch: refetchWebpStats } = useQuery<ConvertStatsResponse>({
    queryKey: ['convert-stats-webp'],
    queryFn: () => api.get('/images/convert-stats?format=webp'),
    enabled: !!settings?.webp_support,
  })

  const { data: avifStats, refetch: refetchAvifStats } = useQuery<ConvertStatsResponse>({
    queryKey: ['convert-stats-avif'],
    queryFn: () => api.get('/images/convert-stats?format=avif'),
    enabled: !!settings?.avif_support,
  })

  const startBatchConvert = async (format: 'webp' | 'avif') => {
    setConverting(true)
    setConvertDone(0)
    stopRef.current = false
    const replaceOriginal = (deleteOriginals ?? settings?.webp_delete_originals ?? false) && format === 'webp'

    try {
      const stats = await api.get(`/images/convert-stats?format=${format}`) as ConvertStatsResponse
      const total = stats.total
      setConvertTotal(total)
      if (total === 0) {
        toast.info('No images found to convert.')
        setConverting(false)
        return
      }

      let offset = 0
      let done = 0
      const limit = 10

      while (!stopRef.current) {
        const result = await api.post('/images/convert', {
          format,
          offset,
          limit,
          delete_original: replaceOriginal,
        }) as ConvertBatchResponse
        done += result.converted + result.skipped
        setConvertDone(done)
        if (!result.has_more) break
        offset = result.next_offset
      }

      if (!stopRef.current) {
        toast.success(`${format.toUpperCase()} conversion complete!`)
        format === 'webp' ? refetchWebpStats() : refetchAvifStats()
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setConverting(false)
      stopRef.current = false
    }
  }

  const deleteConvertedMutation = useMutation({
    mutationFn: (format: 'webp' | 'avif') =>
      api.delete(`/images/convert?format=${format}`, {}),
    onSuccess: (data: any, format) => {
      toast.success(data.message)
      format === 'webp' ? refetchWebpStats() : refetchAvifStats()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) return <PageLoader text="Loading image settings..." />

  const currentWebp = webpEnabled ?? settings?.webp_enabled ?? false
  const currentAvif = avifEnabled ?? settings?.avif_enabled ?? false
  const currentMaxWidth = maxWidth ?? settings?.max_width ?? 0
  const currentMaxHeight = maxHeight ?? settings?.max_height ?? 0
  const currentQuality = jpegQuality ?? settings?.jpeg_quality ?? 82
  const currentSvgEnabled = svgEnabled ?? settings?.svg_enabled ?? false
  const currentSvgRoles = svgRoles ?? settings?.svg_allowed_roles ?? ['administrator']
  const currentServeWebp = serveWebp ?? settings?.webp_serve_webp ?? false
  const currentDeleteOriginals = deleteOriginals ?? settings?.webp_delete_originals ?? false

  const toggleSvgRole = (role: string) => {
    const base = svgRoles ?? settings?.svg_allowed_roles ?? ['administrator']
    if (base.includes(role)) {
      setSvgRoles(base.filter(r => r !== role))
    } else {
      setSvgRoles([...base, role])
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        title="Image Tools"
        description="Manage image processing, WebP conversion, and thumbnail sizes"
      />

      <div className="p-6 space-y-6">
        {/* Support Status */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'GD Library', value: settings?.gd_support },
            { label: 'ImageMagick', value: settings?.imagick_support },
            { label: 'WebP Support', value: settings?.webp_support },
            { label: 'AVIF Support', value: settings?.avif_support },
          ].map(item => (
            <Card key={item.label}>
              <CardContent className="p-4 flex items-center gap-3">
                {item.value ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-800">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.value ? 'Available' : 'Not available'}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="w-4 h-4" />
                Image Settings
              </CardTitle>
              <CardDescription>Control image processing behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* WebP */}
              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <div>
                  <Label className="text-sm">Convert to WebP on Upload</Label>
                  <p className="text-xs text-slate-500 mt-0.5">Automatically convert uploaded images to WebP format</p>
                </div>
                <Switch
                  checked={currentWebp}
                  onCheckedChange={setWebpEnabled}
                  disabled={!settings?.webp_support}
                />
              </div>

              {!settings?.webp_support && (
                <Alert variant="warning">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription className="text-xs">
                    WebP support requires GD with WebP support or ImageMagick.
                  </AlertDescription>
                </Alert>
              )}

              {/* AVIF */}
              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <div>
                  <Label className="text-sm">Allow AVIF Uploads</Label>
                  <p className="text-xs text-slate-500 mt-0.5">Enable AVIF image format support (requires PHP 8.1+ or ImageMagick)</p>
                </div>
                <Switch
                  checked={currentAvif}
                  onCheckedChange={setAvifEnabled}
                  disabled={!settings?.avif_support}
                />
              </div>

              {!settings?.avif_support && (
                <Alert variant="warning">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription className="text-xs">
                    AVIF support requires PHP 8.1+ with GD (imageavif) or ImageMagick with AVIF codec.
                  </AlertDescription>
                </Alert>
              )}

              {/* Max Dimensions */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Maximum Image Dimensions</Label>
                <p className="text-xs text-slate-500">Uploaded images larger than these dimensions will be resized. Set to 0 to disable.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="max-w" className="text-xs text-slate-500">Max Width (px)</Label>
                    <Input
                      id="max-w"
                      type="number"
                      placeholder="0 = unlimited"
                      value={currentMaxWidth || ''}
                      onChange={e => setMaxWidth(parseInt(e.target.value) || 0)}
                      min={0}
                    />
                  </div>
                  <div>
                    <Label htmlFor="max-h" className="text-xs text-slate-500">Max Height (px)</Label>
                    <Input
                      id="max-h"
                      type="number"
                      placeholder="0 = unlimited"
                      value={currentMaxHeight || ''}
                      onChange={e => setMaxHeight(parseInt(e.target.value) || 0)}
                      min={0}
                    />
                  </div>
                </div>
              </div>

              {/* JPEG Quality */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="quality" className="text-sm font-medium">JPEG Quality</Label>
                  <span className="text-sm font-bold text-blue-600">{currentQuality}%</span>
                </div>
                <input
                  id="quality"
                  type="range"
                  min={10}
                  max={100}
                  value={currentQuality}
                  onChange={e => setJpegQuality(parseInt(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Smaller file</span>
                  <span>Best quality</span>
                </div>
              </div>

              <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Settings
              </Button>
            </CardContent>
          </Card>

          {/* Thumbnail Sizes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Registered Thumbnail Sizes</CardTitle>
              <CardDescription>Image sizes registered by WordPress and themes</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div>
                {settings?.thumbnail_sizes && Object.entries(settings.thumbnail_sizes).map(([key, size]) => (
                  <div key={key} className="flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{size.name}</p>
                      <p className="text-xs font-mono text-slate-400">{key}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">
                        {size.width || '∞'} × {size.height || '∞'}
                      </span>
                      {size.crop && <Badge variant="secondary" className="text-[10px]">Crop</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* WebP Serving & Replace Options */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              WebP Delivery Options
            </CardTitle>
            <CardDescription>
              Control how WebP files are served to visitors and how conversions are applied.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Serve WebP */}
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <div>
                <Label className="text-sm font-medium">Serve WebP Automatically</Label>
                <p className="text-xs text-slate-500 mt-0.5">
                  When a .webp sidecar exists, serve it to browsers that support WebP (via PHP filter + .htaccess on Apache).
                  Images are fetched faster with no quality loss.
                </p>
              </div>
              <Switch
                checked={currentServeWebp}
                onCheckedChange={setServeWebp}
                disabled={!settings?.webp_support}
              />
            </div>

            {currentServeWebp && (
              <Alert>
                <CheckCircle2 className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  <strong>Apache:</strong> Rewrite rules are written to <code className="font-mono">wp-content/uploads/.htaccess</code> for server-level serving (no PHP overhead).{' '}
                  <strong>Nginx:</strong> The PHP filter is used as fallback — add the equivalent rewrite rule to your Nginx config manually.
                </AlertDescription>
              </Alert>
            )}

            {/* Replace Original */}
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <Replace className="w-4 h-4 text-amber-500" />
                <div>
                  <Label className="text-sm font-medium">Replace Original with WebP</Label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    On upload and batch convert: delete the original JPEG/PNG and replace it with the .webp version.
                    The media library entry is updated automatically. <span className="text-amber-600 font-medium">Irreversible.</span>
                  </p>
                </div>
              </div>
              <Switch
                checked={currentDeleteOriginals}
                onCheckedChange={setDeleteOriginals}
                disabled={!settings?.webp_support}
              />
            </div>

            {currentDeleteOriginals && (
              <Alert variant="warning">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  <strong>Warning:</strong> Original files will be permanently deleted after conversion.
                  Make sure you have a backup before running batch convert with this option enabled.
                </AlertDescription>
              </Alert>
            )}

            <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Delivery Settings
            </Button>
          </CardContent>
        </Card>

        {/* Server Config Generator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              Server Config Generator
            </CardTitle>
            <CardDescription>
              Ready-to-use server configuration snippets for WebP serving, caching, and security headers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="nginx">
              <TabsList className="mb-4">
                <TabsTrigger value="nginx">Nginx</TabsTrigger>
                <TabsTrigger value="apache">Apache</TabsTrigger>
              </TabsList>

              <TabsContent value="nginx" className="space-y-4">
                <ServerConfigBlock
                  label="WebP Serving"
                  description="Add inside your server {} block to serve .webp sidecars to supported browsers."
                  code={`# WebP serving — inside server {} block
location ~* \\.(jpe?g|png|gif|bmp|tiff?)$ {
    add_header Vary Accept;
    try_files $uri.webp $uri =404;
}`}
                />
                <ServerConfigBlock
                  label="Security Headers"
                  description="Recommended security headers — add inside your server {} or location / block."
                  code={`# Security headers
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;`}
                />
                <ServerConfigBlock
                  label="Browser Cache Rules"
                  description="Cache static assets aggressively to improve page speed scores."
                  code={`# Browser caching for static assets
location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    access_log off;
}`}
                />
              </TabsContent>

              <TabsContent value="apache" className="space-y-4">
                <ServerConfigBlock
                  label="WebP Serving (.htaccess)"
                  description="WP Manager Pro writes this automatically when 'Serve WebP' is enabled. Add manually if needed."
                  code={`# WebP serving — inside <IfModule mod_rewrite.c>
RewriteEngine On
RewriteCond %{HTTP_ACCEPT} image/webp
RewriteCond %{REQUEST_FILENAME} \\.(jpe?g|png|gif|bmp|tiff?)$
RewriteCond %{REQUEST_FILENAME}\\.webp -f
RewriteRule ^ %{REQUEST_URI}.webp [L,T=image/webp]`}
                />
                <ServerConfigBlock
                  label="Security Headers (.htaccess)"
                  description="Add inside <IfModule mod_headers.c>."
                  code={`<IfModule mod_headers.c>
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>`}
                />
                <ServerConfigBlock
                  label="Browser Cache Rules (.htaccess)"
                  description="Cache static assets — add inside <IfModule mod_expires.c>."
                  code={`<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/webp "access plus 1 year"
    ExpiresByType image/png  "access plus 1 year"
    ExpiresByType text/css   "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
</IfModule>`}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* SVG Support Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              SVG Support
            </CardTitle>
            <CardDescription>
              Allow SVG file uploads for selected user roles. SVGs are sanitized on upload.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-xs">
                SVGs are sanitized on upload. Restrict to trusted roles only. Malicious SVGs can be a security risk.
              </AlertDescription>
            </Alert>

            {/* Enable SVG toggle */}
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <div>
                <Label className="text-sm font-medium">Allow SVG Uploads</Label>
                <p className="text-xs text-slate-500 mt-0.5">Enable SVG file uploads for the selected roles below</p>
              </div>
              <Switch
                checked={currentSvgEnabled}
                onCheckedChange={setSvgEnabled}
              />
            </div>

            {/* Role checkboxes */}
            <div className={`space-y-3 ${!currentSvgEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <Label className="text-sm font-medium">Allowed Roles</Label>
              <p className="text-xs text-slate-500">Only users with these roles can upload SVG files.</p>
              <div className="space-y-2">
                {SVG_ROLES.map(role => (
                  <label key={role.key} className="flex items-center gap-3 cursor-pointer select-none py-1">
                    <input
                      type="checkbox"
                      checked={currentSvgRoles.includes(role.key)}
                      onChange={() => toggleSvgRole(role.key)}
                      disabled={!currentSvgEnabled}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <span className="text-sm text-slate-700 capitalize">{role.label}</span>
                    {role.key === 'administrator' && (
                      <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save SVG Settings
            </Button>
          </CardContent>
        </Card>

        {/* Regenerate Thumbnails */}
        <Card>
          <CardHeader>
            <CardTitle>Regenerate Thumbnails</CardTitle>
            <CardDescription>
              Regenerate all image thumbnails to match current size settings. This is useful after changing theme or image sizes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-xs">
                This process may take a long time for sites with many images. Do not close this page during regeneration.
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
              variant="outline"
            >
              {regenerateMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Image className="w-4 h-4" />
              )}
              {regenerateMutation.isPending ? 'Regenerating...' : 'Regenerate All Thumbnails'}
            </Button>
          </CardContent>
        </Card>

        {/* Batch Convert to WebP / AVIF */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Batch Convert Existing Images
            </CardTitle>
            <CardDescription>
              Convert your existing media library images to WebP or AVIF format.
              {currentDeleteOriginals
                ? ' Originals will be replaced and removed after conversion.'
                : ' Converted files are saved alongside originals.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!currentDeleteOriginals && (
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  Converted files are saved as <code className="font-mono">image.webp</code> / <code className="font-mono">image.avif</code> alongside the original.
                  Enable <strong>Replace Original with WebP</strong> above to delete originals after conversion.
                </AlertDescription>
              </Alert>
            )}

            {/* Progress bar */}
            {converting && convertTotal > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Converting…</span>
                  <span className="font-mono text-blue-600">{convertDone} / {convertTotal}</span>
                </div>
                <Progress value={Math.round((convertDone / convertTotal) * 100)} className="h-2" />
              </div>
            )}

            {/* WebP row */}
            <div className="flex items-center justify-between py-3 border rounded-lg px-4">
              <div>
                <p className="text-sm font-medium">WebP</p>
                {webpStats && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {webpStats.converted} of {webpStats.total} images converted
                    {webpStats.remaining > 0 && ` · ${webpStats.remaining} remaining`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {webpStats && webpStats.converted > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    disabled={converting || deleteConvertedMutation.isPending}
                    onClick={() => {
                      if (confirm(`Delete all ${webpStats.converted} converted .webp sidecar files?`)) {
                        deleteConvertedMutation.mutate('webp')
                      }
                    }}
                    title="Delete all .webp sidecar files"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={converting || !settings?.webp_support || webpStats?.remaining === 0}
                  onClick={() => startBatchConvert('webp')}
                >
                  {converting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {webpStats?.remaining === 0 ? 'All Converted' : currentDeleteOriginals ? 'Convert & Replace' : 'Convert to WebP'}
                </Button>
              </div>
            </div>

            {/* AVIF row */}
            <div className="flex items-center justify-between py-3 border rounded-lg px-4">
              <div>
                <p className="text-sm font-medium">AVIF</p>
                {avifStats && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {avifStats.converted} of {avifStats.total} images converted
                    {avifStats.remaining > 0 && ` · ${avifStats.remaining} remaining`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {avifStats && avifStats.converted > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    disabled={converting || deleteConvertedMutation.isPending}
                    onClick={() => {
                      if (confirm(`Delete all ${avifStats.converted} converted .avif sidecar files?`)) {
                        deleteConvertedMutation.mutate('avif')
                      }
                    }}
                    title="Delete all .avif sidecar files"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={converting || !settings?.avif_support || avifStats?.remaining === 0}
                  onClick={() => startBatchConvert('avif')}
                >
                  {converting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {avifStats?.remaining === 0 ? 'All Converted' : 'Convert to AVIF'}
                </Button>
              </div>
            </div>

            {converting && (
              <Button variant="outline" size="sm" onClick={() => { stopRef.current = true }}>
                Stop Conversion
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
