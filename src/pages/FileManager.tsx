import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { AlertTriangle } from 'lucide-react'

// elFinder ships as a jQuery plugin loaded globally by WordPress (see
// class-admin.php enqueue_assets). It is not an ES module, so we reach it through
// the window-scoped jQuery rather than importing it.
/* eslint-disable @typescript-eslint/no-explicit-any */

export function FileManager() {
  const hostRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const w = window as any
    const $ = w.jQuery
    const cfg = w.wpManagerPro?.elfinder

    if (!cfg) {
      setError('File Manager configuration is missing.')
      return
    }
    if (!$ || !$.fn || !$.fn.elfinder) {
      setError('elFinder failed to load. Try a hard refresh (Cmd/Ctrl+Shift+R).')
      return
    }
    if (!hostRef.current) return

    const nonce: string = w.wpManagerPro.nonce

    // elFinder needs an explicit pixel height; fill the viewport below the header.
    const calcHeight = () => {
      const top = hostRef.current?.getBoundingClientRect().top ?? 120
      return Math.max(420, Math.floor(window.innerHeight - top - 16))
    }

    const instance = $(hostRef.current).elfinder({
      url: cfg.connectorUrl,
      baseUrl: cfg.baseUrl,
      lang: cfg.lang || 'en',
      // Authenticate every connector request with the WordPress REST nonce.
      // customHeaders covers XHR calls; customData covers GET file/quicklook
      // links that elFinder builds as plain URLs (no custom headers possible).
      customHeaders: { 'X-WP-Nonce': nonce },
      customData: { _wpnonce: nonce },
      height: calcHeight(),
      resizable: false,
      rememberLastDir: true,
      commandsOptions: {
        // No cloud volumes are mounted; hide the net-mount dialog entirely.
        netmount: { drivers: [] },
      },
    }).elfinder('instance')

    instanceRef.current = instance

    const onResize = () => {
      if (instanceRef.current) instanceRef.current.resize('100%', calcHeight())
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      try {
        instanceRef.current?.destroy?.()
      } catch {
        /* elFinder already torn down */
      }
      instanceRef.current = null
    }
  }, [])

  return (
    <div className="fade-in h-full flex flex-col">
      <PageHeader
        title="File Manager"
        description="Browse, edit, upload, archive and manage every file under your WordPress root"
      />

      {error ? (
        <div className="flex items-start gap-3 m-4 p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">File Manager could not start</p>
            <p className="text-amber-700">{error}</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 px-2 pb-2">
          {/* elFinder mounts its full UI inside this node. */}
          <div ref={hostRef} className="h-full" />
        </div>
      )}
    </div>
  )
}
