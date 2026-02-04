import { useEffect, useMemo, useState } from 'react';
import { DataTable, JsonCell } from './DataTable';
import { useDataExplorerStore, PAGE_SIZE_OPTIONS } from '../stores/data-explorer-store';
import { useSchemaStore } from '../stores/schema-store';

export function DataResponsePanel() {
  const { schema } = useSchemaStore();
  const {
    response,
    isLoading,
    selectedTable,
    columnsByTable,
    setColumnsForTable,
    toggleColumn,
    clearColumns,
    pageSize,
    setPageSize,
    hasNextPage,
    cursorStack,
    nextPage,
    prevPage,
    runQuery,
    clientPageIndex,
    setClientPageIndex,
  } = useDataExplorerStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [showColumns, setShowColumns] = useState(false);
  const [jsonMode, setJsonMode] = useState<'rows' | 'full'>('rows');

  const formatJson = (data: unknown): string => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  const syntaxHighlight = (json: string): string => {
    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'json-key';
          } else {
            cls = 'json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  };

  const highlightSearch = (html: string, query: string): string => {
    if (!query.trim()) return html;
    try {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})(?![^<]*>)`, 'gi');
      return html.replace(
        regex,
        '<mark class="bg-yellow-300 text-black rounded px-0.5">$1</mark>'
      );
    } catch {
      return html;
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(
        formatJson(response?.success ? response?.result : response?.error)
      );
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const resultRows = useMemo(() => {
    if (!response || !response.success) return [];
    if (Array.isArray(response.result)) {
      return response.result as Record<string, unknown>[];
    }
    if (
      response.result &&
      typeof response.result === 'object' &&
      'page' in (response.result as Record<string, unknown>) &&
      Array.isArray((response.result as { page?: unknown }).page)
    ) {
      return (response.result as { page: Record<string, unknown>[] }).page;
    }
    return [];
  }, [response]);

  const schemaFields = useMemo(() => {
    if (!schema || !selectedTable) return [];
    const table = schema.tables.find((t) => t.name === selectedTable);
    if (!table) return [];
    return table.fields.map((field) => field.name);
  }, [schema, selectedTable]);

  const availableColumns = useMemo(() => {
    const columns = schemaFields.length > 0 ? [...schemaFields] : [];
    if (columns.length === 0) {
      const keySet = new Set<string>();
      resultRows.forEach((row) => {
        Object.keys(row).forEach((key) => keySet.add(key));
      });
      columns.push(...Array.from(keySet));
    }
    if (!columns.includes('_id')) {
      if (resultRows.some((row) => '_id' in row)) {
        columns.unshift('_id');
      }
    }
    if (!columns.includes('_creationTime')) {
      if (resultRows.some((row) => '_creationTime' in row)) {
        columns.unshift('_creationTime');
      }
    }
    return columns;
  }, [schemaFields, resultRows]);

  const selectedColumns = useMemo(() => {
    if (!selectedTable) return availableColumns;
    const stored = columnsByTable[selectedTable];
    if (stored === undefined) return availableColumns;
    return stored.filter((col) => availableColumns.includes(col));
  }, [availableColumns, columnsByTable, selectedTable]);

  useEffect(() => {
    if (!selectedTable) return;
    const stored = columnsByTable[selectedTable];
    if (stored === undefined && availableColumns.length > 0) {
      setColumnsForTable(selectedTable, availableColumns);
    }
  }, [availableColumns, columnsByTable, selectedTable, setColumnsForTable]);

  const tableRows = useMemo(() => {
    if (!response || !response.success) return [];
    if (!Array.isArray(response.result)) return [];
    if (response?.pageInfo) {
      return resultRows;
    }
    const start = clientPageIndex * pageSize;
    const end = start + pageSize;
    return resultRows.slice(start, end);
  }, [clientPageIndex, pageSize, response, resultRows]);

  const filteredTableRows = useMemo(() => {
    if (!searchQuery.trim()) return tableRows;
    const query = searchQuery.toLowerCase();
    return tableRows.filter((row) =>
      JSON.stringify(row).toLowerCase().includes(query)
    );
  }, [searchQuery, tableRows]);

  const clientTotalPages = useMemo(() => {
    if (!response) return 1;
    if (response?.pageInfo) return 1;
    if (!response.success || !Array.isArray(response.result)) return 1;
    return Math.max(1, Math.ceil(resultRows.length / pageSize));
  }, [pageSize, response, resultRows]);

  const handleNext = async () => {
    if (response?.pageInfo) {
      nextPage();
      await runQuery();
      return;
    }
    if (clientPageIndex + 1 < clientTotalPages) {
      setClientPageIndex(clientPageIndex + 1);
    }
  };

  const handlePrev = async () => {
    if (response?.pageInfo) {
      prevPage();
      await runQuery();
      return;
    }
    if (clientPageIndex > 0) {
      setClientPageIndex(clientPageIndex - 1);
    }
  };

  const hasPrev =
    response?.pageInfo ? cursorStack.length > 0 : clientPageIndex > 0;
  const hasNext = response?.pageInfo
    ? hasNextPage
    : clientPageIndex + 1 < clientTotalPages;

  const rowSummary = response?.pageInfo
    ? `${filteredTableRows.length} rows`
    : `${filteredTableRows.length} of ${resultRows.length} rows`;

  const isError =
    !response?.success ||
    (response?.success &&
      response.result &&
      typeof response.result === 'object' &&
      (response.result as Record<string, unknown>)?.status === 'error');

  if (isLoading && !response) {
    return (
      <div className='flex items-center justify-center h-full text-gray-500'>
        <div className='flex items-center gap-2'>
          <svg className='animate-spin w-5 h-5' viewBox='0 0 24 24'>
            <circle
              className='opacity-25'
              cx='12'
              cy='12'
              r='10'
              stroke='currentColor'
              strokeWidth='4'
              fill='none'
            />
            <path
              className='opacity-75'
              fill='currentColor'
              d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
            />
          </svg>
          Running query...
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className='flex items-center justify-center h-full text-gray-500'>
        <div className='text-center'>
          <p>Query results will appear here after running</p>
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full'>
      <div className='flex items-center justify-between px-3 py-1.5 border-b border-convex-border'>
        <div className='flex items-center gap-2'>
          {!isError ? (
            <span className='flex items-center gap-1.5 text-green-400 text-sm'>
              <svg
                className='w-4 h-4'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
              Success
            </span>
          ) : (
            <span className='flex items-center gap-1.5 text-red-400 text-sm'>
              <svg
                className='w-4 h-4'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
              Error
            </span>
          )}

        {response.duration !== undefined && (
          <span className='text-sm text-gray-500'>{response.duration}ms</span>
        )}

        <span className='text-sm text-gray-600'>
          {response.timestamp && !Number.isNaN(new Date(response.timestamp).getTime())
            ? new Date(response.timestamp).toLocaleTimeString()
            : '—'}
        </span>
        {isLoading && (
          <span className='text-xs text-gray-500 ml-2'>Loading…</span>
        )}
      </div>

        <div className='flex items-center gap-2'>
          <div className='relative'>
            <svg
              className='absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-500'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
              />
            </svg>
            <input
              type='text'
              placeholder='Search...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='w-40 bg-convex-darker border border-convex-border rounded-md pl-8 pr-2 py-1 text-xs focus:outline-none focus:border-convex-accent'
            />
          </div>

          <button
            onClick={copyToClipboard}
            className='p-2 text-gray-400 hover:text-white hover:bg-convex-border rounded transition-colors'
            title='Copy to clipboard'
          >
            <svg
              className='w-4 h-4'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
              />
            </svg>
          </button>

          {viewMode === 'json' && (
            <button
              onClick={() =>
                setJsonMode(jsonMode === 'rows' ? 'full' : 'rows')
              }
              className='px-2 py-1 text-xs rounded border border-convex-border text-gray-400 hover:text-white hover:bg-convex-border transition-colors'
              title='Toggle full response metadata'
            >
              {jsonMode === 'rows' ? 'Full response' : 'Rows only'}
            </button>
          )}

          <button
            onClick={() => setViewMode(viewMode === 'table' ? 'json' : 'table')}
            className='px-2 py-1 text-xs rounded border border-convex-border text-gray-400 hover:text-white hover:bg-convex-border transition-colors'
            title='Toggle table/json view'
          >
            {viewMode === 'table' ? 'JSON' : 'Table'}
          </button>
        </div>
      </div>

      {!isError && viewMode === 'table' && (
        <div className='flex items-center justify-between px-3 py-2 border-b border-convex-border text-xs text-gray-400 gap-3 flex-wrap'>
          <div className='flex items-center gap-3'>
            <span>{rowSummary}</span>
            {!response.pageInfo && Array.isArray(response.result) && (
              <span className='text-yellow-400'>
                Using client-side pagination (helper not updated)
              </span>
            )}
            <div className='flex items-center gap-2'>
              <span>Page size</span>
              <select
                className='bg-convex-darker border border-convex-border rounded px-2 py-1 text-xs'
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <div className='flex items-center gap-1'>
              <button
                onClick={handlePrev}
                disabled={!hasPrev}
                className={`px-2 py-1 rounded border text-xs ${
                  hasPrev
                    ? 'border-convex-border text-gray-300 hover:bg-convex-border'
                    : 'border-convex-border/50 text-gray-600 cursor-not-allowed'
                }`}
              >
                Prev
              </button>
              <button
                onClick={handleNext}
                disabled={!hasNext}
                className={`px-2 py-1 rounded border text-xs ${
                  hasNext
                    ? 'border-convex-border text-gray-300 hover:bg-convex-border'
                    : 'border-convex-border/50 text-gray-600 cursor-not-allowed'
                }`}
              >
                Next
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowColumns(!showColumns)}
            className='px-2 py-1 rounded border border-convex-border text-gray-300 hover:bg-convex-border'
          >
            Columns
          </button>
        </div>
      )}

      {showColumns && !isError && viewMode === 'table' && (
        <div className='border-b border-convex-border px-3 py-3 text-xs text-gray-400'>
          <div className='flex items-center justify-between mb-2'>
            <span className='font-semibold text-gray-300'>Columns</span>
            <div className='flex items-center gap-2'>
              <button
                onClick={() =>
                  selectedTable && setColumnsForTable(selectedTable, availableColumns)
                }
                className='px-2 py-1 rounded border border-convex-border text-gray-300 hover:bg-convex-border'
              >
                Select all
              </button>
              <button
                onClick={() => selectedTable && clearColumns(selectedTable)}
                className='px-2 py-1 rounded border border-convex-border text-gray-300 hover:bg-convex-border'
              >
                Clear all
              </button>
            </div>
          </div>
          <div className='flex flex-wrap gap-2'>
            {availableColumns.map((col) => {
              const checked = selectedColumns.includes(col);
              return (
                <label
                  key={col}
                  className='flex items-center gap-2 px-2 py-1 rounded border border-convex-border text-gray-300 cursor-pointer'
                >
                  <input
                    type='checkbox'
                    checked={checked}
                    onChange={() => selectedTable && toggleColumn(selectedTable, col)}
                  />
                  <span className='font-mono'>{col}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className='flex-1 overflow-auto p-4'>
        {response.success ? (
          viewMode === 'table' && Array.isArray(response.result) ? (
            selectedColumns.length === 0 ? (
              <div className='text-sm text-gray-500'>
                No columns selected. Use the Columns button to pick fields.
              </div>
            ) : (
              <DataTable
                rows={filteredTableRows}
                columns={selectedColumns}
                renderCell={(value, column) => {
                  if (value === null || value === undefined) {
                    return <span className='text-gray-500'>—</span>;
                  }
                  if (typeof value === 'number') {
                    const lower = column.toLowerCase();
                    const looksLikeTime =
                      column === '_creationTime' ||
                      lower.endsWith('at') ||
                      lower.includes('time');
                    if (looksLikeTime && value > 1e12) {
                      return (
                        <span>{new Date(value).toLocaleString()}</span>
                      );
                    }
                  }
                  if (typeof value === 'string' || typeof value === 'number') {
                    return <span>{String(value)}</span>;
                  }
                  if (typeof value === 'boolean') {
                    return <span>{value ? 'true' : 'false'}</span>;
                  }
                  return <JsonCell value={value} />;
                }}
              />
            )
          ) : (
            <pre
              className='font-mono text-sm whitespace-pre-wrap break-words'
              dangerouslySetInnerHTML={{
                __html: highlightSearch(
                  syntaxHighlight(
                    formatJson(
                      jsonMode === 'rows'
                        ? response.result
                        : {
                            result: response.result,
                            pageInfo: response.pageInfo,
                          }
                    )
                  ),
                  searchQuery
                ),
              }}
            />
          )
        ) : (
          <div className='space-y-3'>
            <div className='bg-red-900/20 border border-red-800 rounded-lg p-4'>
              <div className='flex items-start gap-3'>
                <svg
                  className='w-5 h-5 text-red-400 flex-shrink-0 mt-0.5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                  />
                </svg>
                <div>
                  <p className='text-red-700 dark:text-red-300 font-medium'>
                    {response.error?.message ||
                      (response.error
                        ? JSON.stringify(response.error)
                        : 'Request failed')}
                  </p>
                  {response.error?.code && (
                    <p className='text-red-600 dark:text-red-400 text-sm mt-1'>
                      Code: {response.error.code}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {response.error?.data !== undefined &&
              response.error.data !== null && (
                <div>
                  <p className='text-sm text-gray-400 mb-2'>Error Details:</p>
                  <pre
                    className='font-mono text-sm whitespace-pre-wrap break-words bg-convex-darker border border-convex-border rounded-lg p-4'
                    dangerouslySetInnerHTML={{
                      __html: syntaxHighlight(
                        formatJson(
                          response.error.data as Record<string, unknown>
                        )
                      ),
                    }}
                  />
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
