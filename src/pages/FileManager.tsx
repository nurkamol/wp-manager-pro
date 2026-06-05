import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

// The File Manager is powered by elFinder. It runs inside an isolated iframe
// (served by the wmp_elfinder_host admin-ajax handler) so the app's global
// Tailwind/WP-admin CSS resets can't bleed in and break elFinder's jQuery-UI
// styling. See includes/api/controllers/class-elfinder-controller.php::host().
export function FileManager() {
  const hostUrl = window.wpManagerPro?.elfinder?.hostUrl
  const [loaded, setLoaded] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)

  // If the iframe is blocked entirely (CSP / X-Frame-Options / proxy) the host
  // document never loads, so `onLoad` never fires. Surface a fallback after a
  // grace period rather than leaving the user staring at a blank panel (#5).
  useEffect(() => {
    if (!hostUrl) return
    const t = setTimeout(() => setTimedOut(true), 8000)
    return () => clearTimeout(t)
  }, [hostUrl])

  if (!hostUrl) {
    return (
      <div className="fade-in h-full flex flex-col">
        <PageHeader title="File Manager" description="Browse, edit, upload, archive and manage every file under your WordPress root" />
        <ErrorPanel message="Configuration is missing. Try a hard refresh (Cmd/Ctrl+Shift+R)." />
      </div>
    )
  }

  const showFallback = timedOut && !loaded

  return (
    <div className="fade-in h-full flex flex-col">
      <PageHeader
        title="File Manager"
        description="Browse, edit, upload, archive and manage every file under your WordPress root"
      />

      <div className="flex-1 min-h-0 px-2 pb-2 relative">
        {showFallback && (
          <ErrorPanel
            message="The File Manager frame didn't load. A reverse proxy, security plugin, or Content-Security-Policy may be blocking it on this host."
            action={
              <Button asChild variant="outline" size="sm">
                <a href={hostUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" /> Open File Manager in a new tab
                </a>
              </Button>
            }
          />
        )}
        <iframe
          ref={frameRef}
          src={hostUrl}
          title="File Manager"
          onLoad={() => setLoaded(true)}
          className={`w-full h-full rounded-lg border border-slate-200 bg-white ${showFallback ? 'hidden' : ''}`}
        />
      </div>
    </div>
  )
}

function ErrorPanel({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 m-4 p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm">
      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="space-y-2">
        <div>
          <p className="font-medium">File Manager couldn't load</p>
          <p className="text-amber-700">{message}</p>
        </div>
        {action}
      </div>
    </div>
  )
}
