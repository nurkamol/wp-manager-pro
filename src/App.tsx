import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Plugins } from './pages/Plugins'
import { Themes } from './pages/Themes'
import { FileManager } from './pages/FileManager'
import { Database } from './pages/Database'
import { Users } from './pages/Users'
import { Maintenance } from './pages/Maintenance'
import { Debug } from './pages/Debug'
import { SystemInfo } from './pages/SystemInfo'
import { Notes } from './pages/Notes'
import { ImageTools } from './pages/ImageTools'
import { Reset } from './pages/Reset'
import { Security } from './pages/Security'
import { AuditLog } from './pages/AuditLog'
import { Snippets } from './pages/Snippets'
import { Redirects } from './pages/Redirects'
import { Email } from './pages/Email'
import { Backup } from './pages/Backup'
import { Settings } from './pages/Settings'
import { Performance } from './pages/Performance'
import { Cron } from './pages/Cron'
import { MediaManager } from './pages/MediaManager'
import { ContentTools } from './pages/ContentTools'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 10000,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="plugins" element={<Plugins />} />
            <Route path="themes" element={<Themes />} />
            <Route path="file-manager" element={<FileManager />} />
            <Route path="database" element={<Database />} />
            <Route path="users" element={<Users />} />
            <Route path="maintenance" element={<Maintenance />} />
            <Route path="debug" element={<Debug />} />
            <Route path="images" element={<ImageTools />} />
            <Route path="notes" element={<Notes />} />
            <Route path="system" element={<SystemInfo />} />
            <Route path="reset" element={<Reset />} />
            <Route path="security" element={<Security />} />
            <Route path="audit-log" element={<AuditLog />} />
            <Route path="snippets" element={<Snippets />} />
            <Route path="redirects" element={<Redirects />} />
            <Route path="email" element={<Email />} />
            <Route path="backup" element={<Backup />} />
            <Route path="settings" element={<Settings />} />
            <Route path="performance" element={<Performance />} />
            <Route path="cron" element={<Cron />} />
            <Route path="media-manager" element={<MediaManager />} />
            <Route path="content-tools" element={<ContentTools />} />
          </Route>
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  )
}
