import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  AlertTriangle, FileText, MessageSquare, Image, Users, RefreshCw, Trash2, LayoutTemplate
} from 'lucide-react'

interface ResetStatus {
  posts: number
  pages: number
  comments: number
  media: number
  users_non_admin: number
}

interface ResetOption {
  key: keyof ResetStatus
  label: string
  description: string
  icon: React.ReactNode
  color: string
}

const RESET_OPTIONS: ResetOption[] = [
  {
    key: 'posts',
    label: 'Posts',
    description: 'Delete all posts and their meta data',
    icon: <FileText className="w-5 h-5" />,
    color: 'text-blue-500',
  },
  {
    key: 'pages',
    label: 'Pages',
    description: 'Delete all pages and their meta data',
    icon: <LayoutTemplate className="w-5 h-5" />,
    color: 'text-purple-500',
  },
  {
    key: 'comments',
    label: 'Comments',
    description: 'Delete all comments and comment meta',
    icon: <MessageSquare className="w-5 h-5" />,
    color: 'text-green-500',
  },
  {
    key: 'media',
    label: 'Media',
    description: 'Delete all attachments and their files from disk',
    icon: <Image className="w-5 h-5" />,
    color: 'text-orange-500',
  },
  {
    key: 'users_non_admin',
    label: 'Non-Admin Users',
    description: 'Delete all users except administrators',
    icon: <Users className="w-5 h-5" />,
    color: 'text-red-500',
  },
]

export function Reset() {
  const queryClient = useQueryClient()
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const { data: status, isLoading } = useQuery<ResetStatus>({
    queryKey: ['reset-status'],
    queryFn: () => api.get('/reset/status'),
  })

  const resetMutation = useMutation({
    mutationFn: () => api.post<{ results: Record<string, number> }>('/reset/execute', {
      types: selectedTypes,
      confirm: true,
    }),
    onSuccess: (data) => {
      const summary = Object.entries(data.results)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ')
      toast.success(`Reset complete: deleted ${summary}`)
      setSelectedTypes([])
      setConfirmed(false)
      setShowConfirmDialog(false)
      queryClient.invalidateQueries({ queryKey: ['reset-status'] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
      setShowConfirmDialog(false)
    },
  })

  const toggleType = (key: string) => {
    setSelectedTypes(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const getCount = (key: keyof ResetStatus): number => {
    return status?.[key] ?? 0
  }

  const selectedLabels = RESET_OPTIONS
    .filter(o => selectedTypes.includes(o.key))
    .map(o => o.label)

  if (isLoading) return <PageLoader text="Loading reset status..." />

  return (
    <div className="fade-in">
      <PageHeader
        title="Reset Tools"
        description="Reset WordPress content for development & testing"
        actions={
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="w-3 h-3" />
            Danger Zone
          </Badge>
        }
      />

      <div className="p-6 space-y-6 max-w-3xl">
        {/* Warning callout */}
        <div className="flex items-start gap-3 p-4 rounded-lg border border-yellow-200 bg-yellow-50">
          <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">Development Use Only</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              Use only in development environments. All operations are permanent and cannot be undone.
              Do not use on a live production site.
            </p>
          </div>
        </div>

        {/* Reset option cards */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Select Content to Delete</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {RESET_OPTIONS.map(option => {
              const count = getCount(option.key)
              const isSelected = selectedTypes.includes(option.key)
              return (
                <label
                  key={option.key}
                  className={`flex items-start gap-4 p-4 rounded-lg border bg-white cursor-pointer select-none transition-all ${
                    isSelected
                      ? 'border-red-300 bg-red-50 ring-1 ring-red-200'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleType(option.key)}
                    className="mt-0.5 w-4 h-4 accent-red-600 shrink-0"
                  />
                  <div className={`shrink-0 mt-0.5 ${option.color}`}>
                    {option.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800">{option.label}</p>
                      <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                        count > 0 ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400'
                      }`}>
                        {count.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{option.description}</p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {/* Confirm checkbox */}
        <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer select-none transition-all ${
          confirmed ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:bg-slate-50'
        }`}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-red-600 shrink-0"
          />
          <div>
            <p className="text-sm font-semibold text-slate-800">I understand this is irreversible</p>
            <p className="text-xs text-slate-500 mt-0.5">
              I confirm that I want to permanently delete the selected content. This action cannot be undone and there is no way to recover the data.
            </p>
          </div>
        </label>

        {/* Execute button */}
        <Button
          variant="destructive"
          size="lg"
          className="w-full"
          disabled={selectedTypes.length === 0 || !confirmed || resetMutation.isPending}
          onClick={() => setShowConfirmDialog(true)}
        >
          {resetMutation.isPending ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          Execute Reset
          {selectedTypes.length > 0 && (
            <span className="ml-1 opacity-80">({selectedTypes.length} selected)</span>
          )}
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confirm Permanent Deletion
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <span className="block">
                This will permanently delete the following content:
              </span>
              <ul className="list-disc list-inside space-y-1">
                {selectedLabels.map(label => (
                  <li key={label} className="text-sm font-medium text-slate-800">
                    All {label} ({getCount(RESET_OPTIONS.find(o => o.label === label)!.key).toLocaleString()} items)
                  </li>
                ))}
              </ul>
              <span className="block font-semibold text-red-600 mt-2">
                This cannot be undone. There is no way to recover deleted data.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={resetMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {resetMutation.isPending ? 'Deleting...' : 'Yes, Delete Everything'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
