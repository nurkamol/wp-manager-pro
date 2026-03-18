import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type NotificationType =
  | 'update_available'
  | 'backup_error'
  | 'lockout'
  | 'update_failed'
  | 'ssl_expiry'
  | 'vulnerability'
  | 'warning'
  | 'info'
  | 'success'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  link: string
  read: boolean
  created_at: string
}

interface NotificationsResponse {
  notifications: Notification[]
  total: number
  unread: number
}

export function useNotifications() {
  const qc = useQueryClient()

  const query = useQuery<NotificationsResponse>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications'),
    refetchInterval: 60_000, // poll every 60 s
    staleTime: 30_000,
  })

  const markRead = useMutation({
    mutationFn: (id: string) => api.post('/notifications/read', { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const dismiss = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllRead = () => markRead.mutate('all')
  const dismissAll  = () => dismiss.mutate('all')

  return {
    notifications: query.data?.notifications ?? [],
    total:         query.data?.total ?? 0,
    unread:        query.data?.unread ?? 0,
    isLoading:     query.isLoading,
    markRead:      (id: string) => markRead.mutate(id),
    dismiss:       (id: string) => dismiss.mutate(id),
    markAllRead,
    dismissAll,
  }
}
