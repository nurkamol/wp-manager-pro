import { useState, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatBytes, getFileIcon } from '@/lib/utils'
import {
  FolderOpen, File, ChevronRight, Home, Save, X, Trash2,
  RefreshCw, AlertTriangle, FolderPlus, ArrowLeft, Upload, Pencil
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Editor from '@monaco-editor/react'

interface FileItem {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number | null
  modified: number
  writable: boolean
  ext: string | null
}

interface FileListData {
  path: string
  items: FileItem[]
  breadcrumbs: Array<{ name: string; path: string }>
  writable: boolean
}

function getMonacoLang(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'php': return 'php'
    case 'js':
    case 'jsx': return 'javascript'
    case 'ts':
    case 'tsx': return 'typescript'
    case 'css':
    case 'scss': return 'css'
    case 'html':
    case 'htm': return 'html'
    case 'json': return 'json'
    case 'xml': return 'xml'
    case 'md': return 'markdown'
    case 'yml':
    case 'yaml': return 'yaml'
    case 'svg': return 'xml'
    default: return 'plaintext'
  }
}

export function FileManager() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [currentPath, setCurrentPath] = useState('')
  const [editingFile, setEditingFile] = useState<{ path: string; name: string; content: string; ext: string } | null>(null)
  const [editContent, setEditContent] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null)
  const [newDirName, setNewDirName] = useState('')
  const [showNewDir, setShowNewDir] = useState(false)
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null)
  const [newName, setNewName] = useState('')

  const { data: fileData, isLoading, refetch } = useQuery<FileListData>({
    queryKey: ['files', currentPath],
    queryFn: () => api.get(`/files?path=${encodeURIComponent(currentPath)}`),
  })

  const readFileMutation = useMutation({
    mutationFn: (path: string) => api.get<{ path: string; name: string; content: string; ext: string }>(`/files/read?path=${encodeURIComponent(path)}`),
    onSuccess: (data) => {
      setEditingFile(data)
      setEditContent(data.content)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const saveFileMutation = useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      api.post('/files/write', { path, content }),
    onSuccess: () => {
      toast.success('File saved successfully')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteFileMutation = useMutation({
    mutationFn: (path: string) => api.delete('/files/delete', { path }),
    onSuccess: () => {
      toast.success('Deleted successfully')
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['files', currentPath] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const mkdirMutation = useMutation({
    mutationFn: (name: string) => api.post('/files/mkdir', { path: `${fileData?.path}/${name}` }),
    onSuccess: () => {
      toast.success('Directory created')
      setShowNewDir(false)
      setNewDirName('')
      queryClient.invalidateQueries({ queryKey: ['files', currentPath] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const uploadMutation = useMutation({
    mutationFn: (fd: FormData) => api.upload('/files/upload', fd),
    onSuccess: () => {
      toast.success('File uploaded successfully')
      queryClient.invalidateQueries({ queryKey: ['files', currentPath] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const renameMutation = useMutation({
    mutationFn: ({ path, name }: { path: string; name: string }) =>
      api.post('/files/rename', { path, name }),
    onSuccess: () => {
      toast.success('Renamed successfully')
      setRenameTarget(null)
      setNewName('')
      queryClient.invalidateQueries({ queryKey: ['files', currentPath] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleItemClick = useCallback((item: FileItem) => {
    if (item.type === 'directory') {
      setCurrentPath(item.path)
    } else {
      readFileMutation.mutate(item.path)
    }
  }, [readFileMutation])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('path', fileData?.path || '')
    uploadMutation.mutate(fd)
    // Reset input so same file can be re-uploaded
    e.target.value = ''
  }

  if (isLoading && !fileData) return <PageLoader text="Loading files..." />

  return (
    <div className="fade-in h-full flex flex-col">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileUpload}
      />

      <PageHeader
        title="File Manager"
        description="Browse and edit WordPress files"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload File
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowNewDir(true)}>
              <FolderPlus className="w-4 h-4" /> New Folder
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* File Browser Panel */}
        <div className={`${editingFile ? 'w-80' : 'flex-1'} flex flex-col border-r bg-white transition-all duration-200`}>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 px-4 py-2 border-b bg-slate-50 text-sm overflow-x-auto">
            <button
              onClick={() => setCurrentPath('')}
              className="text-blue-600 hover:text-blue-800 shrink-0 flex items-center gap-1"
            >
              <Home className="w-3.5 h-3.5" />
            </button>
            {fileData?.breadcrumbs.slice(1).map((crumb, i) => (
              <span key={i} className="flex items-center gap-1 shrink-0">
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <button
                  onClick={() => setCurrentPath(crumb.path)}
                  className="text-blue-600 hover:text-blue-800 truncate max-w-[100px]"
                  title={crumb.path}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>

          {/* Go up */}
          {fileData?.breadcrumbs && fileData.breadcrumbs.length > 1 && (
            <button
              onClick={() => {
                const crumbs = fileData.breadcrumbs
                if (crumbs.length >= 2) {
                  setCurrentPath(crumbs[crumbs.length - 2].path)
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 border-b"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              ..
            </button>
          )}

          {/* File list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
              </div>
            ) : (
              <div>
                {/* New directory input */}
                {showNewDir && (
                  <div className="flex items-center gap-2 px-4 py-2 border-b bg-blue-50">
                    <FolderOpen className="w-4 h-4 text-blue-500" />
                    <Input
                      autoFocus
                      placeholder="Directory name"
                      value={newDirName}
                      onChange={e => setNewDirName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newDirName) mkdirMutation.mutate(newDirName)
                        if (e.key === 'Escape') { setShowNewDir(false); setNewDirName('') }
                      }}
                      className="h-7 text-sm"
                    />
                    <Button size="sm" className="h-7 px-2" onClick={() => mkdirMutation.mutate(newDirName)} disabled={!newDirName}>
                      <Save className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { setShowNewDir(false); setNewDirName('') }}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}

                {fileData?.items.map((item) => (
                  <div
                    key={item.path}
                    className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 group"
                    onClick={() => handleItemClick(item)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base shrink-0">
                        {item.type === 'directory'
                          ? '📁'
                          : getFileIcon(item.ext || '')}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-700 truncate">{item.name}</p>
                        {item.type === 'file' && item.size !== null && (
                          <p className="text-[10px] text-slate-400">{formatBytes(item.size)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {!item.writable && (
                        <Badge variant="secondary" className="text-[10px]">Read-only</Badge>
                      )}
                      {item.type === 'directory' && (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setRenameTarget(item)
                          setNewName(item.name)
                        }}
                        className="text-slate-400 hover:text-blue-600 p-1 rounded"
                        title="Rename"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(item) }}
                        className="text-red-400 hover:text-red-600 p-1 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}

                {fileData?.items.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    Empty directory
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Monaco Editor Panel */}
        {editingFile && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-slate-800 text-white">
              <div className="flex items-center gap-2">
                <File className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-mono">{editingFile.name}</span>
                <Badge variant="secondary" className="text-[10px] bg-slate-700 text-slate-300 border-0">
                  {editingFile.ext || 'txt'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => saveFileMutation.mutate({ path: editingFile.path, content: editContent })}
                  disabled={saveFileMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 h-7"
                >
                  {saveFileMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </Button>
                <button
                  onClick={() => setEditingFile(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="relative flex-1 overflow-hidden bg-slate-900">
              <Editor
                height="100%"
                language={getMonacoLang(editingFile.ext || '')}
                theme="vs-dark"
                value={editContent}
                onChange={(v) => setEditContent(v || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>
            <div className="px-4 py-1.5 bg-slate-800 border-t border-slate-700 text-xs text-slate-400 flex items-center justify-between">
              <span className="font-mono">{editingFile.path}</span>
              <span>{editContent.split('\n').length} lines</span>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" /> Delete {deleteTarget?.type === 'directory' ? 'Directory' : 'File'}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
              {deleteTarget?.type === 'directory' && ' This will delete all contents inside.'}
              {' '}This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteFileMutation.mutate(deleteTarget.path)}
              disabled={deleteFileMutation.isPending}
            >
              {deleteFileMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={() => { setRenameTarget(null); setNewName('') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" /> Rename {renameTarget?.type === 'directory' ? 'Folder' : 'File'}
            </DialogTitle>
            <DialogDescription>
              Enter a new name for <strong>{renameTarget?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newName && renameTarget) {
                renameMutation.mutate({ path: renameTarget.path, name: newName })
              }
              if (e.key === 'Escape') { setRenameTarget(null); setNewName('') }
            }}
            placeholder="New name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRenameTarget(null); setNewName('') }}>Cancel</Button>
            <Button
              onClick={() => renameTarget && renameMutation.mutate({ path: renameTarget.path, name: newName })}
              disabled={!newName || renameMutation.isPending || newName === renameTarget?.name}
            >
              {renameMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
