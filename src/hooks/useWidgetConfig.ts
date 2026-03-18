import { useState, useCallback } from 'react'

export type WidgetId =
  | 'quickStats'
  | 'siteStatus'
  | 'systemResources'
  | 'recentPosts'
  | 'quickActions'
  | 'recentAudit'
  | 'cacheStatus'
  | 'uptime'

export interface WidgetMeta {
  id: WidgetId
  label: string
  description: string
}

export const WIDGET_META: WidgetMeta[] = [
  { id: 'quickStats',       label: 'Quick Stats',        description: 'Posts, pages, plugins, themes, users, DB size' },
  { id: 'siteStatus',       label: 'Site Status',        description: 'WordPress, PHP, theme, debug & maintenance state' },
  { id: 'systemResources',  label: 'System Resources',   description: 'Memory, upload limit, exec time, DB & upload sizes' },
  { id: 'recentPosts',      label: 'Recent Posts',       description: 'Latest published posts with links' },
  { id: 'uptime',           label: 'Uptime Ping',        description: 'Live reachability check of the site front-end' },
  { id: 'recentAudit',      label: 'Recent Audit Events',description: 'Last 5 entries from the Audit Log' },
  { id: 'cacheStatus',      label: 'Cache Status',       description: 'Object cache hit ratio and transient count' },
  { id: 'quickActions',     label: 'Quick Actions',      description: 'One-click navigation to key pages' },
]

type WidgetConfig = Record<WidgetId, boolean>

const STORAGE_KEY = 'wmp-dashboard-widgets'

const DEFAULT: WidgetConfig = {
  quickStats:      true,
  siteStatus:      true,
  systemResources: true,
  recentPosts:     true,
  quickActions:    true,
  recentAudit:     true,
  cacheStatus:     true,
  uptime:          true,
}

function load(): WidgetConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT
    const parsed = JSON.parse(raw) as Partial<WidgetConfig>
    // Merge so new widgets default to true
    return { ...DEFAULT, ...parsed }
  } catch {
    return DEFAULT
  }
}

export function useWidgetConfig() {
  const [config, setConfig] = useState<WidgetConfig>(load)

  const toggle = useCallback((id: WidgetId) => {
    setConfig(prev => {
      const next = { ...prev, [id]: !prev[id] }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const isVisible = useCallback((id: WidgetId) => config[id], [config])

  return { config, toggle, isVisible }
}
