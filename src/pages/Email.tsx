import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Mail, Save, RefreshCw, SendHorizonal, Trash2, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface SmtpSettings {
  enabled: boolean
  host: string
  port: number
  username: string
  password: string
  encryption: 'none' | 'ssl' | 'tls'
  from_email: string
  from_name: string
}

interface EmailLogEntry {
  id: number
  to_email: string
  subject: string
  message: string
  headers: string
  status: 'sent' | 'failed'
  error: string
  created_at: string
}

interface LogResponse {
  emails: EmailLogEntry[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

const defaultSettings: SmtpSettings = {
  enabled: false,
  host: '',
  port: 587,
  username: '',
  password: '',
  encryption: 'tls',
  from_email: '',
  from_name: '',
}

export function Email() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'smtp' | 'log'>('smtp')
  const [logPage, setLogPage] = useState(1)
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [showClearLog, setShowClearLog] = useState(false)
  const [settings, setSettings] = useState<SmtpSettings>(defaultSettings)
  const [initialised, setInitialised] = useState(false)

  // TanStack Query v5 removed onSuccess from useQuery — use useEffect instead
  const { data: settingsData, isLoading: settingsLoading } = useQuery<{ settings: SmtpSettings }>({
    queryKey: ['email-settings'],
    queryFn: () => api.get('/email/settings'),
  })

  useEffect(() => {
    if (settingsData?.settings && !initialised) {
      setSettings(settingsData.settings)
      setInitialised(true)
    }
  }, [settingsData, initialised])

  const { data: logData, isLoading: logLoading } = useQuery<LogResponse>({
    queryKey: ['email-log', logPage],
    queryFn: () => api.get(`/email/log?page=${logPage}&per_page=50`),
    enabled: activeTab === 'log',
  })

  const saveMutation = useMutation({
    mutationFn: (data: SmtpSettings) => api.post<{ settings: SmtpSettings }>('/email/settings', data),
    onSuccess: (data) => {
      toast.success('SMTP settings saved')
      setSettings(data.settings)
      queryClient.setQueryData(['email-settings'], { settings: data.settings })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const testMutation = useMutation({
    mutationFn: (to: string) => api.post('/email/test', { to }),
    onSuccess: () => {
      toast.success('Test email sent!')
      setShowTestDialog(false)
      setTestEmail('')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const clearLogMutation = useMutation({
    mutationFn: () => api.delete('/email/log/clear'),
    onSuccess: () => {
      toast.success('Email log cleared')
      setShowClearLog(false)
      queryClient.invalidateQueries({ queryKey: ['email-log'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (settingsLoading) return <PageLoader text="Loading email settings..." />

  return (
    <div className="fade-in">
      <PageHeader
        title="Email & SMTP"
        description="Configure SMTP delivery and view email logs"
      />

      {/* Tabs */}
      <div className="px-6 border-b border-slate-200 dark:border-slate-700 flex gap-1">
        {(['smtp', 'log'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize -mb-px ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab === 'smtp' ? 'SMTP Settings' : 'Email Log'}
          </button>
        ))}
      </div>

      <div className="p-6">
        {activeTab === 'smtp' && (
          <div className="max-w-2xl space-y-6">
            {/* Enable toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-white dark:bg-slate-900">
              <div>
                <p className="font-medium text-sm text-slate-800 dark:text-slate-200">Enable Custom SMTP</p>
                <p className="text-xs text-slate-500 mt-0.5">Override WordPress default email sending</p>
              </div>
              <Switch
                checked={!!settings.enabled}
                onCheckedChange={(v) => setSettings(s => ({ ...s, enabled: v }))}
              />
            </div>

            {/* SMTP fields */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp-host">SMTP Host</Label>
                  <Input
                    id="smtp-host"
                    placeholder="smtp.gmail.com"
                    value={settings.host}
                    onChange={e => setSettings(s => ({ ...s, host: e.target.value }))}
                    disabled={!settings.enabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-port">Port</Label>
                  <Input
                    id="smtp-port"
                    type="number"
                    placeholder="587"
                    value={settings.port || ''}
                    onChange={e => setSettings(s => ({ ...s, port: parseInt(e.target.value) || 587 }))}
                    disabled={!settings.enabled}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-enc">Encryption</Label>
                <Select
                  value={settings.encryption}
                  onValueChange={(v) => setSettings(s => ({ ...s, encryption: v as 'none' | 'ssl' | 'tls' }))}
                  disabled={!settings.enabled}
                >
                  <SelectTrigger id="smtp-enc">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tls">TLS (recommended — port 587)</SelectItem>
                    <SelectItem value="ssl">SSL (port 465)</SelectItem>
                    <SelectItem value="none">None (port 25)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp-user">Username</Label>
                  <Input
                    id="smtp-user"
                    placeholder="you@example.com"
                    value={settings.username}
                    onChange={e => setSettings(s => ({ ...s, username: e.target.value }))}
                    disabled={!settings.enabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-pass">Password</Label>
                  <Input
                    id="smtp-pass"
                    type="password"
                    placeholder="App password or SMTP password"
                    value={settings.password}
                    onChange={e => setSettings(s => ({ ...s, password: e.target.value }))}
                    disabled={!settings.enabled}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp-from-email">From Email</Label>
                  <Input
                    id="smtp-from-email"
                    type="email"
                    placeholder="noreply@yourdomain.com"
                    value={settings.from_email}
                    onChange={e => setSettings(s => ({ ...s, from_email: e.target.value }))}
                    disabled={!settings.enabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-from-name">From Name</Label>
                  <Input
                    id="smtp-from-name"
                    placeholder="My Website"
                    value={settings.from_name}
                    onChange={e => setSettings(s => ({ ...s, from_name: e.target.value }))}
                    disabled={!settings.enabled}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={() => saveMutation.mutate(settings)}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Settings
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowTestDialog(true)}
                disabled={!settings.enabled}
              >
                <SendHorizonal className="w-4 h-4" />
                Send Test Email
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'log' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{logData?.total ?? 0} emails logged</p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowClearLog(true)}
                disabled={!logData?.total}
              >
                <Trash2 className="w-4 h-4" /> Clear Log
              </Button>
            </div>

            {logLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : !logData?.emails.length ? (
              <div className="text-center py-16 text-slate-400">
                <Mail className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-medium text-slate-500 mb-1">No emails logged yet</h3>
                <p className="text-sm">Outgoing emails will appear here once your site sends them.</p>
              </div>
            ) : (
              <>
                <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300 w-32">Date</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">To</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Subject</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300 w-24">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {logData.emails.map(email => (
                        <tr key={email.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formatDate(email.created_at)}
                          </td>
                          <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                            {email.to_email}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 max-w-sm truncate">
                            {email.subject}
                          </td>
                          <td className="px-4 py-2.5">
                            {email.status === 'sent' ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400" title={email.error}>
                                <XCircle className="w-3.5 h-3.5" /> Failed
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {logData.total_pages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">Page {logData.page} of {logData.total_pages}</p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={logPage === 1}>
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setLogPage(p => Math.min(logData.total_pages, p + 1))} disabled={logPage === logData.total_pages}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Send Test Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="test-to">Recipient Email</Label>
            <Input
              id="test-to"
              type="email"
              placeholder="you@example.com"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>Cancel</Button>
            <Button
              onClick={() => testMutation.mutate(testEmail)}
              disabled={!testEmail || testMutation.isPending}
            >
              {testMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Log Confirm */}
      <Dialog open={showClearLog} onOpenChange={setShowClearLog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Email Log</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Are you sure you want to clear all email log entries?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearLog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => clearLogMutation.mutate()}
              disabled={clearLogMutation.isPending}
            >
              Clear Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
