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

interface RequestState {
  // Current request
  selectedFunction: FunctionInfo | null;
  args: string; // JSON string
  jwtToken: string; // JWT token for authentication

  // Response
  response: InvokeResponse | null;
  isLoading: boolean;
  isArgsValid: boolean;
  argsError?: string | null;

  // Actions
  setSelectedFunction: (func: FunctionInfo | null) => void;
  setArgs: (args: string) => void;
  setJwtToken: (token: string) => void;
  invoke: () => Promise<void>;
  clearResponse: () => void;
}

export const useRequestStore = create<RequestState>((set, get) => ({
  selectedFunction: null,
  args: '{}',
  jwtToken: '',
  response: null,
  isLoading: false,
  isArgsValid: true,
  argsError: null,

  setSelectedFunction: (func) => {
    // Prepopulate args with all parameter names as blank values
    if (func && Array.isArray(func.args) && func.args.length > 0) {
      const obj: Record<string, unknown> = {};
      func.args.forEach((a) => {
        obj[a.name] = '';
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
    } catch (err: any) {
      set({
        args,
        isArgsValid: false,
        argsError: err?.message || 'Invalid JSON',
      });
    }
  },

  setJwtToken: (jwtToken) => set({ jwtToken }),

  invoke: async () => {
    const { selectedFunction, args, jwtToken } = get();

    if (!selectedFunction) {
      return;
    }

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

  clearResponse: () => set({ response: null }),
}));
