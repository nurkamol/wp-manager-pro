import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Search, UserCheck, LogIn, Trash2, RefreshCw, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface User {
  id: number
  login: string
  email: string
  display_name: string
  registered: string
  roles: string[]
  avatar: string
  is_current: boolean
  post_count: number
  admin_url: string
}

interface UsersData {
  users: User[]
  total: number
  roles: Array<{ key: string; name: string }>
}

const roleColors: Record<string, string> = {
  administrator: 'destructive',
  editor: 'default',
  author: 'info',
  contributor: 'secondary',
  subscriber: 'outline',
}

export function Users() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [changeRoleUser, setChangeRoleUser] = useState<User | null>(null)
  const [newRole, setNewRole] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)

  const { data, isLoading } = useQuery<UsersData>({
    queryKey: ['users', searchQuery, roleFilter],
    queryFn: () => api.get(`/users?search=${encodeURIComponent(searchQuery)}&role=${roleFilter}&limit=50`),
  })

  const changeRoleMutation = useMutation({
    mutationFn: ({ user_id, role }: { user_id: number; role: string }) =>
      api.post('/users/change-role', { user_id, role }),
    onSuccess: () => {
      toast.success('User role changed successfully')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setChangeRoleUser(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const loginAsMutation = useMutation({
    mutationFn: (user_id: number) => api.post<{ login_url: string }>('/users/login-as', { user_id }),
    onSuccess: (data) => {
      toast.success('Redirecting to login...')
      window.location.href = data.login_url
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (user_id: number) => api.delete('/users/delete', { user_id }),
    onSuccess: () => {
      toast.success('User deleted')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeleteTarget(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) return <PageLoader text="Loading users..." />

  return (
    <div className="fade-in">
      <PageHeader
        title="User Manager"
        description={`${data?.total || 0} users`}
      />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setSearchQuery(search)}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter || 'all'} onValueChange={v => setRoleFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {data?.roles.map(role => (
                <SelectItem key={role.key} value={role.key}>{role.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => { setSearchQuery(search) }}>
            <Search className="w-4 h-4" /> Search
          </Button>
        </div>

        {/* Users Table */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">User</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Role</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Registered</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Posts</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.users.map(user => (
                <tr key={user.id} className={`border-b hover:bg-slate-50 ${user.is_current ? 'bg-blue-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={user.avatar}
                        alt={user.display_name}
                        className="w-8 h-8 rounded-full border"
                      />
                      <div>
                        <p className="font-medium text-slate-900">{user.display_name}</p>
                        <p className="text-xs text-slate-400">{user.login}</p>
                      </div>
                      {user.is_current && (
                        <Badge variant="info" className="text-[10px]">You</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3">
                    {user.roles.map(role => (
                      <Badge key={role} variant={(roleColors[role] as any) || 'secondary'} className="text-[10px] capitalize">
                        {role}
                      </Badge>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(user.registered)}</td>
                  <td className="px-4 py-3 text-slate-600">{user.post_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setChangeRoleUser(user); setNewRole(user.roles[0] || '') }}
                        className="h-7 text-xs"
                        disabled={user.is_current}
                      >
                        <UserCheck className="w-3 h-3" />
                        Role
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loginAsMutation.mutate(user.id)}
                        className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        disabled={user.is_current || loginAsMutation.isPending}
                      >
                        <LogIn className="w-3 h-3" />
                        Login as
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(user)}
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                        disabled={user.is_current}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data?.users.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No users found</p>
            </div>
          )}
        </div>
      </div>

      {/* Change Role Dialog */}
      <Dialog open={!!changeRoleUser} onOpenChange={() => setChangeRoleUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Change the role for <strong>{changeRoleUser?.display_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <Select value={newRole} onValueChange={setNewRole}>
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {data?.roles.map(role => (
                <SelectItem key={role.key} value={role.key}>{role.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeRoleUser(null)}>Cancel</Button>
            <Button
              onClick={() => changeRoleUser && changeRoleMutation.mutate({ user_id: changeRoleUser.id, role: newRole })}
              disabled={!newRole || changeRoleMutation.isPending}
            >
              {changeRoleMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              Change Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" /> Delete User
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.display_name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
