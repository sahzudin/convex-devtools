import { useState, useRef, useMemo } from 'react';
import {
  usePersistenceStore,
  SavedRequest,
  HistoryEntry,
  // Subfolder - available for future subfolder feature
} from '../stores/persistence-store';
import { useRequestStore } from '../stores/request-store';
import { FunctionInfo } from '../stores/schema-store';

interface CollectionsSidebarProps {
  onClose: () => void;
}

export function CollectionsSidebar({ onClose }: CollectionsSidebarProps) {
  const {
    collections,
    // subfolders - available for future subfolder feature
    history,
    createCollection,
    deleteCollection,
    renameCollection,
    // createSubfolder - available for future subfolder feature
    // deleteSubfolder - available for future subfolder feature
    // renameSubfolder - available for future subfolder feature
    deleteRequest,
    renameRequest,
    deleteHistoryEntry,
    saveRequest,
    clearHistory,
    exportData,
    importData,
  } = usePersistenceStore();

  const { setSelectedFunction, setArgs, setResponse } = useRequestStore();

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
  const [editingRequestId, setEditingRequestId] = useState<{
    collectionId: string;
    requestId: string;
  } | null>(null);
  const [editingName, setEditingName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
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
    const id = createCollection(newCollectionName.trim());
    setExpandedCollections((prev) => new Set(prev).add(id));
    setNewCollectionName('');
    setShowNewCollectionInput(false);
  };

  const handleRenameCollection = (id: string) => {
    if (!editingName.trim()) return;
    renameCollection(id, editingName.trim());
    setEditingCollectionId(null);
    setEditingName('');
  };

  const handleRenameRequest = () => {
    if (!editingRequestId || !editingName.trim()) return;
    renameRequest(
      editingRequestId.collectionId,
      editingRequestId.requestId,
      editingName.trim()
    );
    setEditingRequestId(null);
    setEditingName('');
  };

  const loadRequest = (request: SavedRequest) => {
    const func: FunctionInfo = {
      name: request.functionPath.split(':').pop() || request.functionPath,
      path: request.functionPath,
      type: request.functionType,
      args: [],
    };

    // Use loadFromSaved to bypass draft restoration and load exact saved state
    useRequestStore
      .getState()
      .loadFromSaved(func, request.args, request.lastResponse || null);
  };

  const loadFromHistory = (entry: HistoryEntry) => {
    const func: FunctionInfo = {
      name: entry.functionPath.split(':').pop() || entry.functionPath,
      path: entry.functionPath,
      type: entry.functionType,
      args: [],
    };

    setSelectedFunction(func);
    setResponse(entry.response || null);
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

  // Filter collections and requests based on search query
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) {
      return { collections };
    }

    const query = searchQuery.toLowerCase();
    const filteredCollections = collections
      .map((collection) => {
        const matchingRequests = collection.requests.filter(
          (r) =>
            r.name.toLowerCase().includes(query) ||
            r.functionPath.toLowerCase().includes(query)
        );
        const collectionMatches = collection.name.toLowerCase().includes(query);

        if (matchingRequests.length > 0 || collectionMatches) {
          return {
            ...collection,
            requests: collectionMatches
              ? collection.requests
              : matchingRequests,
          };
        }
        return null;
      })
      .filter(Boolean) as typeof collections;

    return { collections: filteredCollections };
  }, [collections, searchQuery]);

  // Filter history based on search query
  const filteredHistory = useMemo(() => {
    if (!historySearchQuery.trim()) {
      return history;
    }
    const query = historySearchQuery.toLowerCase();
    return history.filter((entry) =>
      entry.functionPath.toLowerCase().includes(query)
    );
  }, [history, historySearchQuery]);

  const typeColors = {
    query: 'text-blue-400',
    mutation: 'text-orange-400',
    action: 'text-purple-400',
  };

  // Trash icon component
  const TrashIcon = ({ className = 'w-3 h-3' }: { className?: string }) => (
    <svg
      className={className}
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
  );

  // Edit/Pencil icon component
  const EditIcon = ({ className = 'w-3 h-3' }: { className?: string }) => (
    <svg
      className={className}
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
  );

  return (
    <div className='w-72 border-r border-convex-border flex flex-col bg-convex-darker overflow-hidden'>
      {/* Header - Tabs with action buttons */}
      <div className='flex items-center justify-between px-3 h-14 border-b border-convex-border flex-shrink-0'>
        <div className='flex items-center gap-1'>
          <button
            onClick={() => setActiveTab('collections')}
            className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
              activeTab === 'collections'
                ? 'bg-gray-300 dark:bg-convex-border text-gray-900 dark:text-white'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-convex-border/50'
            }`}
          >
            Collections
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
              activeTab === 'history'
                ? 'bg-gray-300 dark:bg-convex-border text-gray-900 dark:text-white'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-convex-border/50'
            }`}
          >
            History
          </button>
        </div>
        <div className='flex items-center'>
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

      {/* Search Bar - Same style as FunctionTree */}
      <div className='px-3 h-14 border-b border-convex-border flex-shrink-0 flex items-center'>
        <div className='relative w-full'>
          <svg
            className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500'
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
            value={
              activeTab === 'collections' ? searchQuery : historySearchQuery
            }
            onChange={(e) =>
              activeTab === 'collections'
                ? setSearchQuery(e.target.value)
                : setHistorySearchQuery(e.target.value)
            }
            placeholder={
              activeTab === 'collections'
                ? 'Search collections...'
                : 'Search history...'
            }
            className='w-full bg-convex-darker border border-convex-border rounded-lg pl-10 pr-3 py-1.5 text-sm focus:outline-none focus:border-convex-accent'
          />
        </div>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-auto'>
        {activeTab === 'collections' ? (
          <div className='py-1'>
            {/* New Collection/Subfolder Buttons */}
            {showNewCollectionInput ? (
              <div className='px-2 py-1.5 flex items-center gap-2'>
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
                className='w-full px-3 py-1.5 flex items-center gap-2 text-sm text-gray-400 hover:text-white hover:bg-convex-border transition-colors'
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
            {filteredData.collections.map((collection) => (
              <div key={collection.id}>
                <div className='flex items-center group'>
                  {editingCollectionId === collection.id ? (
                    <div className='flex-1 px-2 py-1 flex items-center gap-2'>
                      <input
                        type='text'
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter')
                            handleRenameCollection(collection.id);
                          if (e.key === 'Escape') {
                            setEditingCollectionId(null);
                            setEditingName('');
                          }
                        }}
                        autoFocus
                        className='flex-1 bg-convex-dark border border-convex-border rounded px-2 py-1 text-sm focus:outline-none focus:border-convex-accent'
                      />
                      <button
                        onClick={() => handleRenameCollection(collection.id)}
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
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => toggleCollection(collection.id)}
                        className='flex-1 px-2 py-1.5 flex items-center gap-2 text-sm text-left hover:bg-convex-border rounded mx-1 transition-colors overflow-hidden'
                      >
                        <svg
                          className={`w-3.5 h-3.5 text-gray-500 transition-transform flex-shrink-0 ${
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
                          className='w-4 h-4 text-convex-accent flex-shrink-0'
                          fill='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path d='M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z' />
                        </svg>
                        <span className='text-gray-300 truncate'>
                          {collection.name}
                        </span>
                        <span className='text-xs text-gray-600 flex-shrink-0'>
                          ({collection.requests.length})
                        </span>
                      </button>
                      <div className='pr-1 opacity-0 group-hover:opacity-100 flex items-center flex-shrink-0'>
                        <button
                          onClick={() => {
                            setEditingCollectionId(collection.id);
                            setEditingName(collection.name);
                          }}
                          className='p-1 text-gray-500 hover:text-white'
                          title='Rename'
                        >
                          <EditIcon />
                        </button>
                        <button
                          onClick={() => deleteCollection(collection.id)}
                          className='p-1 text-gray-500 hover:text-red-400'
                          title='Delete'
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Requests */}
                {expandedCollections.has(collection.id) && (
                  <div className='ml-5'>
                    {collection.requests.length === 0 ? (
                      <p className='px-2 py-1 text-xs text-gray-600'>
                        No saved requests
                      </p>
                    ) : (
                      collection.requests.map((request) => (
                        <div
                          key={request.id}
                          className='flex items-center group hover:bg-convex-border rounded mx-1 transition-colors'
                        >
                          {editingRequestId?.collectionId === collection.id &&
                          editingRequestId?.requestId === request.id ? (
                            <div className='flex-1 px-2 py-1 flex items-center gap-2'>
                              <input
                                type='text'
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenameRequest();
                                  if (e.key === 'Escape') {
                                    setEditingRequestId(null);
                                    setEditingName('');
                                  }
                                }}
                                autoFocus
                                className='flex-1 bg-convex-dark border border-convex-border rounded px-2 py-1 text-sm focus:outline-none focus:border-convex-accent'
                              />
                              <button
                                onClick={() => handleRenameRequest()}
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
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => loadRequest(request)}
                                className='flex-1 px-2 py-1 flex items-center gap-2 text-sm text-left overflow-hidden'
                              >
                                <span
                                  className={`text-xs font-mono flex-shrink-0 ${typeColors[request.functionType]}`}
                                >
                                  {request.functionType.charAt(0).toUpperCase()}
                                </span>
                                <span className='text-gray-400 truncate'>
                                  {request.name}
                                </span>
                              </button>
                              <div className='pr-1 opacity-0 group-hover:opacity-100 flex items-center flex-shrink-0'>
                                <button
                                  onClick={() => {
                                    setEditingRequestId({
                                      collectionId: collection.id,
                                      requestId: request.id,
                                    });
                                    setEditingName(request.name);
                                  }}
                                  className='p-1 text-gray-500 hover:text-white'
                                  title='Rename'
                                >
                                  <EditIcon />
                                </button>
                                <button
                                  onClick={() =>
                                    deleteRequest(collection.id, request.id)
                                  }
                                  className='p-1 text-gray-500 hover:text-red-400'
                                  title='Delete'
                                >
                                  <TrashIcon />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}

            {filteredData.collections.length === 0 &&
              !showNewCollectionInput && (
                <p className='px-4 py-8 text-center text-sm text-gray-600'>
                  {searchQuery ? (
                    <>No results found for "{searchQuery}"</>
                  ) : (
                    <>
                      No collections yet.
                      <br />
                      Create one to save your requests.
                    </>
                  )}
                </p>
              )}
          </div>
        ) : (
          <div className='py-2'>
            {/* Clear History */}
            {filteredHistory.length > 0 && (
              <button
                onClick={clearHistory}
                className='w-full px-3 py-1.5 flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 hover:bg-convex-border transition-colors'
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
            {filteredHistory.map((entry) => {
              // Check if the response indicates an error - same logic as ResponsePanel
              const isError =
                !entry.response.success ||
                (entry.response.success &&
                  entry.response.result &&
                  typeof entry.response.result === 'object' &&
                  (entry.response.result as Record<string, unknown>)?.status ===
                    'error');

              return (
                <button
                  key={entry.id}
                  onClick={() => loadFromHistory(entry)}
                  className='w-full px-3 py-2 hover:bg-convex-border transition-colors text-left'
                >
                  {/* Function path with type badge */}
                  <div className='flex items-start gap-2'>
                    <span
                      className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${typeColors[entry.functionType]} ${
                        entry.functionType === 'query'
                          ? 'bg-blue-900/30'
                          : entry.functionType === 'mutation'
                            ? 'bg-orange-900/30'
                            : 'bg-purple-900/30'
                      }`}
                    >
                      {entry.functionType.charAt(0).toUpperCase()}
                    </span>
                    <span className='text-gray-300 font-mono text-sm break-all'>
                      {entry.functionPath}
                    </span>
                  </div>
                  {/* Time and status on left, action buttons on right */}
                  <div className='flex items-center justify-between mt-1.5 pl-6'>
                    <div className='flex items-center gap-2 text-xs text-gray-500'>
                      <span>
                        {new Date(entry.timestamp).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                      {!isError ? (
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
                      ) : (
                        <svg
                          className='w-4 h-4 text-red-400'
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
                      )}
                    </div>
                    <div className='flex items-center gap-1'>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          saveHistoryToCollection(entry);
                        }}
                        className='p-1 text-gray-500 hover:text-blue-500 dark:hover:text-convex-accent rounded hover:bg-gray-200 dark:hover:bg-convex-border cursor-pointer'
                        title='Save to collection'
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
                      </span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteHistoryEntry(entry.id);
                        }}
                        className='p-1 text-gray-500 hover:text-red-500 dark:hover:text-red-400 rounded hover:bg-gray-200 dark:hover:bg-convex-border cursor-pointer'
                        title='Delete'
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
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}

            {filteredHistory.length === 0 && history.length > 0 && (
              <p className='px-4 py-8 text-center text-sm text-gray-600'>
                No results found for "{historySearchQuery}"
              </p>
            )}

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
