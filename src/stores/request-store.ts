import { create } from 'zustand';
import { FunctionInfo } from './schema-store';

export interface InvokeResponse {
  success: boolean;
  result?: unknown;
  error?: {
    message: string;
    code?: string;
    data?: unknown;
  };
  duration?: number;
  timestamp: string;
}

interface DraftState {
  args: string;
  response: InvokeResponse | null;
}

const DRAFTS_STORAGE_KEY = 'convex-devtools-drafts';
const RECENT_TABS_STORAGE_KEY = 'convex-devtools-recent-tabs';

// Load drafts from localStorage
const loadDrafts = (): Record<string, DraftState> => {
  try {
    const stored = localStorage.getItem(DRAFTS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore errors
  }
  return {};
};

// Save drafts to localStorage
const saveDrafts = (drafts: Record<string, DraftState>) => {
  try {
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // Ignore errors
  }
};

// Load recent tabs from localStorage
const loadRecentTabs = (): FunctionInfo[] => {
  try {
    const stored = localStorage.getItem(RECENT_TABS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore errors
  }
  return [];
};

// Save recent tabs to localStorage
const saveRecentTabs = (tabs: FunctionInfo[]) => {
  try {
    localStorage.setItem(RECENT_TABS_STORAGE_KEY, JSON.stringify(tabs));
  } catch {
    // Ignore errors
  }
};

interface RequestState {
  // Current request
  selectedFunction: FunctionInfo | null;
  args: string; // JSON string
  jwtToken: string; // JWT token for authentication
  projectName: string;

  // Response
  response: InvokeResponse | null;
  isLoading: boolean;
  isArgsValid: boolean;
  argsError?: string | null;

  // Drafts - persisted per function path
  drafts: Record<string, DraftState>;

  // Recent tabs - functions that have been run
  recentTabs: FunctionInfo[];

  // Actions
  setSelectedFunction: (func: FunctionInfo | null) => void;
  setArgs: (args: string) => void;
  setJwtToken: (token: string) => void;
  setProjectName: (name: string) => void;
  invoke: () => Promise<void>;
  setResponse: (response: InvokeResponse | null) => void;
  clearResponse: () => void;
  saveDraft: () => void;
  loadFromSaved: (
    func: FunctionInfo,
    args: string,
    response: InvokeResponse | null
  ) => void;
  addToRecentTabs: (func: FunctionInfo) => void;
  removeFromRecentTabs: (funcPath: string) => void;
}

export const useRequestStore = create<RequestState>((set, get) => ({
  selectedFunction: null,
  args: '{}',
  jwtToken: '',
  projectName: '',
  response: null,
  isLoading: false,
  isArgsValid: true,
  argsError: null,
  drafts: loadDrafts(),
  recentTabs: loadRecentTabs(),

  setSelectedFunction: (func) => {
    const {
      selectedFunction: currentFunc,
      args: currentArgs,
      response: currentResponse,
    } = get();

    // Save draft for the current function before switching
    if (currentFunc) {
      const drafts = { ...get().drafts };
      drafts[currentFunc.path] = {
        args: currentArgs,
        response: currentResponse,
      };
      saveDrafts(drafts);
      set({ drafts });
    }

    // Check if we have a saved draft for the new function
    const drafts = get().drafts;
    const draft = func ? drafts[func.path] : null;

    if (draft) {
      // Restore draft state
      set({
        selectedFunction: func,
        args: draft.args,
        response: draft.response,
        isArgsValid: true,
        argsError: null,
      });
      return;
    }

    // No draft - prepopulate args with smart default values (only REQUIRED arguments)
    if (func && Array.isArray(func.args) && func.args.length > 0) {
      const obj: Record<string, unknown> = {};
      func.args.forEach((a) => {
        // Special case: paginationOpts ALWAYS gets a default pagination object (even if optional)
        if (a.name === 'paginationOpts') {
          obj[a.name] = {
            cursor: null,
            numItems: 10,
          };
          return;
        }

        // Skip other optional parameters (user can add them via the arguments panel)
        if (a.optional) {
          return;
        }
        // Array types default to empty array
        else if (
          a.type.includes('[]') ||
          a.type.toLowerCase().includes('array')
        ) {
          obj[a.name] = [];
        }
        // Other types default to empty string for user to fill in
        else {
          obj[a.name] = '';
        }
      });
      set({
        selectedFunction: func,
        args: JSON.stringify(obj, null, 2),
        response: null,
        isArgsValid: true,
        argsError: null,
      });
    } else {
      set({
        selectedFunction: func,
        args: '{}',
        response: null,
        isArgsValid: true,
        argsError: null,
      });
    }
  },

  setArgs: (args) => {
    // Keep raw string but validate JSON
    try {
      JSON.parse(args);
      set({ args, isArgsValid: true, argsError: null });
      // Auto-save draft
      const { selectedFunction, response, drafts } = get();
      if (selectedFunction) {
        const updatedDrafts = {
          ...drafts,
          [selectedFunction.path]: { args, response },
        };
        saveDrafts(updatedDrafts);
        set({ drafts: updatedDrafts });
      }
    } catch (err: any) {
      set({
        args,
        isArgsValid: false,
        argsError: err?.message || 'Invalid JSON',
      });
    }
  },

  setJwtToken: (jwtToken) => set({ jwtToken }),

  setProjectName: (projectName) => set({ projectName }),

  invoke: async () => {
    const { selectedFunction, args, jwtToken, addToRecentTabs } = get();

    if (!selectedFunction) {
      return;
    }

    // Add to recent tabs when running
    addToRecentTabs(selectedFunction);

    set({ isLoading: true, response: null });

    try {
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(args);
      } catch {
        set({
          isLoading: false,
          response: {
            success: false,
            error: { message: 'Invalid JSON in arguments' },
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const response = await fetch('/api/invoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          functionPath: selectedFunction.path,
          functionType: selectedFunction.type,
          args: parsedArgs,
          jwtToken: jwtToken || undefined,
        }),
      });

      const data = await response.json();
      set({ response: data, isLoading: false });
    } catch (error: any) {
      set({
        isLoading: false,
        response: {
          success: false,
          error: { message: error.message || 'Request failed' },
          timestamp: new Date().toISOString(),
        },
      });
    }
  },

  setResponse: (response) => {
    set({ response, isLoading: false });
    // Auto-save draft with response
    const { selectedFunction, args, drafts } = get();
    if (selectedFunction) {
      const updatedDrafts = {
        ...drafts,
        [selectedFunction.path]: { args, response },
      };
      saveDrafts(updatedDrafts);
      set({ drafts: updatedDrafts });
    }
  },

  clearResponse: () => {
    set({ response: null });
    // Update draft to remove response
    const { selectedFunction, args, drafts } = get();
    if (selectedFunction) {
      const updatedDrafts = {
        ...drafts,
        [selectedFunction.path]: { args, response: null },
      };
      saveDrafts(updatedDrafts);
      set({ drafts: updatedDrafts });
    }
  },

  saveDraft: () => {
    const { selectedFunction, args, response, drafts } = get();
    if (selectedFunction) {
      const updatedDrafts = {
        ...drafts,
        [selectedFunction.path]: { args, response },
      };
      saveDrafts(updatedDrafts);
      set({ drafts: updatedDrafts });
    }
  },

  // Load from saved request - bypasses draft system to load exact saved state
  loadFromSaved: (func, args, response) => {
    const {
      selectedFunction: currentFunc,
      args: currentArgs,
      response: currentResponse,
    } = get();

    // Save draft for the current function before switching
    if (currentFunc) {
      const drafts = { ...get().drafts };
      drafts[currentFunc.path] = {
        args: currentArgs,
        response: currentResponse,
      };
      saveDrafts(drafts);
      set({ drafts });
    }

    // Load exact saved state (bypass draft restoration)
    set({
      selectedFunction: func,
      args,
      response,
      isArgsValid: true,
      argsError: null,
    });
  },

  addToRecentTabs: (func) => {
    const { recentTabs } = get();
    // Check if already present
    if (recentTabs.some((t) => t.path === func.path)) {
      return;
    }
    // Add to front, limit to 10 tabs
    const newTabs = [func, ...recentTabs].slice(0, 10);
    set({ recentTabs: newTabs });
    saveRecentTabs(newTabs);
  },

  removeFromRecentTabs: (funcPath) => {
    const { recentTabs } = get();
    const newTabs = recentTabs.filter((t) => t.path !== funcPath);
    set({ recentTabs: newTabs });
    saveRecentTabs(newTabs);
  },
}));
