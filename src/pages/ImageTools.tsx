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
import { toast } from 'sonner'
import { Image, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Save } from 'lucide-react'
import { useState } from 'react'

interface ImageSettings {
  webp_enabled: boolean
  max_width: number
  max_height: number
  jpeg_quality: number
  thumbnail_sizes: Record<string, { name: string; width: number; height: number; crop: boolean }>
  gd_support: boolean
  imagick_support: boolean
  webp_support: boolean
}

export function ImageTools() {
  const queryClient = useQueryClient()
  const [webpEnabled, setWebpEnabled] = useState<boolean | null>(null)
  const [maxWidth, setMaxWidth] = useState<number | null>(null)
  const [maxHeight, setMaxHeight] = useState<number | null>(null)
  const [jpegQuality, setJpegQuality] = useState<number | null>(null)

  const { data: settings, isLoading } = useQuery<ImageSettings>({
    queryKey: ['image-settings'],
    queryFn: () => api.get('/images/settings'),
  })

  const saveMutation = useMutation({
    mutationFn: () => api.post('/images/settings', {
      webp_enabled: webpEnabled,
      max_width: maxWidth,
      max_height: maxHeight,
      jpeg_quality: jpegQuality,
    }),
    onSuccess: () => {
      toast.success('Image settings saved')
      queryClient.invalidateQueries({ queryKey: ['image-settings'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const regenerateMutation = useMutation({
    mutationFn: () => api.post('/images/regenerate', {}),
    onSuccess: (data: any) => {
      toast.success(data.message)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) return <PageLoader text="Loading image settings..." />

  const currentWebp = webpEnabled ?? settings?.webp_enabled ?? false
  const currentMaxWidth = maxWidth ?? settings?.max_width ?? 0
  const currentMaxHeight = maxHeight ?? settings?.max_height ?? 0
  const currentQuality = jpegQuality ?? settings?.jpeg_quality ?? 82

  return (
    <div className="fade-in">
      <PageHeader
        title="Image Tools"
        description="Manage image processing, WebP conversion, and thumbnail sizes"
      />

      <div className="p-6 space-y-6">
        {/* Support Status */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'GD Library', value: settings?.gd_support },
            { label: 'ImageMagick', value: settings?.imagick_support },
            { label: 'WebP Support', value: settings?.webp_support },
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
      </div>
    </div>
  )
}
