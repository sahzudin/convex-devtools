import { useState, useRef } from 'react';
import { useRequestStore } from '../stores/request-store';
import { usePersistenceStore } from '../stores/persistence-store';

export function RequestPanel() {
  const {
    selectedFunction,
    args,
    jwtToken,
    isLoading,
    projectName,
    setArgs,
    invoke,
    isArgsValid,
    argsError,
  } = useRequestStore();

  const { collections, saveRequest, addToHistory } = usePersistenceStore();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInvoke = async () => {
    // Auto-format JSON before running
    try {
      const parsed = JSON.parse(args);
      setArgs(JSON.stringify(parsed, null, 2));
    } catch {
      // Invalid JSON, will be caught by invoke
    }

    await invoke();

    // Add to history
    const { response } = useRequestStore.getState();
    if (selectedFunction && response) {
      addToHistory({
        projectName: projectName || undefined,
        functionPath: selectedFunction.path,
        functionType: selectedFunction.type,
        args,
        response,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleOpenSaveModal = () => {
    // Set default name to full function path
    if (selectedFunction) {
      setSaveName(selectedFunction.path);
    }
    setShowSaveModal(true);
  };

  const handleSave = () => {
    if (!selectedFunction || !saveName || !selectedCollectionId) return;

    saveRequest(selectedCollectionId, saveName, {
      functionPath: selectedFunction.path,
      functionType: selectedFunction.type,
      args,
    });

    setShowSaveModal(false);
    setSaveName('');
    setSelectedCollectionId('');
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(args);
      setArgs(JSON.stringify(parsed, null, 2));
    } catch {
      // Invalid JSON, don't format
    }
  };

  if (!selectedFunction) {
    return (
      <div className='flex items-center justify-center h-full text-gray-500'>
        <div className='text-center'>
          <svg
            className='w-16 h-16 mx-auto mb-4 text-gray-600'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={1}
              d='M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
            />
          </svg>
          <p>Select a function from the tree to get started</p>
        </div>
      </div>
    );
  }

  const typeColors = {
    query: 'text-blue-400 border-blue-400',
    mutation: 'text-orange-400 border-orange-400',
    action: 'text-purple-400 border-purple-400',
  };

  return (
    <div className='flex flex-col h-full'>
      {/* Header - Compact */}
      <div className='flex items-center justify-between px-3 py-2 border-b border-convex-border'>
        <div className='flex items-center gap-2 min-w-0'>
          <span
            className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 border rounded flex-shrink-0 ${typeColors[selectedFunction.type]}`}
          >
            {selectedFunction.type.charAt(0).toUpperCase()}
          </span>
          <span className='font-mono text-sm truncate'>
            {selectedFunction.path}
          </span>
          {/* JWT Auth Status Icon */}
          {jwtToken ? (
            <span
              className='flex-shrink-0 text-green-400 cursor-help'
              title='Authenticated with JWT token'
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
                  d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
                />
              </svg>
            </span>
          ) : (
            <span
              className='flex-shrink-0 text-gray-500 cursor-help'
              title='No authentication - Click key icon in header to add JWT'
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
                  d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
                />
              </svg>
            </span>
          )}
        </div>

        <div className='flex items-center gap-2 flex-shrink-0'>
          <button
            onClick={handleOpenSaveModal}
            className='p-1.5 text-gray-400 hover:text-white hover:bg-convex-border rounded transition-colors'
            title='Save to Collection'
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
                d='M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7.828a2 2 0 00-.586-1.414l-1.828-1.828A2 2 0 0016.172 4H16M8 4v4m0-4h4m0 0v4m0-4h4v4M8 8h8M8 12h8m-8 4h6'
              />
            </svg>
          </button>

          <button
            onClick={handleInvoke}
            disabled={isLoading || !isArgsValid}
            className={`px-3 py-1 rounded font-medium text-sm transition-colors flex items-center gap-1.5 min-w-[70px] justify-center ${
              isLoading
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-convex-accent hover:bg-convex-accent-hover'
            }`}
          >
            {isLoading ? (
              <svg className='animate-spin w-3.5 h-3.5' viewBox='0 0 24 24'>
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
            ) : (
              <>
                <svg
                  className='w-3.5 h-3.5'
                  fill='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path d='M8 5v14l11-7z' />
                </svg>
                Run
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area with Args Editor and Arguments Panel */}
      <div className='flex-1 flex overflow-hidden'>
        {/* Args Editor */}
        <div className='flex-1 flex flex-col p-4'>
          <div className='flex items-center justify-between mb-2'>
            <label className='text-sm text-gray-400'>Arguments (JSON)</label>
            <div className='flex items-center gap-3'>
              <button
                onClick={formatJson}
                className='text-xs text-gray-500 hover:text-white transition-colors'
              >
                Format
              </button>
              <div className='text-xs'>
                {isArgsValid ? (
                  <span className='text-green-600 dark:text-green-400'>
                    ✓ Valid JSON
                  </span>
                ) : (
                  <span
                    className='text-red-600 dark:text-red-400'
                    title={argsError || ''}
                  >
                    ✗ Invalid JSON
                  </span>
                )}
              </div>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            value={args}
            onChange={(e) => setArgs(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleInvoke();
              }
            }}
            className='flex-1 w-full bg-convex-darker border border-convex-border rounded-lg p-4 font-mono text-sm resize-none focus:outline-none focus:border-convex-accent'
            placeholder='{}'
            spellCheck={false}
          />
          <p className='mt-2 text-xs text-gray-500'>Press ⌘+Enter to run</p>
        </div>

        {/* Arguments Panel */}
        {selectedFunction && selectedFunction.args.length > 0 && (
          <div className='w-64 border-l border-convex-border flex flex-col overflow-hidden'>
            <div className='p-3 border-b border-convex-border'>
              <h3 className='text-sm font-semibold text-gray-300'>Arguments</h3>
            </div>
            <div className='flex-1 overflow-y-auto p-3 space-y-2'>
              {selectedFunction.args.map((arg) => {
                const currentArgs = (() => {
                  try {
                    return JSON.parse(args);
                  } catch {
                    return {};
                  }
                })();
                const isInArgs = arg.name in currentArgs;

                const handleToggleArg = () => {
                  try {
                    const parsed = JSON.parse(args);
                    if (isInArgs) {
                      // Remove the argument
                      delete parsed[arg.name];
                    } else {
                      // Add the argument with default value
                      if (arg.name === 'paginationOpts') {
                        parsed[arg.name] = { cursor: null, numItems: 10 };
                      } else if (
                        arg.type.includes('[]') ||
                        arg.type.toLowerCase().includes('array')
                      ) {
                        parsed[arg.name] = [];
                      } else if (arg.type.toLowerCase().includes('number')) {
                        parsed[arg.name] = 0;
                      } else if (arg.type.toLowerCase().includes('boolean')) {
                        parsed[arg.name] = false;
                      } else {
                        parsed[arg.name] = '';
                      }
                    }
                    setArgs(JSON.stringify(parsed, null, 2));
                  } catch {
                    // If JSON is invalid, don't do anything
                  }
                };

                return (
                  <div
                    key={arg.name}
                    className={`p-2 rounded border ${
                      isInArgs
                        ? 'bg-convex-accent/10 border-convex-accent/50'
                        : 'bg-convex-darker border-convex-border'
                    } transition-colors`}
                  >
                    <div className='flex items-start justify-between gap-2'>
                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center gap-1.5'>
                          <span className='text-sm font-mono text-gray-300 truncate'>
                            {arg.name}
                          </span>
                          {!arg.optional && (
                            <span className='text-xs text-red-400'>*</span>
                          )}
                        </div>
                        <div className='text-xs text-gray-500 mt-0.5 truncate'>
                          {arg.type}
                        </div>
                        {arg.description && (
                          <div
                            className='text-xs text-gray-400 mt-1'
                            title={arg.description}
                          >
                            {arg.description.length > 60
                              ? arg.description.substring(0, 60) + '...'
                              : arg.description}
                          </div>
                        )}
                        {arg.enumValues && arg.enumValues.length > 0 && (
                          <div className='flex flex-wrap gap-1 mt-1.5'>
                            {arg.enumValues.map((value) => (
                              <span
                                key={value}
                                onClick={() => {
                                  try {
                                    const parsed = JSON.parse(args);
                                    parsed[arg.name] = value;
                                    setArgs(JSON.stringify(parsed, null, 2));
                                  } catch {
                                    // ignore
                                  }
                                }}
                                className='text-[10px] px-1.5 py-0.5 rounded bg-convex-border text-gray-300 hover:bg-convex-accent/30 cursor-pointer transition-colors'
                                title={`Click to set ${arg.name} to '${value}'`}
                              >
                                {value}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleToggleArg}
                        disabled={!arg.optional && isInArgs}
                        className={`flex-shrink-0 p-1 rounded transition-colors ${
                          !arg.optional && isInArgs
                            ? 'text-gray-600 cursor-not-allowed'
                            : isInArgs
                              ? 'text-red-400 hover:text-red-300 hover:bg-red-400/10'
                              : 'text-green-400 hover:text-green-300 hover:bg-green-400/10'
                        }`}
                        title={
                          !arg.optional && isInArgs
                            ? 'Required argument'
                            : isInArgs
                              ? 'Remove from request'
                              : 'Add to request'
                        }
                      >
                        {isInArgs ? (
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
                              d='M20 12H4'
                            />
                          </svg>
                        ) : (
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
                              d='M12 4v16m8-8H4'
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-convex-dark border border-convex-border rounded-lg p-6 w-96'>
            <h3 className='text-lg font-semibold mb-4'>Save to Collection</h3>

            <div className='space-y-4'>
              <div>
                <label className='block text-sm text-gray-400 mb-1'>Name</label>
                <input
                  type='text'
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder='e.g., Get all products'
                  className='w-full bg-convex-darker border border-convex-border rounded px-3 py-2 text-sm focus:outline-none focus:border-convex-accent'
                />
              </div>

              <div>
                <label className='block text-sm text-gray-400 mb-1'>
                  Collection
                </label>
                {collections.length === 0 ? (
                  <p className='text-sm text-gray-500'>
                    No collections yet. Create one in the Collections sidebar.
                  </p>
                ) : (
                  <select
                    value={selectedCollectionId}
                    onChange={(e) => setSelectedCollectionId(e.target.value)}
                    className='w-full bg-convex-darker border border-convex-border rounded px-3 py-2 text-sm focus:outline-none focus:border-convex-accent'
                  >
                    <option value=''>Select a collection</option>
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className='flex justify-end gap-2 mt-6'>
              <button
                onClick={() => setShowSaveModal(false)}
                className='px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors'
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!saveName || !selectedCollectionId}
                className='px-4 py-2 text-sm bg-convex-accent hover:bg-convex-accent-hover rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
