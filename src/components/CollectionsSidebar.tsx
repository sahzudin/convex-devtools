import { useState, useRef } from 'react';
import {
  usePersistenceStore,
  SavedRequest,
  HistoryEntry,
} from '../stores/persistence-store';
import { useRequestStore } from '../stores/request-store';
import { FunctionInfo } from '../stores/schema-store';

interface CollectionsSidebarProps {
  onClose: () => void;
}

export function CollectionsSidebar({ onClose }: CollectionsSidebarProps) {
  const {
    collections,
    history,
    createCollection,
    deleteCollection,
    renameCollection,
    deleteRequest,
    deleteHistoryEntry,
    saveRequest,
    clearHistory,
    exportData,
    importData,
  } = usePersistenceStore();

  const { setSelectedFunction, setArgs } = useRequestStore();

  const [activeTab, setActiveTab] = useState<'collections' | 'history'>(
    'collections'
  );
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(
    new Set()
  );
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showNewCollectionInput, setShowNewCollectionInput] = useState(false);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(
    null
  );
  const [editingName, setEditingName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleCollection = (id: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreateCollection = () => {
    if (!newCollectionName.trim()) return;
    // Support creating inside a folder using `Folder Name/Collection Name`
    const raw = newCollectionName.trim();
    let folder: string | undefined;
    let name = raw;
    if (raw.includes('/')) {
      const parts = raw.split('/');
      folder = parts.slice(0, -1).join('/').trim();
      name = parts[parts.length - 1].trim();
    }
    const id = createCollection(name, folder ?? null);
    setExpandedCollections((prev) => new Set(prev).add(id));
    setNewCollectionName('');
    setShowNewCollectionInput(false);
  };

  const handleRename = (id: string) => {
    if (!editingName.trim()) return;
    renameCollection(id, editingName.trim());
    setEditingCollectionId(null);
    setEditingName('');
  };

  const loadRequest = (request: SavedRequest) => {
    const func: FunctionInfo = {
      name: request.functionPath.split(':').pop() || request.functionPath,
      path: request.functionPath,
      type: request.functionType,
      args: [],
    };

    setSelectedFunction(func);
    setArgs(request.args);
  };

  const loadFromHistory = (entry: HistoryEntry) => {
    const func: FunctionInfo = {
      name: entry.functionPath.split(':').pop() || entry.functionPath,
      path: entry.functionPath,
      type: entry.functionType,
      args: [],
    };

    setSelectedFunction(func);
    // Format JSON when loading from history
    try {
      const parsed = JSON.parse(entry.args);
      setArgs(JSON.stringify(parsed, null, 2));
    } catch {
      setArgs(entry.args);
    }
  };

  const saveHistoryToCollection = (entry: HistoryEntry) => {
    // Create default collection if none exists
    let targetCollectionId = collections[0]?.id;
    if (!targetCollectionId) {
      targetCollectionId = createCollection('Saved from History');
    }

    const name = `${entry.functionPath.split(':').pop()} - ${new Date(entry.timestamp).toLocaleString()}`;
    saveRequest(
      targetCollectionId,
      name,
      {
        functionPath: entry.functionPath,
        functionType: entry.functionType,
        args: entry.args,
      },
      entry.response
    );
  };

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `convex-devtools-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        importData(data);
      } catch (err) {
        console.error('Failed to import:', err);
        alert('Invalid export file');
      }
    };
    reader.readAsText(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const typeColors = {
    query: 'text-blue-400',
    mutation: 'text-orange-400',
    action: 'text-purple-400',
  };

  return (
    <div className='w-72 border-r border-convex-border flex flex-col bg-convex-darker'>
      {/* Header */}
      <div className='flex items-center justify-between p-4 border-b border-convex-border'>
        <h2 className='font-semibold'>Collections</h2>
        <div className='flex items-center gap-1'>
          <button
            onClick={handleExport}
            className='p-1.5 text-gray-400 hover:text-white hover:bg-convex-border rounded transition-colors'
            title='Export Collections'
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
                d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12'
              />
            </svg>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className='p-1.5 text-gray-400 hover:text-white hover:bg-convex-border rounded transition-colors'
            title='Import Collections'
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
                d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
              />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type='file'
            accept='.json'
            onChange={handleImport}
            className='hidden'
          />
          <button
            onClick={onClose}
            className='p-1.5 text-gray-400 hover:text-white hover:bg-convex-border rounded transition-colors'
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
      </div>

      {/* Tabs */}
      <div className='flex border-b border-convex-border'>
        <button
          onClick={() => setActiveTab('collections')}
          className={`flex-1 py-2 text-sm transition-colors ${
            activeTab === 'collections'
              ? 'text-white border-b-2 border-convex-accent'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Collections
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 text-sm transition-colors ${
            activeTab === 'history'
              ? 'text-white border-b-2 border-convex-accent'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          History
        </button>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-auto'>
        {activeTab === 'collections' ? (
          <div className='py-2'>
            {/* New Collection Button */}
            {showNewCollectionInput ? (
              <div className='px-3 py-2 flex items-center gap-2'>
                <input
                  type='text'
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateCollection();
                    if (e.key === 'Escape') {
                      setShowNewCollectionInput(false);
                      setNewCollectionName('');
                    }
                  }}
                  placeholder='Collection name'
                  autoFocus
                  className='flex-1 bg-convex-dark border border-convex-border rounded px-2 py-1 text-sm focus:outline-none focus:border-convex-accent'
                />
                <button
                  onClick={handleCreateCollection}
                  className='p-1 text-green-400 hover:text-green-300'
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
                      d='M5 13l4 4L19 7'
                    />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setShowNewCollectionInput(false);
                    setNewCollectionName('');
                  }}
                  className='p-1 text-gray-400 hover:text-white'
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
            ) : (
              <button
                onClick={() => setShowNewCollectionInput(true)}
                className='w-full px-3 py-2 flex items-center gap-2 text-sm text-gray-400 hover:text-white hover:bg-convex-border transition-colors'
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
                    d='M12 4v16m8-8H4'
                  />
                </svg>
                New Collection
              </button>
            )}

            {/* Collections List */}
            {(() => {
              // Group collections by folder
              const groups: Record<string, typeof collections> = {};
              collections.forEach((c) => {
                const key = c.folder || '';
                if (!groups[key]) groups[key] = [];
                groups[key].push(c);
              });

              return Object.keys(groups).map((folderName) => (
                <div key={folderName || '__no_folder__'}>
                  {folderName && (
                    <div className='px-3 py-2 text-xs text-gray-400 font-semibold uppercase tracking-wide'>
                      {folderName}
                    </div>
                  )}
                  {groups[folderName].map((collection) => (
                    <div key={collection.id}>
                      <div className='flex items-center group'>
                        {editingCollectionId === collection.id ? (
                          <div className='flex-1 px-3 py-1.5 flex items-center gap-2'>
                            <input
                              type='text'
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter')
                                  handleRename(collection.id);
                                if (e.key === 'Escape') {
                                  setEditingCollectionId(null);
                                  setEditingName('');
                                }
                              }}
                              autoFocus
                              className='flex-1 bg-convex-dark border border-convex-border rounded px-2 py-1 text-sm focus:outline-none focus:border-convex-accent'
                            />
                            <button
                              onClick={() => handleRename(collection.id)}
                              className='p-1 text-green-400 hover:text-green-300'
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
                                  d='M5 13l4 4L19 7'
                                />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => toggleCollection(collection.id)}
                              className='flex-1 px-3 py-1.5 flex items-center gap-2 text-sm text-left hover:bg-convex-border rounded-lg mx-1 transition-colors'
                            >
                              <svg
                                className={`w-4 h-4 text-gray-500 transition-transform ${
                                  expandedCollections.has(collection.id)
                                    ? 'rotate-90'
                                    : ''
                                }`}
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                              >
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  strokeWidth={2}
                                  d='M9 5l7 7-7 7'
                                />
                              </svg>
                              <svg
                                className='w-4 h-4 text-convex-accent'
                                fill='currentColor'
                                viewBox='0 0 24 24'
                              >
                                <path d='M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z' />
                              </svg>
                              <span className='text-gray-300'>
                                {collection.name}
                              </span>
                              <span className='text-xs text-gray-600'>
                                ({collection.requests.length})
                              </span>
                            </button>
                            <div className='pr-2 opacity-0 group-hover:opacity-100 flex items-center gap-1'>
                              <button
                                onClick={() => {
                                  setEditingCollectionId(collection.id);
                                  setEditingName(collection.name);
                                }}
                                className='p-1 text-gray-500 hover:text-white'
                                title='Rename'
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
                                    d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() => deleteCollection(collection.id)}
                                className='p-1 text-gray-500 hover:text-red-400'
                                title='Delete'
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
                                    d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                                  />
                                </svg>
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Requests */}
                      {expandedCollections.has(collection.id) && (
                        <div className='ml-6'>
                          {collection.requests.length === 0 ? (
                            <p className='px-3 py-2 text-xs text-gray-600'>
                              No saved requests
                            </p>
                          ) : (
                            collection.requests.map((request) => (
                              <div
                                key={request.id}
                                className='flex items-center group hover:bg-convex-border rounded-md mx-1 transition-colors'
                              >
                                <button
                                  onClick={() => loadRequest(request)}
                                  className='flex-1 px-3 py-1.5 flex items-center gap-2 text-sm text-left'
                                >
                                  <span
                                    className={`text-[10px] font-mono ${typeColors[request.functionType]}`}
                                  >
                                    {request.functionType
                                      .charAt(0)
                                      .toUpperCase()}
                                  </span>
                                  <span className='text-gray-400 truncate'>
                                    {request.name}
                                  </span>
                                </button>
                                <button
                                  onClick={() =>
                                    deleteRequest(collection.id, request.id)
                                  }
                                  className='pr-2 p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100'
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
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ));
            })()}

            {collections.length === 0 && !showNewCollectionInput && (
              <p className='px-4 py-8 text-center text-sm text-gray-600'>
                No collections yet.
                <br />
                Create one to save your requests.
              </p>
            )}
          </div>
        ) : (
          <div className='py-2'>
            {/* Clear History */}
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className='w-full px-3 py-2 flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 hover:bg-convex-border transition-colors'
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
                    d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                  />
                </svg>
                Clear History
              </button>
            )}

            {/* History List */}
            {history.map((entry) => (
              <div
                key={entry.id}
                className='flex items-start gap-2 px-3 py-2 hover:bg-convex-border rounded-md mx-1 transition-colors group'
              >
                <button
                  onClick={() => loadFromHistory(entry)}
                  className='flex-1 flex items-start gap-2 text-sm text-left'
                >
                  <span
                    className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded mt-0.5 ${typeColors[entry.functionType]} ${
                      entry.functionType === 'query'
                        ? 'bg-blue-900/30'
                        : entry.functionType === 'mutation'
                          ? 'bg-orange-900/30'
                          : 'bg-purple-900/30'
                    }`}
                  >
                    {entry.functionType.charAt(0).toUpperCase()}
                  </span>
                  <div className='flex-1 min-w-0'>
                    <p className='text-gray-300 truncate font-mono text-xs'>
                      {entry.functionPath}
                    </p>
                    <p className='text-xs text-gray-600'>
                      {new Date(entry.timestamp).toLocaleString(undefined, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                      {entry.response.success ? (
                        <span className='text-green-500 ml-2'>✓</span>
                      ) : (
                        <span className='text-red-500 ml-2'>✗</span>
                      )}
                    </p>
                  </div>
                </button>
                <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                  <button
                    onClick={() => saveHistoryToCollection(entry)}
                    className='p-1 text-gray-500 hover:text-convex-accent'
                    title='Save to collection'
                  >
                    <svg
                      className='w-3.5 h-3.5'
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
                    onClick={() => deleteHistoryEntry(entry.id)}
                    className='p-1 text-gray-500 hover:text-red-400'
                    title='Delete'
                  >
                    <svg
                      className='w-3.5 h-3.5'
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
              </div>
            ))}

            {history.length === 0 && (
              <p className='px-4 py-8 text-center text-sm text-gray-600'>
                No history yet.
                <br />
                Run some functions to see them here.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
