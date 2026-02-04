import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { InvokeResponse } from './request-store';

export interface SavedRequest {
  id: string;
  name: string;
  functionPath: string;
  functionType: 'query' | 'mutation' | 'action';
  args: string;
  lastResponse?: InvokeResponse;
  savedAt: string;
}

export interface Collection {
  id: string;
  name: string;
  folder?: string | null;
  requests: SavedRequest[];
  createdAt: string;
}

export interface Subfolder {
  id: string;
  name: string;
  parentId: string | null; // null means root level
  createdAt: string;
}

export interface HistoryEntry {
  id: string;
  projectName?: string;
  functionPath: string;
  functionType: 'query' | 'mutation' | 'action';
  args: string;
  response: InvokeResponse;
  timestamp: string;
}

export interface DataQueryHistoryEntry {
  id: string;
  projectName?: string;
  table: string;
  queryMode: 'json' | 'ui';
  queryText: string;
  uiFilters?: { field: string; op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'; value: string }[];
  uiOrder?: 'asc' | 'desc';
  response: InvokeResponse;
  timestamp: string;
}

export interface ExportData {
  version: '1.1.0';
  exportedAt: string;
  collections: Collection[];
}

const STORAGE_KEY = 'convex-devtools-data';
const TOKEN_STORAGE_KEY = 'convex-devtools-jwt-token';

interface PersistenceState {
  collections: Collection[];
  subfolders: Subfolder[];
  history: HistoryEntry[];
  dataHistory: DataQueryHistoryEntry[];
  savedToken: string;

  // Collection actions
  createCollection: (name: string, folder?: string | null) => string;
  deleteCollection: (id: string) => void;
  renameCollection: (id: string, name: string) => void;
  moveCollection: (id: string, newFolder: string | null) => void;

  // Subfolder actions
  createSubfolder: (name: string, parentId?: string | null) => string;
  deleteSubfolder: (id: string) => void;
  renameSubfolder: (id: string, name: string) => void;

  // Request actions
  saveRequest: (
    collectionId: string,
    name: string,
    request: {
      functionPath: string;
      functionType: 'query' | 'mutation' | 'action';
      args: string;
    },
    lastResponse?: InvokeResponse
  ) => void;
  deleteRequest: (collectionId: string, requestId: string) => void;
  updateRequest: (
    collectionId: string,
    requestId: string,
    updates: Partial<SavedRequest>
  ) => void;
  renameRequest: (
    collectionId: string,
    requestId: string,
    name: string
  ) => void;

  // Token persistence
  setSavedToken: (token: string) => void;
  loadSavedToken: () => string;

  // History actions
  addToHistory: (entry: Omit<HistoryEntry, 'id'>) => void;
  deleteHistoryEntry: (id: string) => void;
  clearHistory: () => void;
  addToDataHistory: (entry: Omit<DataQueryHistoryEntry, 'id'>) => void;
  deleteDataHistoryEntry: (id: string) => void;
  clearDataHistory: () => void;

  // Persistence actions
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;

