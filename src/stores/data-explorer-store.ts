import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { InvokeResponse } from './request-store';
import { usePersistenceStore } from './persistence-store';

interface PageInfo {
  cursor: string | null;
  hasNextPage: boolean;
}

type DataInvokeResponse = InvokeResponse & { pageInfo?: PageInfo };
type QueryMode = 'json' | 'ui';

interface UiFilter {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
  value: string;
}

interface DataQueryTab {
  id: string;
  table: string;
  queryMode: QueryMode;
  queryText: string;
  uiFilters?: UiFilter[];
  uiOrder?: 'asc' | 'desc';
  response: DataInvokeResponse | null;
  createdAt: string;
}

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const COLUMNS_STORAGE_KEY = 'convex-devtools-columns';
const PAGE_SIZE_STORAGE_KEY = 'convex-devtools-page-size';
const DATA_TABS_STORAGE_KEY = 'convex-devtools-data-tabs';

const defaultQueryText = (table?: string) =>
  JSON.stringify(
    {
      table: table || '',
      filters: [],
      order: 'desc',
    },
    null,
    2
  );

const loadColumns = (): Record<string, string[]> => {
  try {
    const stored = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
};

const saveColumns = (columnsByTable: Record<string, string[]>) => {
  try {
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(columnsByTable));
  } catch {}
};

const loadPageSize = (): number => {
  try {
    const stored = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    if (stored) {
      const parsed = Number(stored);
      if (PAGE_SIZE_OPTIONS.includes(parsed)) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_PAGE_SIZE;
};

const savePageSize = (pageSize: number) => {
  try {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));
  } catch {}
};

