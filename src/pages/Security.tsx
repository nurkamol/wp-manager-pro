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
import { toast } from 'sonner'
import {
  Shield, ShieldCheck, ShieldOff, RefreshCw, Save,
  ExternalLink, AlertTriangle, CheckCircle2, Lock, Copy,
} from 'lucide-react'
import { useState, useEffect } from 'react'

interface SecurityStatus {
  enabled: boolean
  slug: string | null
  custom_url: string | null
  login_url: string
}

export function Security() {
  const queryClient = useQueryClient()
  const [slug, setSlug] = useState('')
  const [initialized, setInitialized] = useState(false)

  const { data, isLoading } = useQuery<SecurityStatus>({
    queryKey: ['security'],
    queryFn: () => api.get('/security'),
  })

  useEffect(() => {
    if (data && !initialized) {
      setSlug(data.slug || '')
      setInitialized(true)
    }
  }, [data, initialized])

  const enableMutation = useMutation({
    mutationFn: () => api.post('/security/admin-url', { slug }),
    onSuccess: () => {
      toast.success('Admin URL protection enabled')
      queryClient.invalidateQueries({ queryKey: ['security'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const disableMutation = useMutation({
    mutationFn: () => api.delete('/security/admin-url'),
    onSuccess: () => {
      toast.info('Admin URL protection disabled')
      queryClient.invalidateQueries({ queryKey: ['security'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const copyUrl = () => {
    const url = data?.custom_url || data?.login_url
    if (url) {
      navigator.clipboard.writeText(url).then(() => toast.success('Login URL copied!'))
    }
  }

  if (isLoading) return <PageLoader text="Loading security settings..." />

  const isEnabled = data?.enabled ?? false

  return (
    <div className="fade-in">
      <PageHeader
        title="Security"
        description="Protect your WordPress admin area from unauthorized access attempts"
      />

      <div className="p-6 max-w-3xl space-y-6">

        {/* Status Card */}
        <Card className={isEnabled ? 'border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-800' : ''}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${isEnabled ? 'bg-green-100 dark:bg-green-900/40' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  {isEnabled
                    ? <ShieldCheck className="w-6 h-6 text-green-600" />
                    : <ShieldOff className="w-6 h-6 text-slate-400" />
                  }
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    Admin URL Protection is{' '}
                    {isEnabled
                      ? <span className="text-green-600">Enabled</span>
                      : <span className="text-slate-500">Disabled</span>
                    }
                  </h3>
                  <p className="text-sm text-slate-500">
                    {isEnabled
                      ? `Direct access to wp-login.php is blocked. Use your secret URL to log in.`
                      : 'wp-login.php is publicly accessible by default.'}
                  </p>
                </div>
              </div>
              {isEnabled ? (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Protected
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <Shield className="w-3 h-3" />
                  Standard
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Custom Login URL Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Custom Login URL
            </CardTitle>
            <CardDescription>
              Replace the default <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">wp-login.php</code> with a secret URL slug.
              Direct access to <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">wp-login.php</code> will be blocked.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-xs">
                <strong>Important:</strong> After enabling, save your new login URL before leaving this page.
                Password reset emails will still work. Do not use common words like <em>login</em> or <em>admin</em>.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="slug">Login URL Slug</Label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                  <span className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-500 text-sm border-r border-slate-200 dark:border-slate-700 shrink-0 select-none">
                    /
                  </span>
                  <input
                    id="slug"
                    type="text"
                    value={slug}
                    onChange={e => setSlug(e.target.value.replace(/[^a-z0-9-_]/g, '').toLowerCase())}
                    placeholder="my-secret-login"
                    className="flex-1 px-3 py-2 bg-transparent text-sm outline-none dark:text-slate-100"
                    minLength={4}
                    maxLength={64}
                  />
                </div>
                <Button
                  onClick={() => enableMutation.mutate()}
                  disabled={enableMutation.isPending || slug.length < 4}
                >
                  {enableMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isEnabled ? 'Update' : 'Enable'}
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Only lowercase letters, numbers, hyphens, and underscores. Minimum 4 characters.
              </p>
            </div>

            {/* Current login URL display */}
            {isEnabled && data?.custom_url && (
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Your Current Login URL</Label>
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                  <code className="flex-1 text-sm text-green-800 dark:text-green-300 break-all font-mono">
                    {data.custom_url}
                  </code>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={copyUrl} className="h-7 px-2 text-green-700 dark:text-green-400">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <a href={data.custom_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-green-700 dark:text-green-400">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Bookmark this URL. Direct access to wp-login.php will redirect to the homepage.
                </p>
              </div>
            )}

            {/* Disable button */}
            {isEnabled && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                <Button
                  variant="outline"
                  onClick={() => disableMutation.mutate()}
                  disabled={disableMutation.isPending}
                  className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/30"
                >
                  {disableMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldOff className="w-4 h-4" />
                  )}
                  Disable Protection
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              {[
                {
                  icon: '🔗',
                  title: 'Custom URL',
                  desc: 'Your login page moves to a secret slug only you know.',
                },
                {
                  icon: '🚫',
                  title: 'Blocked Access',
                  desc: 'Direct GET requests to wp-login.php redirect to your homepage.',
                },
                {
                  icon: '✅',
                  title: 'Always Safe',
                  desc: 'Login form submissions, password resets, and admin actions continue to work.',
                },
                {
                  icon: '🤖',
                  title: 'Bot Protection',
                  desc: 'Bots scanning for wp-login.php will find nothing and stop brute-force attempts.',
                },
              ].map(item => (
                <div key={item.title} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <span className="text-lg mt-0.5">{item.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
