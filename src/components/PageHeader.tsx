import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  className?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, description, className, actions }: PageHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between px-6 py-5 border-b bg-white', className)}>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
