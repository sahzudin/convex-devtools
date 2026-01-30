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

export interface HistoryEntry {
  id: string;
  functionPath: string;
  functionType: 'query' | 'mutation' | 'action';
  args: string;
  response: InvokeResponse;
  timestamp: string;
}

export interface ExportData {
  version: '1.0';
  exportedAt: string;
  collections: Collection[];
}

const STORAGE_KEY = 'convex-devtools-data';

interface PersistenceState {
  collections: Collection[];
  history: HistoryEntry[];

  // Collection actions
  createCollection: (name: string, folder?: string | null) => string;
  deleteCollection: (id: string) => void;
  renameCollection: (id: string, name: string) => void;

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

  // History actions
  addToHistory: (entry: Omit<HistoryEntry, 'id'>) => void;
  deleteHistoryEntry: (id: string) => void;
  clearHistory: () => void;

  // Persistence actions
  loadFromStorage: () => void;
  saveToStorage: () => void;

  // Import/Export
  exportData: () => ExportData;
  importData: (data: ExportData) => void;
}

export const usePersistenceStore = create<PersistenceState>((set, get) => ({
  collections: [],
  history: [],

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

    get().saveToStorage();
    return id;
  },

  deleteCollection: (id) => {
    set((state) => ({
      collections: state.collections.filter((c) => c.id !== id),
    }));
    get().saveToStorage();
  },

  renameCollection: (id, name) => {
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === id ? { ...c, name } : c
      ),
    }));
    get().saveToStorage();
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
    get().saveToStorage();
  },

  deleteRequest: (collectionId, requestId) => {
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId
          ? { ...c, requests: c.requests.filter((r) => r.id !== requestId) }
          : c
      ),
    }));
    get().saveToStorage();
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
    get().saveToStorage();
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
    get().saveToStorage();
  },

  deleteHistoryEntry: (id) => {
    set((state) => ({
      history: state.history.filter((h) => h.id !== id),
    }));
    get().saveToStorage();
  },

  clearHistory: () => {
    set({ history: [] });
    get().saveToStorage();
  },

  loadFromStorage: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        set({
          collections: data.collections || [],
          history: data.history || [],
        });
      }
    } catch (err) {
      console.error('Failed to load from storage:', err);
    }
  },

  saveToStorage: () => {
    try {
      const { collections, history } = get();
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ collections, history })
      );
    } catch (err) {
      console.error('Failed to save to storage:', err);
    }
  },

  exportData: () => {
    const { collections } = get();
    return {
      version: '1.0' as const,
      exportedAt: new Date().toISOString(),
      collections,
    };
  },

  importData: (data) => {
    if (data.version !== '1.0') {
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
    get().saveToStorage();
  },
}));