const loadDataTabs = (): DataQueryTab[] => {
  try {
    const stored = localStorage.getItem(DATA_TABS_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
};

const saveDataTabs = (tabs: DataQueryTab[]) => {
  try {
    localStorage.setItem(DATA_TABS_STORAGE_KEY, JSON.stringify(tabs));
  } catch {}
};

interface DataExplorerState {
  selectedTable: string | null;
  queryText: string;
  response: DataInvokeResponse | null;
  isLoading: boolean;
  isQueryValid: boolean;
  queryError: string | null;
  helperInstalled: boolean | null;
  helperError: string | null;
  queryMode: QueryMode;
  uiFilters: UiFilter[];
  uiOrder: 'asc' | 'desc';
  columnsByTable: Record<string, string[]>;
  pageSize: number;
  pageCursor: string | null;
  nextCursor: string | null;
  hasNextPage: boolean;
  cursorStack: (string | null)[];
  clientPageIndex: number;
  recentTabs: DataQueryTab[];
  setSelectedTable: (table: string | null) => void;
  setQueryText: (text: string) => void;
  setQueryMode: (mode: QueryMode) => void;
  addUiFilter: () => void;
  updateUiFilter: (index: number, update: Partial<UiFilter>) => void;
  removeUiFilter: (index: number) => void;
  setUiFilters: (filters: UiFilter[]) => void;
  setUiOrder: (order: 'asc' | 'desc') => void;
  setColumnsForTable: (table: string, columns: string[]) => void;
  toggleColumn: (table: string, column: string) => void;
  clearColumns: (table: string) => void;
  resetPagination: () => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setClientPageIndex: (index: number) => void;
  setResponse: (response: DataInvokeResponse | null) => void;
  addToRecentTabs: (tab: Omit<DataQueryTab, 'id' | 'createdAt'>) => void;
  removeFromRecentTabs: (id: string) => void;
  checkHelper: () => Promise<void>;
  installHelper: () => Promise<void>;
  runQuery: (jwtToken?: string) => Promise<void>;
  clearResponse: () => void;
}

export const useDataExplorerStore = create<DataExplorerState>((set, get) => ({
  selectedTable: null,
  queryText: defaultQueryText(),
  response: null,
  isLoading: false,
  isQueryValid: true,
  queryError: null,
  helperInstalled: null,
  helperError: null,
  queryMode: 'json',
  uiFilters: [],
  uiOrder: 'desc',
  columnsByTable: loadColumns(),
  pageSize: loadPageSize(),
  pageCursor: null,
  nextCursor: null,
  hasNextPage: false,
  cursorStack: [],
  clientPageIndex: 0,
  recentTabs: loadDataTabs(),

  setSelectedTable: (table) => {
    const { queryText } = get();
    if (!table) {
      set({ selectedTable: null });
      return;
    }

    try {
      const parsed = JSON.parse(queryText || '{}');
      parsed.table = table;
      set({
        selectedTable: table,
        queryText: JSON.stringify(parsed, null, 2),
        isQueryValid: true,
        queryError: null,
        pageCursor: null,
        nextCursor: null,
        hasNextPage: false,
        cursorStack: [],
        clientPageIndex: 0,
      });
    } catch {
      set({
        selectedTable: table,
        queryText: defaultQueryText(table),
        isQueryValid: true,
        queryError: null,
        pageCursor: null,
        nextCursor: null,
        hasNextPage: false,
        cursorStack: [],
        clientPageIndex: 0,
      });
    }
    if (get().queryMode === 'ui') {
      const { uiFilters, uiOrder } = get();
      set({
        queryText: JSON.stringify(buildJsonQuery(table, uiFilters, uiOrder), null, 2),
        isQueryValid: true,
        queryError: null,
      });
    }
  },

  setQueryText: (text) => {
    try {
      JSON.parse(text);
      set({
        queryText: text,
        isQueryValid: true,
        queryError: null,
        pageCursor: null,
        nextCursor: null,
        hasNextPage: false,
        cursorStack: [],
        clientPageIndex: 0,
      });
    } catch (error: any) {
      set({
        queryText: text,
        isQueryValid: false,
        queryError: error?.message || 'Invalid JSON',
      });
    }
  },

  setQueryMode: (mode) => {
    set({ queryMode: mode });
    if (mode === 'ui') {
      const { selectedTable, uiFilters, uiOrder } = get();
      if (!selectedTable) return;
      const nextQuery = buildJsonQuery(selectedTable, uiFilters, uiOrder);
      set({
        queryText: JSON.stringify(nextQuery, null, 2),
        isQueryValid: true,
        queryError: null,
      });
    }
  },

  addUiFilter: () =>
    set((state) => {
      const uiFilters: UiFilter[] = [
        ...state.uiFilters,
        { field: '', op: 'eq', value: '' },
      ];
      const nextState = {
        uiFilters,
        pageCursor: null,
        nextCursor: null,
        hasNextPage: false,
        cursorStack: [],
        clientPageIndex: 0,
      };
      if (state.queryMode === 'ui' && state.selectedTable) {
        return {
          ...nextState,
          queryText: JSON.stringify(
            buildJsonQuery(state.selectedTable, uiFilters, state.uiOrder),
            null,
            2
          ),
          isQueryValid: true,
          queryError: null,
        };
      }
      return nextState;
    }),

  updateUiFilter: (index, update) =>
    set((state) => {
      const next: UiFilter[] = [...state.uiFilters];
      next[index] = {
        ...next[index],
        ...(update as Partial<UiFilter>),
      };
      const nextState = {
        uiFilters: next,
        pageCursor: null,
        nextCursor: null,
        hasNextPage: false,
        cursorStack: [],
        clientPageIndex: 0,
      };
      if (state.queryMode === 'ui' && state.selectedTable) {
        return {
          ...nextState,
          queryText: JSON.stringify(
            buildJsonQuery(state.selectedTable, next, state.uiOrder),
            null,
            2
          ),
          isQueryValid: true,
          queryError: null,
        };
      }
      return nextState;
    }),

  removeUiFilter: (index) =>
    set((state) => {
      const next: UiFilter[] = state.uiFilters.filter((_, i) => i !== index);
      const nextState = {
        uiFilters: next,
        pageCursor: null,
        nextCursor: null,
        hasNextPage: false,
        cursorStack: [],
        clientPageIndex: 0,
      };
      if (state.queryMode === 'ui' && state.selectedTable) {
        return {
          ...nextState,
          queryText: JSON.stringify(
            buildJsonQuery(state.selectedTable, next, state.uiOrder),
            null,
            2
          ),
          isQueryValid: true,
          queryError: null,
        };
      }
      return nextState;
    }),

  setUiFilters: (filters) =>
    set((state) => {
      const nextState = {
        uiFilters: filters,
        pageCursor: null,
        nextCursor: null,
        hasNextPage: false,
        cursorStack: [],
        clientPageIndex: 0,
      };
      if (state.queryMode === 'ui' && state.selectedTable) {
        return {
          ...nextState,
          queryText: JSON.stringify(
            buildJsonQuery(state.selectedTable, filters, state.uiOrder),
            null,
            2
          ),
          isQueryValid: true,
          queryError: null,
        };
      }
      return nextState;
    }),

  setUiOrder: (order) =>
    set((state) => {
      const nextState = {
        uiOrder: order,
        pageCursor: null,
        nextCursor: null,
        hasNextPage: false,
        cursorStack: [],
        clientPageIndex: 0,
      };
      if (state.queryMode === 'ui' && state.selectedTable) {
        return {
          ...nextState,
          queryText: JSON.stringify(
            buildJsonQuery(state.selectedTable, state.uiFilters, order),
            null,
            2
          ),
          isQueryValid: true,
          queryError: null,
        };
      }
      return nextState;
    }),

  setColumnsForTable: (table, columns) => {
    const columnsByTable = {
      ...get().columnsByTable,
      [table]: columns,
    };
    saveColumns(columnsByTable);
    set({ columnsByTable });
  },

  toggleColumn: (table, column) => {
    const current = get().columnsByTable[table] || [];
    const exists = current.includes(column);
    const next = exists
      ? current.filter((c) => c !== column)
      : [...current, column];
    const columnsByTable = {
      ...get().columnsByTable,
      [table]: next,
    };
    saveColumns(columnsByTable);
    set({ columnsByTable });
  },

  clearColumns: (table) => {
    const columnsByTable = {
      ...get().columnsByTable,
      [table]: [],
    };
    saveColumns(columnsByTable);
    set({ columnsByTable });
  },

  resetPagination: () =>
    set({
      pageCursor: null,
      nextCursor: null,
      hasNextPage: false,
      cursorStack: [],
      clientPageIndex: 0,
    }),

  setPageSize: (size) => {
    if (!PAGE_SIZE_OPTIONS.includes(size)) return;
    savePageSize(size);
    set({
      pageSize: size,
      pageCursor: null,
      nextCursor: null,
      hasNextPage: false,
      cursorStack: [],
      clientPageIndex: 0,
    });
  },

  nextPage: () => {
    const { nextCursor, pageCursor, cursorStack } = get();
    if (!nextCursor) return;
    set({
      pageCursor: nextCursor,
      cursorStack: [...cursorStack, pageCursor ?? null],
    });
  },

  prevPage: () => {
    const { cursorStack } = get();
    if (cursorStack.length === 0) return;
    const nextStack = [...cursorStack];
    const previousCursor = nextStack.pop() ?? null;
    set({
      pageCursor: previousCursor,
      cursorStack: nextStack,
    });
  },

  setClientPageIndex: (index) => set({ clientPageIndex: index }),

  setResponse: (response) => set({ response }),

  addToRecentTabs: (tab) => {
    const { recentTabs } = get();
    const existingIndex = recentTabs.findIndex(
      (t) => t.table === tab.table && t.queryText === tab.queryText
    );
    if (existingIndex !== -1) {
      const updated = [...recentTabs];
      const existing = updated.splice(existingIndex, 1)[0];
      const nextTabs = [{ ...existing, ...tab, createdAt: existing.createdAt }, ...updated].slice(
        0,
        10
      );
      set({ recentTabs: nextTabs });
      saveDataTabs(nextTabs);
      return;
    }

    const nextTabs = [
      {
        id: nanoid(),
        createdAt: new Date().toISOString(),
        ...tab,
      },
      ...recentTabs,
    ].slice(0, 10);
    set({ recentTabs: nextTabs });
    saveDataTabs(nextTabs);
  },

  removeFromRecentTabs: (id) => {
    const nextTabs = get().recentTabs.filter((t) => t.id !== id);
    set({ recentTabs: nextTabs });
    saveDataTabs(nextTabs);
  },

  checkHelper: async () => {
    try {
      const res = await fetch('/api/devtools/status');
      const data = await res.json();
      set({
        helperInstalled: !!data.installed,
        helperError: null,
      });
    } catch (error: any) {
      set({
        helperInstalled: false,
        helperError: error?.message || 'Failed to check helper status',
      });
    }
  },

  installHelper: async () => {
    set({ helperError: null });
    try {
      const res = await fetch('/api/devtools/install', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data?.installed !== true) {
        throw new Error(data?.error || 'Failed to install helper');
      }
      set({ helperInstalled: true, helperError: null });
    } catch (error: any) {
      set({
        helperInstalled: false,
        helperError: error?.message || 'Failed to install helper',
      });
    }
  },

  runQuery: async (jwtToken?: string) => {
    const {
      queryText,
      isQueryValid,
      pageSize,
      pageCursor,
      queryMode,
      selectedTable,
      uiFilters,
      uiOrder,
    } = get();
    if (queryMode === 'json' && !isQueryValid) {
      return;
    }

    let parsed: Record<string, unknown> = {};
    if (queryMode === 'json') {
      try {
        parsed = JSON.parse(queryText);
      } catch (error: any) {
        set({
          response: {
            success: false,
            error: { message: error?.message || 'Invalid JSON in query' },
            timestamp: new Date().toISOString(),
          },
          isLoading: false,
        });
        return;
      }
    } else {
      if (!selectedTable) {
        set({
          response: {
            success: false,
            error: { message: 'Select a table in the schema explorer' },
            timestamp: new Date().toISOString(),
          },
          isLoading: false,
        });
        return;
      }
      const filters = uiFilters
        .filter((f) => f.field && f.op && f.value !== '')
        .map((f) => ({
          field: f.field,
          op: f.op,
          value: parseUiValue(f.value),
        }));
      parsed = {
        table: selectedTable,
        filters,
        order: uiOrder,
      };
    }

    set({ isLoading: true });

    try {
      const shouldPaginate = true;
      const parsedPagination =
        parsed &&
        typeof parsed === 'object' &&
        'pagination' in parsed
          ? (parsed as { pagination?: { cursor?: string | null; numItems?: number } })
              .pagination
          : undefined;

      const response = await fetch('/api/devtools/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...parsed,
          pagination: shouldPaginate
            ? {
                cursor: parsedPagination?.cursor ?? pageCursor ?? null,
                numItems: parsedPagination?.numItems ?? pageSize,
              }
            : undefined,
          jwtToken: jwtToken || undefined,
        }),
      });

      const data = await response.json();
      const normalized = { ...data } as unknown as DataInvokeResponse & {
        error?: unknown;
      };

      if (!('success' in (normalized as any))) {
        (normalized as any).success = response.ok;
      }
      if (typeof normalized.error === 'string') {
        normalized.error = { message: normalized.error };
      } else if (
        normalized.error &&
        typeof normalized.error === 'object' &&
        !(normalized.error as any).message
      ) {
        normalized.error = {
          message: JSON.stringify(normalized.error),
        };
      }

      if (
        normalized?.result &&
        typeof normalized.result === 'object' &&
        'status' in (normalized.result as Record<string, unknown>) &&
        (normalized.result as { status?: string }).status === 'success' &&
        'value' in (normalized.result as Record<string, unknown>)
      ) {
        const value = (normalized.result as { value?: unknown }).value;
        if (
          value &&
          typeof value === 'object' &&
          'page' in (value as Record<string, unknown>)
        ) {
          normalized.result = (value as { page?: unknown }).page;
        } else {
          normalized.result = value;
        }
        if (
          value &&
          typeof value === 'object' &&
          'continueCursor' in (value as Record<string, unknown>)
        ) {
          const cursor = (value as { continueCursor?: string | null })
            .continueCursor ?? null;
          const isDone = !!(value as { isDone?: boolean }).isDone;
          normalized.pageInfo = { cursor, hasNextPage: !isDone };
        }
      } else if (
        normalized?.result &&
        typeof normalized.result === 'object' &&
        'page' in (normalized.result as Record<string, unknown>)
      ) {
        normalized.result = (normalized.result as { page?: unknown }).page;
      }

      const pageInfo = normalized?.pageInfo as PageInfo | undefined;
      set({
        response: normalized,
        isLoading: false,
        nextCursor: pageInfo?.cursor ?? null,
        hasNextPage: pageInfo?.hasNextPage ?? false,
      });

      const table =
        queryMode === 'json'
          ? String((parsed as Record<string, unknown>).table || '')
          : selectedTable || '';
      if (table) {
        get().addToRecentTabs({
          table,
          queryMode,
          queryText,
          uiFilters: queryMode === 'ui' ? uiFilters : undefined,
          uiOrder: queryMode === 'ui' ? uiOrder : undefined,
          response: normalized,
        });
      }

      const tableForHistory =
        queryMode === 'json'
          ? String((parsed as Record<string, unknown>).table || '')
          : selectedTable || '';
      if (tableForHistory) {
        usePersistenceStore.getState().addToDataHistory({
          projectName: undefined,
          table: tableForHistory,
          queryMode,
          queryText,
          uiFilters: queryMode === 'ui' ? uiFilters : undefined,
          uiOrder: queryMode === 'ui' ? uiOrder : undefined,
          response: normalized,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      set({
        isLoading: false,
        response: {
          success: false,
          error: { message: error?.message || 'Request failed' },
          timestamp: new Date().toISOString(),
        },
        nextCursor: null,
        hasNextPage: false,
      });
    }
  },

  clearResponse: () => set({ response: null }),
}));

export { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS };

const parseUiValue = (value: string): unknown => {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (!Number.isNaN(Number(trimmed)) && trimmed.match(/^-?\d+(\.\d+)?$/)) {
    return Number(trimmed);
  }
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
};

const buildJsonQuery = (
  table: string,
  filters: UiFilter[],
  order: 'asc' | 'desc'
): Record<string, unknown> => {
  const builtFilters = filters
    .filter((f) => f.field && f.op && f.value !== '')
    .map((f) => ({
      field: f.field,
      op: f.op,
      value: parseUiValue(f.value),
    }));
  return {
    table,
    filters: builtFilters,
    order,
  };
};
