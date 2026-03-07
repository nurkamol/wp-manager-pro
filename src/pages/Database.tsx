import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
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
import { toast } from 'sonner'
import { Database as DatabaseIcon, RefreshCw, Search, Play, ArrowRight, CheckCircle2, AlertTriangle, Zap } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Table {
  name: string
  rows: number
  size_mb: string
  engine: string
  collation: string
  is_wp: boolean
}

interface TableData {
  table: string
  columns: string[]
  rows: Record<string, string | null>[]
  total: number
  page: number
  pages: number
}

interface SearchReplaceResult {
  success: boolean
  dry_run: boolean
  total: number
  results: Array<{ table: string; count: number }>
  message: string
}

export function Database() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [searchStr, setSearchStr] = useState('')
  const [replaceStr, setReplaceStr] = useState('')
  const [dryRun, setDryRun] = useState(true)
  const [caseInsensitive, setCaseInsensitive] = useState(false)
  const [srResult, setSrResult] = useState<SearchReplaceResult | null>(null)
  const [sql, setSql] = useState('SELECT * FROM wp_options LIMIT 10')
  const [queryResult, setQueryResult] = useState<{ columns: string[]; rows: Record<string, unknown>[]; count: number } | null>(null)

  const { data: tablesData, isLoading: tablesLoading } = useQuery({
    queryKey: ['db-tables'],
    queryFn: () => api.get<{ tables: Table[]; total: number; total_size: number; prefix: string }>('/database/tables'),
  })

  const { data: tableData, isLoading: tableDataLoading, refetch: refetchTableData } = useQuery({
    queryKey: ['db-table-data', selectedTable],
    queryFn: () => api.get<TableData>(`/database/table-data?table=${selectedTable}`),
    enabled: !!selectedTable,
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
    mutationFn: (sqlQuery: string) => api.post<{ columns: string[]; rows: Record<string, unknown>[]; count: number }>('/database/query', { sql: sqlQuery }),
    onSuccess: (data) => setQueryResult(data),
    onError: (err: Error) => toast.error(err.message),
  })

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

          {/* Tables Tab */}
          <TabsContent value="tables" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Table List */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Tables ({tablesData?.total})</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[500px]">
                      {tablesData?.tables.map(table => (
                        <button
                          key={table.name}
                          onClick={() => setSelectedTable(table.name)}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 border-b border-slate-50 transition-colors ${selectedTable === table.name ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}
                        >
                          <div className="min-w-0">
                            <p className={`text-sm font-mono truncate ${table.is_wp ? 'text-slate-700' : 'text-slate-500'}`}>
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
              <div className="lg:col-span-2">
                {selectedTable ? (
                  <Card>
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-mono">{selectedTable}</CardTitle>
                        <CardDescription className="text-xs">{tableData?.total?.toLocaleString()} rows</CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => refetchTableData()}>
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      {tableDataLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                        </div>
                      ) : (
                        <ScrollArea className="h-[420px]">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                  {tableData?.columns.map(col => (
                                    <th key={col} className="px-3 py-2 text-left font-semibold text-slate-700 border-b whitespace-nowrap">
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {tableData?.rows.map((row, i) => (
                                  <tr key={i} className="border-b hover:bg-slate-50">
                                    {tableData.columns.map(col => (
                                      <td key={col} className="px-3 py-2 text-slate-600 max-w-[200px]">
                                        <span className="block truncate">{String(row[col] ?? 'NULL')}</span>
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-slate-400">
                    <div className="text-center">
                      <DatabaseIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Select a table to view its data</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Search & Replace Tab */}
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
                    <Input
                      id="search"
                      placeholder="Text to search..."
                      value={searchStr}
                      onChange={e => setSearchStr(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="replace">Replace with</Label>
                    <Input
                      id="replace"
                      placeholder="Replacement text..."
                      value={replaceStr}
                      onChange={e => setReplaceStr(e.target.value)}
                    />
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
                    {searchReplaceMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    {dryRun ? 'Preview Changes' : 'Run Search & Replace'}
                  </Button>
                </CardContent>
              </Card>

              {srResult && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {srResult.dry_run ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                      {srResult.message}
                    </CardTitle>
                  </CardHeader>
                  {srResult.results.length > 0 && (
                    <CardContent>
                      <div className="space-y-1">
                        {srResult.results.map(r => (
                          <div key={r.table} className="flex items-center justify-between text-sm py-1 border-b border-slate-50">
                            <span className="font-mono text-slate-700">{r.table}</span>
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

          {/* SQL Query Tab */}
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
                  <Textarea
                    className="code-editor mb-3 h-32"
                    value={sql}
                    onChange={e => setSql(e.target.value)}
                    placeholder="SELECT * FROM wp_options WHERE option_name = 'siteurl'"
                  />
                  <Button
                    onClick={() => queryMutation.mutate(sql)}
                    disabled={!sql.trim() || queryMutation.isPending}
                  >
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
                    <ScrollArea className="h-[400px]">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50 sticky top-0">
                            <tr>
                              {queryResult.columns.map(col => (
                                <th key={col} className="px-3 py-2 text-left font-semibold text-slate-700 border-b whitespace-nowrap">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {queryResult.rows.map((row, i) => (
                              <tr key={i} className="border-b hover:bg-slate-50">
                                {queryResult.columns.map(col => (
                                  <td key={col} className="px-3 py-2 text-slate-600 max-w-[300px]">
                                    <span className="block truncate">{String(row[col] ?? 'NULL')}</span>
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
