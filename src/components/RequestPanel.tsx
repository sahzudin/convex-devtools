import { useState, useRef } from 'react';
import { useRequestStore } from '../stores/request-store';
import { usePersistenceStore } from '../stores/persistence-store';

export function RequestPanel() {
  const {
    selectedFunction,
    args,
    jwtToken,
    isLoading,
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
        functionPath: selectedFunction.path,
        functionType: selectedFunction.type,
        args,
        response,
        timestamp: new Date().toISOString(),
      });
    }
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
      {/* Header */}
      <div className='flex items-center justify-between p-4 border-b border-convex-border'>
        <div className='flex items-center gap-3'>
          <span
            className={`text-xs font-mono font-semibold px-2 py-1 border rounded ${typeColors[selectedFunction.type]}`}
          >
            {selectedFunction.type.toUpperCase()}
          </span>
          <span className='font-mono text-sm'>{selectedFunction.path}</span>
        </div>

        <div className='flex items-center gap-2'>
          <button
            onClick={() => setShowSaveModal(true)}
            className='px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-convex-border rounded transition-colors'
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
                d='M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4'
              />
            </svg>
          </button>

          <button
            onClick={handleInvoke}
            disabled={isLoading || !isArgsValid}
            className={`px-4 py-1.5 rounded font-medium transition-colors flex items-center gap-2 ${
              isLoading
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-convex-accent hover:bg-convex-accent-hover'
            }`}
          >
            {isLoading ? (
              <>
                <svg className='animate-spin w-4 h-4' viewBox='0 0 24 24'>
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
                Running...
              </>
            ) : (
              <>
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
                    d='M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z'
                  />
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                  />
                </svg>
                Run
              </>
            )}
          </button>
        </div>
      </div>

      {/* Auth Status Banner */}
      {jwtToken ? (
        <div className='px-4 py-2 bg-green-900/20 border-b border-convex-border'>
          <div className='flex items-center gap-2 text-sm'>
            <svg
              className='w-4 h-4 text-green-400'
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
            <span className='text-green-300'>Authenticated with JWT token</span>
          </div>
        </div>
      ) : (
        <div className='px-4 py-2 bg-gray-800/50 border-b border-convex-border'>
          <div className='flex items-center gap-2 text-sm'>
            <svg
              className='w-4 h-4 text-gray-500'
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
            <span className='text-gray-400'>
              No authentication — Click{' '}
              <svg
                className='w-4 h-4 inline-block text-yellow-500'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z'
                />
              </svg>{' '}
              in header to add JWT token
            </span>
          </div>
        </div>
      )}

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
                <span className='text-green-400'>✓ Valid JSON</span>
              ) : (
                <span className='text-red-400' title={argsError || ''}>
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
