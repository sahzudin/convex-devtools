import { create } from 'zustand';

export interface FunctionInfo {
  name: string;
  path: string;
  type: 'query' | 'mutation' | 'action';
  args: ArgInfo[];
  returns?: string;
}

export interface ArgInfo {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
  enumValues?: string[];
}

export interface ModuleInfo {
  name: string;
  path: string;
  functions: FunctionInfo[];
  children: ModuleInfo[];
}

export interface SchemaInfo {
  modules: ModuleInfo[];
  tables: TableInfo[];
  lastUpdated: string;
}

export interface TableInfo {
  name: string;
  fields: FieldInfo[];
}

export interface FieldInfo {
  name: string;
  type: string;
  optional: boolean;
}

interface SchemaState {
  schema: SchemaInfo | null;
  isConnected: boolean;
  error: string | null;
  ws: WebSocket | null;
  connect: () => void;
  disconnect: () => void;
}

export const useSchemaStore = create<SchemaState>((set, get) => ({
  schema: null,
  isConnected: false,
  error: null,
  ws: null,

  connect: () => {
    const { ws: existingWs } = get();
    if (existingWs) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      set({ isConnected: true, error: null });
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'schema') {
          set({ schema: message.data });
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onerror = () => {
      set({ error: 'Connection error' });
    };

    ws.onclose = () => {
      set({ isConnected: false, ws: null });
      // Reconnect after 2 seconds
      setTimeout(() => {
        get().connect();
      }, 2000);
    };

    set({ ws });
  },

  disconnect: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
      set({ ws: null, isConnected: false });
    }
  },
}));
