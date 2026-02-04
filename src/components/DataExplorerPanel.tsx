import { useEffect, useMemo, useState } from 'react';
import { useSchemaStore } from '../stores/schema-store';
import { useRequestStore } from '../stores/request-store';
import { useDataExplorerStore } from '../stores/data-explorer-store';

export function DataExplorerPanel() {
  const { schema } = useSchemaStore();
  const { jwtToken } = useRequestStore();
  const {
    selectedTable,
    queryText,
    isQueryValid,
    queryError,
    helperInstalled,
    helperError,
    queryMode,
    uiFilters,
    uiOrder,
    recentTabs,
    setSelectedTable,
    setQueryText,
    setQueryMode,
    addUiFilter,
    updateUiFilter,
    removeUiFilter,
    setUiFilters,
    setUiOrder,
    setResponse,
    removeFromRecentTabs,
    resetPagination,
    checkHelper,
    installHelper,
    runQuery,
  } = useDataExplorerStore();

  useEffect(() => {
    void checkHelper();
  }, [checkHelper]);

  const tableOptions = useMemo(() => schema?.tables || [], [schema]);
  useEffect(() => {
    if (!selectedTable && tableOptions.length > 0) {
      setSelectedTable(tableOptions[0].name);
    }
  }, [selectedTable, setSelectedTable, tableOptions]);

  const schemaFields = useMemo(() => {
    if (!schema || !selectedTable) return [];
    const table = schema.tables.find((t) => t.name === selectedTable);
    const fields = table ? table.fields.map((f) => f.name) : [];
    const withSystem = [...fields];
    if (!withSystem.includes('_id')) {
      withSystem.unshift('_id');
    }
    if (!withSystem.includes('_creationTime')) {
      withSystem.unshift('_creationTime');
    }
    return withSystem;
  }, [schema, selectedTable]);

  const [showFieldsDrawer, setShowFieldsDrawer] = useState(false);
  const [fieldsWidth, setFieldsWidth] = useState(368);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (event: MouseEvent) => {
      const next = Math.min(520, Math.max(260, window.innerWidth - event.clientX));
      setFieldsWidth(next);
    };
    const handleUp = () => setIsResizing(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isResizing]);

  const handleRun = async () => {
    await runQuery(jwtToken || undefined);
  };

  const handleSelectTab = (tab: (typeof recentTabs)[number]) => {
    setQueryMode(tab.queryMode);
    setSelectedTable(tab.table);
    if (tab.queryMode === 'ui') {
      setUiOrder(tab.uiOrder ?? 'desc');
      if (tab.uiFilters) {
        setUiFilters(tab.uiFilters);
      } else {
        setQueryText(tab.queryText);
      }
    } else {
      setQueryText(tab.queryText);
    }
    setResponse(tab.response ?? null);
    resetPagination();
  };

  return (
    <div className='data-explorer-panel flex flex-col h-full'>
      {/* Header */}
      <div className='panel-tabs border-b border-convex-border justify-between w-full'>
        <div className='flex items-center gap-2 min-w-0'>
          <span className='text-[10px] font-mono font-semibold px-1.5 py-0.5 border border-green-500 text-green-400 rounded flex-shrink-0 h-6 flex items-center'>
            DATA
          </span>
          <span className='font-mono text-sm truncate'>Data Explorer</span>
        </div>

        <div className='flex items-center gap-2 flex-shrink-0'>
          <button
            onClick={() => setShowFieldsDrawer((prev) => !prev)}
            className='btn-compact border border-convex-border text-sm text-gray-300 hover:bg-convex-border'
          >
            Fields
          </button>
          <button
            onClick={handleRun}
            disabled={!isQueryValid || helperInstalled === false}
            className={`btn-compact font-medium text-sm transition-colors flex items-center gap-1.5 min-w-[70px] justify-center ${
              !isQueryValid || helperInstalled === false
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-convex-accent hover:bg-convex-accent-hover'
            }`}
          >
            <svg
              className='w-3.5 h-3.5'
              fill='currentColor'
              viewBox='0 0 24 24'
            >
              <path d='M8 5v14l11-7z' />
            </svg>
            Run
          </button>
        </div>
      </div>

      {/* Recent Query Tabs */}
      <div className='data-tabs-row px-3 bg-convex-darker border-b border-convex-border flex-shrink-0 overflow-x-auto scrollbar-hide'>
        {recentTabs.length === 0 ? (
          <span className='text-xs text-gray-500 px-2'>
            Recent queries will appear here
          </span>
        ) : (
          recentTabs.map((tab) => {
            const isActive =
              selectedTable === tab.table &&
              queryMode === tab.queryMode &&
              queryText === tab.queryText;
            return (
              <div
                key={tab.id}
                className={`flex items-center gap-2 pl-3 pr-2 h-8 rounded-lg text-sm font-mono transition-colors border ${
                  isActive
                    ? 'bg-gray-300 dark:bg-convex-border text-gray-900 dark:text-white border-convex-border'
                    : 'hover:bg-gray-200 dark:hover:bg-convex-border/50 text-gray-600 dark:text-gray-400 border-transparent'
                }`}
                title={`${tab.table} (${tab.queryMode})`}
              >
                <button
                  onClick={() => handleSelectTab(tab)}
                  className='flex items-center gap-2 truncate max-w-[200px]'
                >
                  <span className='font-semibold text-green-400'>
                    D
                  </span>
                  <span className='truncate'>{tab.table}</span>
                  <span className='text-[10px] text-gray-400 uppercase'>
                    {tab.queryMode}
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromRecentTabs(tab.id);
                  }}
                  className='p-0.5 rounded hover:bg-convex-dark text-gray-500 hover:text-white transition-colors flex-shrink-0'
                  title='Close tab'
                >
                  <svg
                    className='w-3 h-3'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M6 18L18 6M6 6l12 12'
                    />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Body */}
      <div className='flex-1 flex overflow-hidden relative'>
        <div
          className='flex-1 flex flex-col p-3 gap-4 transition-all overflow-hidden'
          style={showFieldsDrawer ? { paddingRight: fieldsWidth + 16 } : undefined}
        >
          <div className='flex items-center justify-between gap-3 flex-nowrap pr-2'>
            <div className='flex items-center gap-2 text-sm text-gray-400 min-w-0'>
              <span className='text-gray-500'>Table</span>
              <span className='font-mono text-gray-200 truncate'>
                {selectedTable || 'Select in Schema'}
              </span>
            </div>
            <div className='flex items-center gap-2 flex-shrink-0'>
              <button
                onClick={() => setQueryMode('ui')}
                className={`px-2 py-1 text-xs rounded ${
                  queryMode === 'ui'
                    ? 'bg-convex-accent text-white'
                    : 'text-gray-400 hover:bg-convex-border'
                }`}
              >
                Builder
              </button>
              <button
                onClick={() => setQueryMode('json')}
                className={`px-2 py-1 text-xs rounded ${
                  queryMode === 'json'
                    ? 'bg-convex-accent text-white'
                    : 'text-gray-400 hover:bg-convex-border'
                }`}
              >
                JSON
              </button>
            </div>
          </div>

          <div className='text-xs text-gray-500'>
            This runs a read-only helper query in your Convex project that maps
            to <span className='font-mono'>ctx.db.query()</span>.
          </div>

          {helperInstalled === false && (
            <div className='bg-blue-900/20 border border-blue-800 rounded-lg p-3 text-sm text-blue-300 flex items-center justify-between gap-3'>
              <div>
                Devtools query helper not found in your project. Install it to
                run schema queries.
              </div>
              <button
                onClick={() => void installHelper()}
                className='px-3 py-1 rounded bg-convex-accent hover:bg-convex-accent-hover text-white text-xs'
              >
                Install Helper
              </button>
            </div>
          )}

          {helperError && (
            <div className='bg-red-900/20 border border-red-800 rounded-lg p-3 text-sm text-red-300'>
              {helperError}
            </div>
          )}

          {queryMode === 'json' ? (
            <div className='flex-1 flex flex-col'>
              <div className='flex items-center justify-between mb-2'>
                <label className='text-sm text-gray-400'>Query (JSON)</label>
                <div className='relative group'>
                  <button
                    className='px-2 py-1 text-xs rounded border border-convex-border text-gray-400 hover:bg-convex-border'
                    title='Example'
                  >
                    Example
                  </button>
                  <div className='absolute right-0 mt-2 w-80 bg-convex-darker border border-convex-border rounded-lg p-3 text-xs text-gray-500 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition z-20'>
                    <div className='text-gray-400 font-semibold mb-2'>
                      Example
                    </div>
                    <pre className='whitespace-pre-wrap'>
{`{
  "table": "users",
  "filters": [
    { "field": "email", "op": "eq", "value": "ada@lovelace.dev" }
  ],
  "order": "desc"
}`}
                    </pre>
                  </div>
                </div>
                {!isQueryValid && queryError && (
                  <span className='text-xs text-red-400'>{queryError}</span>
                )}
              </div>
              <textarea
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                className='flex-1 w-full bg-convex-darker border border-convex-border rounded-lg p-3 font-mono text-sm focus:outline-none focus:border-convex-accent resize-none'
              />
            </div>
          ) : (
            <div className='flex-1 min-h-0 flex flex-col gap-3'>
              <div className='flex items-center gap-3'>
                <label className='text-sm text-gray-400'>Order</label>
                <select
                  className='input-control'
                  value={uiOrder}
                  onChange={(e) =>
                    setUiOrder(e.target.value as 'asc' | 'desc')
                  }
                >
                  <option value='desc'>desc</option>
                  <option value='asc'>asc</option>
                </select>
              </div>

              <div className='flex items-center justify-between'>
                <label className='text-sm text-gray-400'>Filters</label>
                <button
                  onClick={() => addUiFilter()}
                  className='px-2 py-1 rounded border border-convex-border text-gray-300 hover:bg-convex-border text-xs ml-auto'
                >
                  Add filter
                </button>
              </div>

              {uiFilters.length === 0 ? (
                <div className='text-xs text-gray-500'>
                  No filters yet.
                </div>
              ) : (
                <div className='space-y-2 overflow-y-auto pr-3 pb-2 pt-2 flex-1 min-h-0'>
                  {uiFilters.map((filter, index) => (
                    <div
                      key={`filter-${index}`}
                      className='flex items-center gap-2 w-full'
                    >
                      <select
                        className='input-control'
                        value={filter.field}
                        onChange={(e) =>
                          updateUiFilter(index, { field: e.target.value })
                        }
                      >
                        <option value=''>Field</option>
                        {schemaFields.map((field) => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))}
                      </select>
                      <select
                        className='input-control'
                        value={filter.op}
                        onChange={(e) =>
                          updateUiFilter(index, {
                            op: e.target.value as
                              | 'eq'
                              | 'neq'
                              | 'gt'
                              | 'gte'
                              | 'lt'
                              | 'lte',
                          })
                        }
                      >
                        <option value='eq'>eq</option>
                        <option value='neq'>neq</option>
                        <option value='gt'>gt</option>
                        <option value='gte'>gte</option>
                        <option value='lt'>lt</option>
                        <option value='lte'>lte</option>
                      </select>
                      <input
                        type='text'
                        placeholder='value'
                        value={filter.value}
                        onChange={(e) =>
                          updateUiFilter(index, { value: e.target.value })
                        }
                        className='flex-1 input-control'
                      />
                      <button
                        onClick={() => removeUiFilter(index)}
                        className='ml-auto h-9 w-9 rounded border border-convex-border text-gray-500 hover:text-gray-200 hover:bg-convex-border flex items-center justify-center'
                        title='Remove filter'
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
                            d='M6 18L18 6M6 6l12 12'
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {showFieldsDrawer && (
          <>
            <div
              className='absolute top-0 h-full w-1 cursor-col-resize hover:bg-convex-border/40'
              style={{ right: fieldsWidth }}
              onMouseDown={() => setIsResizing(true)}
            />
            <div
              className='fields-drawer absolute right-0 top-0 h-full border-l border-convex-border bg-convex-darker/90 backdrop-blur-sm'
              style={{ width: fieldsWidth }}
            >
            <div className='h-12 flex items-center justify-between px-4 border-b border-convex-border'>
              <div
                className='text-sm text-gray-300 font-semibold truncate'
                title={selectedTable ? `${selectedTable} fields` : 'Fields'}
              >
                {selectedTable ? `${selectedTable} fields` : 'Fields'}
              </div>
              <span className='text-xs text-gray-500'>
                {schemaFields.length} fields
              </span>
              <button
                onClick={() => setShowFieldsDrawer(false)}
                className='p-1.5 text-gray-400 hover:text-white hover:bg-convex-border rounded'
                title='Close'
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
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </button>
            </div>
            <div className='p-3 text-xs text-gray-500'>
              <div className='grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)] gap-x-3 gap-y-1 text-[11px] text-gray-400 pb-1 border-b border-convex-border'>
                <span className='uppercase tracking-wide text-gray-500'>
                  Field
                </span>
                <span className='uppercase tracking-wide text-gray-500 text-right'>
                  Type
                </span>
              </div>
              <div className='max-h-[calc(100vh-220px)] overflow-auto pr-1'>
                {schemaFields.length === 0 ? (
                  <div className='text-xs text-gray-500 py-2'>
                    Select a table in the schema panel to view fields.
                  </div>
                ) : (
                  schemaFields.map((fieldName) => {
                    const field = schema?.tables
                      .find((t) => t.name === selectedTable)
                      ?.fields.find((f) => f.name === fieldName);
                    return (
                      <div
                        key={`${selectedTable}.${fieldName}`}
                        className='grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)] gap-x-3 items-center text-xs text-gray-400 py-1 border-b border-convex-border/50'
                      >
                        <span className='font-mono truncate'>{fieldName}</span>
                        <span className='text-gray-500 text-right truncate'>
                          {field
                            ? `${field.optional ? 'optional' : 'required'} · ${field.type}`
                            : ''}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
