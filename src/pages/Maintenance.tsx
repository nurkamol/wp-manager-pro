import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Construction, Power, CheckCircle2, AlertTriangle, Eye, RefreshCw } from 'lucide-react'
import { useState } from 'react'

interface MaintenanceStatus {
  active: boolean
  message: string
  title: string
  end_time: string
}

export function Maintenance() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<MaintenanceStatus>({
    queryKey: ['maintenance'],
    queryFn: () => api.get('/maintenance'),
  })

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [endTime, setEndTime] = useState('')

  const toggleMutation = useMutation({
    mutationFn: (enable: boolean) => api.post('/maintenance/toggle', {
      enable,
      title: title || data?.title,
      message: message || data?.message,
      end_time: endTime || data?.end_time,
    }),
    onSuccess: (_, enable) => {
      toast[enable ? 'success' : 'info'](enable ? 'Maintenance mode enabled' : 'Maintenance mode disabled')
      queryClient.invalidateQueries({ queryKey: ['maintenance'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) return <PageLoader text="Loading maintenance settings..." />

  return (
    <div className="fade-in">
      <PageHeader
        title="Maintenance Mode"
        description="Control when your site shows a maintenance page to visitors"
      />

      <div className="p-6 max-w-3xl space-y-6">
        {/* Status Card */}
        <Card className={data?.active ? 'border-amber-300 bg-amber-50' : ''}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${data?.active ? 'bg-amber-100' : 'bg-slate-100'}`}>
                  <Construction className={`w-6 h-6 ${data?.active ? 'text-amber-600' : 'text-slate-400'}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Maintenance Mode is {data?.active ? (
                      <span className="text-amber-600">Active</span>
                    ) : (
                      <span className="text-green-600">Inactive</span>
                    )}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {data?.active
                      ? 'Visitors see the maintenance page. Admins can still access the site.'
                      : 'Your site is accessible to all visitors.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {data?.active && (
                  <Badge variant="warning" className="gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
                    Live
                  </Badge>
                )}
                {!data?.active && (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Online
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Maintenance Page Settings</CardTitle>
            <CardDescription>Customize what visitors see during maintenance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Page Title</Label>
              <Input
                id="title"
                placeholder={data?.title || 'Site Under Maintenance'}
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder={data?.message || 'We are performing scheduled maintenance. We will be back shortly.'}
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endtime">Expected End Time (optional)</Label>
              <Input
                id="endtime"
                type="datetime-local"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
              />
              <p className="text-xs text-slate-500">This is informational only — shown in the message if you include it.</p>
            </div>
          </CardContent>
        </Card>

        {/* Warning when active */}
        {data?.active && (
          <Alert variant="warning">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              <strong>Your site is in maintenance mode.</strong> Regular visitors cannot access your content.
              Only logged-in administrators can view the site normally.
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={() => toggleMutation.mutate(!data?.active)}
            disabled={toggleMutation.isPending}
            variant={data?.active ? 'outline' : 'default'}
            className="flex-1"
            size="lg"
          >
            {toggleMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : data?.active ? (
              <Power className="w-4 h-4" />
            ) : (
              <Construction className="w-4 h-4" />
            )}
            {data?.active ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode'}
          </Button>
        </div>

        {/* Preview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Maintenance Page Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-b-lg overflow-hidden">
              <div
                style={{
                  background: 'linear-gradient(135deg, #1e1e2e 0%, #16213e 50%, #0f3460 100%)',
                  minHeight: '200px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  textAlign: 'center',
                  padding: '40px',
                }}
              >
                <div>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚙️</div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '8px' }}>
                    {title || data?.title || 'Site Under Maintenance'}
                  </h2>
                  <p style={{ opacity: 0.8, maxWidth: '400px' }}>
                    {message || data?.message || 'We are performing scheduled maintenance. We will be back shortly.'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