  // Import/Export
  exportData: () => ExportData;
  importData: (data: ExportData) => void;
}

export const usePersistenceStore = create<PersistenceState>((set, get) => ({
  collections: [],
  subfolders: [],
  history: [],
  dataHistory: [],
  savedToken: '',

  createCollection: (name, folder) => {
    const id = nanoid();
    const collection: Collection = {
      id,
      name,
      folder: folder ?? null,
      requests: [],
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      collections: [...state.collections, collection],
    }));

    void get().saveToStorage();
    return id;
  },

  deleteCollection: (id) => {
    set((state) => ({
      collections: state.collections.filter((c) => c.id !== id),
    }));
    void get().saveToStorage();
  },

  renameCollection: (id, name) => {
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === id ? { ...c, name } : c
      ),
    }));
    void get().saveToStorage();
  },

  moveCollection: (id, newFolder) => {
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === id ? { ...c, folder: newFolder } : c
      ),
    }));
    void get().saveToStorage();
  },

  createSubfolder: (name, parentId) => {
    const id = nanoid();
    const subfolder: Subfolder = {
      id,
      name,
      parentId: parentId ?? null,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      subfolders: [...state.subfolders, subfolder],
    }));

    void get().saveToStorage();
    return id;
  },

  deleteSubfolder: (id) => {
    set((state) => {
      // Also move collections in this subfolder to root
      const updatedCollections = state.collections.map((c) =>
        c.folder === id ? { ...c, folder: null } : c
      );
      return {
        subfolders: state.subfolders.filter((s) => s.id !== id),
        collections: updatedCollections,
      };
    });
    void get().saveToStorage();
  },

  renameSubfolder: (id, name) => {
    set((state) => ({
      subfolders: state.subfolders.map((s) =>
        s.id === id ? { ...s, name } : s
      ),
    }));
    void get().saveToStorage();
  },

  // Save request with an optional response (useful for saving request+response snapshots)
  // Backwards-compatible: calling code can omit the lastResponse parameter.
  saveRequest: (collectionId, name, request, lastResponse) => {
    const savedRequest: SavedRequest = {
      id: nanoid(),
      name,
      ...request,
      lastResponse: lastResponse,
      savedAt: new Date().toISOString(),
    };

    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId
          ? { ...c, requests: [...c.requests, savedRequest] }
          : c
      ),
    }));
    void get().saveToStorage();
  },

  deleteRequest: (collectionId, requestId) => {
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId
          ? { ...c, requests: c.requests.filter((r) => r.id !== requestId) }
          : c
      ),
    }));
    void get().saveToStorage();
  },

  updateRequest: (collectionId, requestId, updates) => {
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId
          ? {
              ...c,
              requests: c.requests.map((r) =>
                r.id === requestId ? { ...r, ...updates } : r
              ),
            }
          : c
      ),
    }));
    void get().saveToStorage();
  },

  renameRequest: (collectionId, requestId, name) => {
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId
          ? {
              ...c,
              requests: c.requests.map((r) =>
                r.id === requestId ? { ...r, name } : r
              ),
            }
          : c
      ),
    }));
    void get().saveToStorage();
  },

  setSavedToken: (token) => {
    set({ savedToken: token });
    try {
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch (err) {
      console.error('Failed to save token to localStorage:', err);
    }
  },

  loadSavedToken: () => {
    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY) || '';
      set({ savedToken: token });
      return token;
    } catch (err) {
      console.error('Failed to load token from localStorage:', err);
      return '';
    }
  },

  addToHistory: (entry) => {
    const historyEntry: HistoryEntry = {
      id: nanoid(),
      ...entry,
    };

    set((state) => ({
      // Keep last 100 history entries
      history: [historyEntry, ...state.history].slice(0, 100),
    }));
    void get().saveToStorage();
  },

  deleteHistoryEntry: (id) => {
    set((state) => ({
      history: state.history.filter((h) => h.id !== id),
    }));
    void get().saveToStorage();
  },

  clearHistory: () => {
    set({ history: [] });
    void get().saveToStorage();
  },

  addToDataHistory: (entry) => {
    const historyEntry: DataQueryHistoryEntry = {
      id: nanoid(),
      ...entry,
    };

    set((state) => ({
      dataHistory: [historyEntry, ...state.dataHistory].slice(0, 100),
    }));
    void get().saveToStorage();
  },

  deleteDataHistoryEntry: (id) => {
    set((state) => ({
      dataHistory: state.dataHistory.filter((h) => h.id !== id),
    }));
    void get().saveToStorage();
  },

  clearDataHistory: () => {
    set({ dataHistory: [] });
    void get().saveToStorage();
  },

  loadFromStorage: async () => {
    try {
      const response = await fetch('/api/persistence');
      if (response.ok) {
        const data = await response.json();
        set({
          collections: Array.isArray(data.collections) ? data.collections : [],
          subfolders: Array.isArray(data.subfolders) ? data.subfolders : [],
          history: Array.isArray(data.history) ? data.history : [],
          dataHistory: Array.isArray(data.dataHistory) ? data.dataHistory : [],
        });
        return;
      }
    } catch (err) {
      console.error('Failed to load from server storage:', err);
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        set({
          collections: data.collections || [],
          subfolders: data.subfolders || [],
          history: data.history || [],
          dataHistory: data.dataHistory || [],
        });
      }
    } catch (err) {
      console.error('Failed to load from local storage:', err);
    }
  },

  saveToStorage: async () => {
    try {
      const { collections, subfolders, history, dataHistory } = get();
      const response = await fetch('/api/persistence', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collections, subfolders, history, dataHistory }),
      });
      if (response.ok) {
        return;
      }
    } catch (err) {
      console.error('Failed to save to server storage:', err);
    }

    try {
      const { collections, subfolders, history, dataHistory } = get();
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ collections, subfolders, history, dataHistory })
      );
    } catch (err) {
      console.error('Failed to save to local storage:', err);
    }
  },

  exportData: () => {
    const { collections } = get();
    return {
      version: '1.1.0' as const,
      exportedAt: new Date().toISOString(),
      collections,
    };
  },

  importData: (data) => {
    if (data.version !== '1.1.0') {
      throw new Error(`Unsupported export version: ${data.version}`);
    }

    set((state) => {
      // Merge collections, avoiding duplicates by ID
      const existingIds = new Set(state.collections.map((c) => c.id));
      const newCollections = data.collections.filter(
        (c) => !existingIds.has(c.id)
      );

      return {
        collections: [...state.collections, ...newCollections],
      };
    });
    void get().saveToStorage();
  },
}));
