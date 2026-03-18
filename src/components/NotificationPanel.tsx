import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, X, CheckCheck, Trash2, RefreshCw, ShieldAlert, Clock, HardDrive, Lock, Globe, Info, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/useNotifications'
import type { NotificationType } from '@/hooks/useNotifications'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDistanceToNow } from 'date-fns'

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function typeIcon(type: NotificationType) {
  const cls = 'w-4 h-4 shrink-0'
  switch (type) {
    case 'update_available': return <RefreshCw className={cn(cls, 'text-blue-400')} />
    case 'backup_error':     return <HardDrive  className={cn(cls, 'text-red-400')} />
    case 'lockout':          return <Lock       className={cn(cls, 'text-orange-400')} />
    case 'update_failed':    return <RefreshCw  className={cn(cls, 'text-red-400')} />
    case 'ssl_expiry':       return <Globe      className={cn(cls, 'text-yellow-400')} />
    case 'vulnerability':    return <ShieldAlert className={cn(cls, 'text-red-400')} />
    case 'warning':          return <AlertTriangle className={cn(cls, 'text-yellow-400')} />
    case 'success':          return <CheckCircle2  className={cn(cls, 'text-green-400')} />
    default:                 return <Info       className={cn(cls, 'text-slate-400')} />
  }
}

function typeDot(type: NotificationType) {
  switch (type) {
    case 'update_available': return 'bg-blue-500'
    case 'backup_error':
    case 'update_failed':
    case 'vulnerability':    return 'bg-red-500'
    case 'lockout':          return 'bg-orange-500'
    case 'ssl_expiry':
    case 'warning':          return 'bg-yellow-500'
    case 'success':          return 'bg-green-500'
    default:                 return 'bg-slate-500'
  }
}

function hashToRoute(link: string): string {
  // "#/cron" → "/cron"
  return link.replace(/^#/, '')
}

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return ''
  }
}

// -------------------------------------------------------------------------
// Bell button (exported for use in Sidebar)
// -------------------------------------------------------------------------

interface NotificationBellProps {
  collapsed?: boolean
}

export function NotificationBell({ collapsed = false }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const { notifications, unread, markRead, dismiss, markAllRead, dismissAll, isLoading } = useNotifications()
  const navigate = useNavigate()

  const handleClick = (link: string, id: string) => {
    markRead(id)
    if (link) {
      navigate(hashToRoute(link))
      setOpen(false)
    }
  }

  const bell = (
    <button
      onClick={() => setOpen(true)}
      className={cn(
        'relative p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors',
        collapsed && 'p-2'
      )}
      aria-label="Notifications"
    >
      <Bell className={cn(collapsed ? 'w-4 h-4' : 'w-3.5 h-3.5')} />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{bell}</TooltipTrigger>
            <TooltipContent side="right">Notifications{unread > 0 ? ` (${unread})` : ''}</TooltipContent>
          </Tooltip>
        ) : bell}
      </SheetTrigger>

      <SheetContent side="right" className="w-[380px] sm:w-[420px] flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Bell className="w-4 h-4" />
              Notifications
              {unread > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                  {unread}
                </span>
              )}
            </SheetTitle>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={markAllRead}>
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </Button>
              )}
              {notifications.length > 0 && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive" onClick={dismissAll}>
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear all
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Loading…
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 text-green-500/50" />
              <p className="text-sm">All clear — no notifications</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    'flex gap-3 px-4 py-3 group transition-colors',
                    !n.read ? 'bg-muted/40' : 'hover:bg-muted/20',
                    n.link && 'cursor-pointer'
                  )}
                  onClick={() => n.link && handleClick(n.link, n.id)}
                >
                  {/* Unread dot */}
                  <div className="flex flex-col items-center gap-1 pt-1 shrink-0">
                    {!n.read && (
                      <span className={cn('w-2 h-2 rounded-full shrink-0', typeDot(n.type))} />
                    )}
                    {n.read && <span className="w-2 h-2 shrink-0" />}
                  </div>

                  {/* Icon */}
                  <div className="pt-0.5 shrink-0">{typeIcon(n.type)}</div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium leading-snug', n.read && 'text-muted-foreground')}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                      {timeAgo(n.created_at)}
                    </p>
                  </div>

                  {/* Dismiss */}
                  <button
                    onClick={(e) => { e.stopPropagation(); dismiss(n.id) }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all text-muted-foreground hover:text-foreground shrink-0 self-start mt-0.5"
                    aria-label="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
