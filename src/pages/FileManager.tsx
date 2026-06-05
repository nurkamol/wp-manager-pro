import { PageHeader } from '@/components/PageHeader'
import { AlertTriangle } from 'lucide-react'

// The File Manager is powered by elFinder. It runs inside an isolated iframe
// (served by the wmp_elfinder_host admin-ajax handler) so the app's global
// Tailwind/WP-admin CSS resets can't bleed in and break elFinder's jQuery-UI
// styling. See includes/api/controllers/class-elfinder-controller.php::host().
export function FileManager() {
  const hostUrl = window.wpManagerPro?.elfinder?.hostUrl

  return (
    <div className="fade-in h-full flex flex-col">
      <PageHeader
        title="File Manager"
        description="Browse, edit, upload, archive and manage every file under your WordPress root"
      />

      {hostUrl ? (
        <div className="flex-1 min-h-0 px-2 pb-2">
          <iframe
            src={hostUrl}
            title="File Manager"
            className="w-full h-full rounded-lg border border-slate-200 bg-white"
          />
        </div>
      ) : (
        <div className="flex items-start gap-3 m-4 p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">File Manager could not start</p>
            <p className="text-amber-700">Configuration is missing. Try a hard refresh (Cmd/Ctrl+Shift+R).</p>
          </div>
        </div>
      )}
    </div>
  )
}
