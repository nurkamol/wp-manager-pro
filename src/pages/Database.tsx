import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { PageLoader } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
  Database as DatabaseIcon, RefreshCw, Search, Play, ArrowRight,
  CheckCircle2, AlertTriangle, Zap, Pencil, Trash2, Plus,
  Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react'

interface Table {
  name: string
  rows: number
  size_mb: string
  engine: string
  collation: string
  is_wp: boolean
}

interface ColMeta {
  type: string
  null: boolean
  key: string
  default: string | null
  extra: string
}

interface TableData {
  table: string
  columns: string[]
  col_meta: Record<string, ColMeta>
  primary_key: string
  rows: Record<string, string | null>[]
  total: number
  page: number
  limit: number
  pages: number
}

interface SearchReplaceResult {
  success: boolean
  dry_run: boolean
  total: number
  results: Array<{ table: string; count: number }>
  message: string
}

const PAGE_SIZES = [50, 100, 250, 500]

export function Database() {
  const queryClient = useQueryClient()

  // Table browser state
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(50)

  // Edit / Add dialog state
  const [editRow, setEditRow] = useState<Record<string, string | null> | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [isAdding, setIsAdding] = useState(false)
  const [addValues, setAddValues] = useState<Record<string, string>>({})
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null) // primary value pending delete

  // Search & Replace
  const [searchStr, setSearchStr] = useState('')
  const [replaceStr, setReplaceStr] = useState('')
  const [dryRun, setDryRun] = useState(true)
  const [caseInsensitive, setCaseInsensitive] = useState(false)
  const [srResult, setSrResult] = useState<SearchReplaceResult | null>(null)

  // SQL
  const [sql, setSql] = useState('SELECT * FROM wp_options LIMIT 10')
  const [queryResult, setQueryResult] = useState<{ columns: string[]; rows: Record<string, unknown>[]; count: number } | null>(null)

  // Reset page when table or perPage changes
  useEffect(() => { setPage(1) }, [selectedTable, perPage])

  const { data: tablesData, isLoading: tablesLoading } = useQuery({
    queryKey: ['db-tables'],
    queryFn: () => api.get<{ tables: Table[]; total: number; total_size: number; prefix: string }>('/database/tables'),
  })

  const { data: tableData, isLoading: tableDataLoading, refetch: refetchTableData } = useQuery({
    queryKey: ['db-table-data', selectedTable, page, perPage],
    queryFn: () => api.get<TableData>(`/database/table-data?table=${selectedTable}&page=${page}&limit=${perPage}`),
    enabled: !!selectedTable,
  })

  const updateRowMutation = useMutation({
    mutationFn: (vars: { primary_value: string; data: Record<string, string> }) =>
      api.put('/database/row', {
        table: selectedTable,
        primary_key: tableData?.primary_key,
        primary_value: vars.primary_value,
        data: vars.data,
      }),
    onSuccess: () => {
      toast.success('Row updated')
      setEditRow(null)
      queryClient.invalidateQueries({ queryKey: ['db-table-data', selectedTable, page, perPage] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteRowMutation = useMutation({
    mutationFn: (primaryValue: string) =>
      api.delete('/database/row', {
        table: selectedTable,
        primary_key: tableData?.primary_key,
        primary_value: primaryValue,
      }),
    onSuccess: () => {
      toast.success('Row deleted')
      setDeleteConfirm(null)
      queryClient.invalidateQueries({ queryKey: ['db-table-data', selectedTable, page, perPage] })
      queryClient.invalidateQueries({ queryKey: ['db-tables'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const insertRowMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      api.post('/database/row', { table: selectedTable, data }),
    onSuccess: () => {
      toast.success('Row inserted')
      setIsAdding(false)
      setAddValues({})
      queryClient.invalidateQueries({ queryKey: ['db-table-data', selectedTable, page, perPage] })
      queryClient.invalidateQueries({ queryKey: ['db-tables'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const searchReplaceMutation = useMutation({
    mutationFn: (data: { search: string; replace: string; dry_run: boolean; case_insensitive: boolean }) =>
      api.post<SearchReplaceResult>('/database/search-replace', data),
    onSuccess: (data) => {
      setSrResult(data)
      toast[data.dry_run ? 'info' : 'success'](data.message)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const optimizeMutation = useMutation({
    mutationFn: () => api.post('/database/optimize', {}),
    onSuccess: () => toast.success('All tables optimized successfully'),
    onError: (err: Error) => toast.error(err.message),
  })

  const queryMutation = useMutation({
    mutationFn: (sqlQuery: string) =>
      api.post<{ columns: string[]; rows: Record<string, unknown>[]; count: number }>('/database/query', { sql: sqlQuery }),
    onSuccess: (data) => setQueryResult(data),
    onError: (err: Error) => toast.error(err.message),
  })

  const exportTable = () => {
    if (!selectedTable) return
    const url = `${(window as any).wpManagerPro?.apiUrl}/database/export?table=${selectedTable}&_wpnonce=${(window as any).wpManagerPro?.nonce}`
    window.open(url, '_blank')
  }

  const openEdit = (row: Record<string, string | null>) => {
    setEditRow(row)
    const vals: Record<string, string> = {}
    for (const k in row) vals[k] = row[k] ?? ''
    setEditValues(vals)
  }

  const openAdd = () => {
    const vals: Record<string, string> = {}
    tableData?.columns.forEach(col => { vals[col] = '' })
    setAddValues(vals)
    setIsAdding(true)
  }

  const primaryKey = tableData?.primary_key || ''

  // Pagination helpers
  const totalPages = tableData?.pages || 1
  const rowStart = tableData ? (page - 1) * perPage + 1 : 0
  const rowEnd = tableData ? Math.min(page * perPage, tableData.total) : 0

  if (tablesLoading) return <PageLoader text="Loading database tables..." />

  return (
    <div className="fade-in">
      <PageHeader
        title="Database Manager"
        description={`${tablesData?.total || 0} tables · ${tablesData?.total_size} MB`}
        actions={
          <Button variant="outline" size="sm" onClick={() => optimizeMutation.mutate()} disabled={optimizeMutation.isPending}>
            <Zap className="w-4 h-4" />
            {optimizeMutation.isPending ? 'Optimizing...' : 'Optimize All'}
          </Button>
        }
      />

      <div className="p-6">
        <Tabs defaultValue="tables">
          <TabsList className="mb-4">
            <TabsTrigger value="tables">Tables</TabsTrigger>
            <TabsTrigger value="search-replace">Search & Replace</TabsTrigger>
            <TabsTrigger value="query">SQL Query</TabsTrigger>
          </TabsList>

          {/* ─── Tables Tab ─────────────────────────────────────────── */}
          <TabsContent value="tables" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

              {/* Table List */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Tables ({tablesData?.total})</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[600px]">
                      {tablesData?.tables.map(table => (
                        <button
                          key={table.name}
                          onClick={() => setSelectedTable(table.name)}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-50 dark:border-slate-800 transition-colors ${
                            selectedTable === table.name
                              ? 'bg-blue-50 dark:bg-blue-950/40 border-l-2 border-l-blue-500'
                              : ''
                          }`}
                        >
                          <div className="min-w-0">
                            <p className={`text-sm font-mono truncate ${table.is_wp ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500'}`}>
                              {table.name}
                            </p>
                            <p className="text-[10px] text-slate-400">{parseInt(String(table.rows || '0'), 10).toLocaleString()} rows</p>
                          </div>
                          <div className="flex items-center gap-1 ml-2 shrink-0">
                            <span className="text-[10px] text-slate-400">{table.size_mb}MB</span>
                            {selectedTable === table.name && <ArrowRight className="w-3 h-3 text-blue-500" />}
                          </div>
                        </button>
                      ))}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Table Data */}
              <div className="lg:col-span-3">
                {selectedTable ? (
                  <Card>
                    {/* Header toolbar */}
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <CardTitle className="text-sm font-mono">{selectedTable}</CardTitle>
                          <CardDescription className="text-xs">
                            {tableData?.total?.toLocaleString()} rows total
                            {tableData && ` · showing ${rowStart}–${rowEnd}`}
                            {primaryKey && ` · PK: ${primaryKey}`}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Per-page selector */}
                          <Select
                            value={String(perPage)}
                            onValueChange={v => setPerPage(Number(v))}
                          >
                            <SelectTrigger className="h-8 w-[90px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PAGE_SIZES.map(n => (
                                <SelectItem key={n} value={String(n)} className="text-xs">{n} rows</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={() => refetchTableData()}>
                            <RefreshCw className="w-3.5 h-3.5" />
                          </Button>
                          {primaryKey && (
                            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={openAdd}>
                              <Plus className="w-3.5 h-3.5" />
                              Add Row
                            </Button>
                          )}
                          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={exportTable}>
                            <Download className="w-3.5 h-3.5" />
                            Export SQL
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-0">
                      {tableDataLoading ? (
                        <div className="flex items-center justify-center py-16">
                          <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                        </div>
                      ) : (
                        <>
                          {/* Table */}
                          <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                                <tr>
                                  {primaryKey && (
                                    <th className="px-3 py-2 text-left font-semibold text-slate-500 border-b dark:border-slate-700 w-[72px] shrink-0">
                                      Actions
                                    </th>
                                  )}
                                  {tableData?.columns.map(col => (
                                    <th
                                      key={col}
                                      className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200 border-b dark:border-slate-700 whitespace-nowrap"
                                    >
                                      <span>{col}</span>
                                      {col === primaryKey && (
                                        <Badge variant="secondary" className="ml-1.5 text-[9px] px-1 py-0">PK</Badge>
                                      )}
                                      {tableData.col_meta?.[col]?.type && (
                                        <span className="ml-1 font-normal text-slate-400 text-[9px]">
                                          {tableData.col_meta[col].type}
                                        </span>
                                      )}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {tableData?.rows.map((row, i) => {
                                  const pkVal = primaryKey ? String(row[primaryKey] ?? '') : ''
                                  return (
                                    <tr
                                      key={i}
                                      className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 group"
                                    >
                                      {primaryKey && (
                                        <td className="px-2 py-1.5 whitespace-nowrap">
                                          {deleteConfirm === pkVal ? (
                                            <div className="flex items-center gap-1">
                                              <Button
                                                size="sm"
                                                variant="destructive"
                                                className="h-6 px-2 text-[10px]"
                                                onClick={() => deleteRowMutation.mutate(pkVal)}
                                                disabled={deleteRowMutation.isPending}
                                              >
                                                {deleteRowMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Confirm'}
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 px-1.5 text-[10px]"
                                                onClick={() => setDeleteConfirm(null)}
                                              >
                                                ✕
                                              </Button>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                                onClick={() => openEdit(row)}
                                              >
                                                <Pencil className="w-3 h-3" />
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                onClick={() => setDeleteConfirm(pkVal)}
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          )}
                                        </td>
                                      )}
                                      {tableData?.columns.map(col => (
                                        <td key={col} className="px-3 py-1.5 text-slate-600 dark:text-slate-300 max-w-[220px]">
                                          {row[col] === null ? (
                                            <span className="text-slate-300 dark:text-slate-600 italic">NULL</span>
                                          ) : (
                                            <span className="block truncate" title={String(row[col])}>
                                              {String(row[col])}
                                            </span>
                                          )}
                                        </td>
                                      ))}
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Pagination footer */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                              <span className="text-xs text-slate-500">
                                {rowStart.toLocaleString()}–{rowEnd.toLocaleString()} of {tableData?.total.toLocaleString()} rows
                              </span>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline" size="sm" className="h-7 w-7 p-0"
                                  onClick={() => setPage(1)} disabled={page <= 1}
                                >
                                  <ChevronsLeft className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="outline" size="sm" className="h-7 w-7 p-0"
                                  onClick={() => setPage(p => p - 1)} disabled={page <= 1}
                                >
                                  <ChevronLeft className="w-3.5 h-3.5" />
                                </Button>
                                <span className="text-xs px-2 text-slate-600 dark:text-slate-300 min-w-[70px] text-center">
                                  {page} / {totalPages}
                                </span>
                                <Button
                                  variant="outline" size="sm" className="h-7 w-7 p-0"
                                  onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="outline" size="sm" className="h-7 w-7 p-0"
                                  onClick={() => setPage(totalPages)} disabled={page >= totalPages}
                                >
                                  <ChevronsRight className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex items-center justify-center h-[500px] text-slate-400">
                    <div className="text-center">
                      <DatabaseIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Select a table to view its data</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ─── Search & Replace Tab ────────────────────────────────── */}
          <TabsContent value="search-replace" className="mt-0">
            <div className="max-w-2xl space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Search & Replace</CardTitle>
                  <CardDescription>
                    Find and replace text across all database tables. Handles serialized data safely.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="search">Search for</Label>
                    <Input id="search" placeholder="Text to search..." value={searchStr} onChange={e => setSearchStr(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="replace">Replace with</Label>
                    <Input id="replace" placeholder="Replacement text..." value={replaceStr} onChange={e => setReplaceStr(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Switch id="dryrun" checked={dryRun} onCheckedChange={setDryRun} />
                      <Label htmlFor="dryrun" className="text-sm cursor-pointer">Dry run (preview only)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="ci" checked={caseInsensitive} onCheckedChange={setCaseInsensitive} />
                      <Label htmlFor="ci" className="text-sm cursor-pointer">Case insensitive</Label>
                    </div>
                  </div>
                  {dryRun && (
                    <Alert>
                      <AlertTriangle className="w-4 h-4" />
                      <AlertDescription className="text-xs">
                        Dry run mode is ON. No changes will be made. Disable to perform actual replacement.
                      </AlertDescription>
                    </Alert>
                  )}
                  <Button
                    onClick={() => searchReplaceMutation.mutate({ search: searchStr, replace: replaceStr, dry_run: dryRun, case_insensitive: caseInsensitive })}
                    disabled={!searchStr || searchReplaceMutation.isPending}
                    className="w-full"
                  >
                    {searchReplaceMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    {dryRun ? 'Preview Changes' : 'Run Search & Replace'}
                  </Button>
                </CardContent>
              </Card>
              {srResult && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {srResult.dry_run ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      {srResult.message}
                    </CardTitle>
                  </CardHeader>
                  {srResult.results.length > 0 && (
                    <CardContent>
                      <div className="space-y-1">
                        {srResult.results.map(r => (
                          <div key={r.table} className="flex items-center justify-between text-sm py-1 border-b border-slate-50 dark:border-slate-800">
                            <span className="font-mono text-slate-700 dark:text-slate-200">{r.table}</span>
                            <Badge variant={srResult.dry_run ? 'warning' : 'success'}>
                              {r.count} replacement{r.count !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ─── SQL Query Tab ───────────────────────────────────────── */}
          <TabsContent value="query" className="mt-0">
            <div className="space-y-4">
              <Alert variant="warning">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  Only SELECT, SHOW, DESCRIBE, and EXPLAIN queries are allowed for safety.
                </AlertDescription>
              </Alert>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">SQL Query Runner</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea className="code-editor mb-3 h-32" value={sql} onChange={e => setSql(e.target.value)} placeholder="SELECT * FROM wp_options WHERE option_name = 'siteurl'" />
                  <Button onClick={() => queryMutation.mutate(sql)} disabled={!sql.trim() || queryMutation.isPending}>
                    <Play className="w-4 h-4" />
                    {queryMutation.isPending ? 'Running...' : 'Run Query'}
                  </Button>
                </CardContent>
              </Card>
              {queryResult && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{queryResult.count} row{queryResult.count !== 1 ? 's' : ''} returned</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                          <tr>
                            {queryResult.columns.map(col => (
                              <th key={col} className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200 border-b dark:border-slate-700 whitespace-nowrap">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResult.rows.map((row, i) => (
                            <tr key={i} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              {queryResult.columns.map(col => (
                                <td key={col} className="px-3 py-2 text-slate-600 dark:text-slate-300 max-w-[300px]">
                                  <span className="block truncate">{String(row[col] ?? 'NULL')}</span>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Edit Row Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!editRow} onOpenChange={open => !open && setEditRow(null)}>
        <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm font-mono">
              Edit Row — {selectedTable}
              {primaryKey && editRow && (
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {primaryKey}: {editRow[primaryKey]}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-3 py-1">
              {tableData?.columns.map(col => {
                const isPK = col === primaryKey
                const meta = tableData.col_meta?.[col]
                return (
                  <div key={col} className="space-y-1">
                    <Label className="text-xs flex items-center gap-1.5">
                      {col}
                      {isPK && <Badge variant="secondary" className="text-[9px] px-1 py-0">PK</Badge>}
                      {meta?.type && <span className="text-slate-400 font-normal">{meta.type}</span>}
                    </Label>
                    <Input
                      value={editValues[col] ?? ''}
                      onChange={e => setEditValues(v => ({ ...v, [col]: e.target.value }))}
                      disabled={isPK}
                      className={`text-xs h-8 ${isPK ? 'bg-slate-50 dark:bg-slate-800 text-slate-400' : ''}`}
                      placeholder={meta?.null ? 'NULL' : ''}
                    />
                  </div>
                )
              })}
            </div>
          </ScrollArea>
          <DialogFooter className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button
              size="sm"
              disabled={updateRowMutation.isPending}
              onClick={() => {
                if (!editRow || !primaryKey) return
                const { [primaryKey]: _, ...data } = editValues
                updateRowMutation.mutate({ primary_value: String(editRow[primaryKey] ?? ''), data })
              }}
            >
              {updateRowMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add Row Dialog ───────────────────────────────────────────── */}
      <Dialog open={isAdding} onOpenChange={open => !open && setIsAdding(false)}>
        <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm font-mono">Add Row — {selectedTable}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-3 py-1">
              {tableData?.columns.map(col => {
                const isPK = col === primaryKey
                const meta = tableData.col_meta?.[col]
                const isAutoInc = meta?.extra?.includes('auto_increment')
                return (
                  <div key={col} className="space-y-1">
                    <Label className="text-xs flex items-center gap-1.5">
                      {col}
                      {isPK && <Badge variant="secondary" className="text-[9px] px-1 py-0">PK</Badge>}
                      {isAutoInc && <span className="text-slate-400 text-[9px]">auto</span>}
                      {meta?.type && <span className="text-slate-400 font-normal">{meta.type}</span>}
                    </Label>
                    <Input
                      value={addValues[col] ?? ''}
                      onChange={e => setAddValues(v => ({ ...v, [col]: e.target.value }))}
                      disabled={isAutoInc}
                      className={`text-xs h-8 ${isAutoInc ? 'bg-slate-50 dark:bg-slate-800 text-slate-400' : ''}`}
                      placeholder={isAutoInc ? 'auto-generated' : (meta?.null ? 'NULL' : '')}
                    />
                  </div>
                )
              })}
            </div>
          </ScrollArea>
          <DialogFooter className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
            <Button
              size="sm"
              disabled={insertRowMutation.isPending}
              onClick={() => {
                const data: Record<string, string> = {}
                tableData?.columns.forEach(col => {
                  const meta = tableData.col_meta?.[col]
                  if (!meta?.extra?.includes('auto_increment') && addValues[col] !== '') {
                    data[col] = addValues[col]
                  }
                })
                insertRowMutation.mutate(data)
              }}
            >
              {insertRowMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Insert Row
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
