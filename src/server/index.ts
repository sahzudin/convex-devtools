import cors from 'cors';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import { ConvexClient } from './convex-client.js';
import { PersistenceDb } from './persistence-db.js';
import { SchemaWatcher } from './schema-watcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ServerConfig {
  port: number;
  projectDir: string;
  convexUrl: string;
  deployKey: string;
  schemaWatcher: SchemaWatcher;
  persistencePath?: string;
}

export async function createServer(config: ServerConfig): Promise<http.Server> {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Serve static UI files in production
  const uiPath = path.join(__dirname, '..', 'ui');
  app.use(express.static(uiPath));

  // Create Convex client
  const convexClient = new ConvexClient(config.convexUrl, config.deployKey);

  // Shared persistence database (collections/history)
  const persistenceDb = await PersistenceDb.create(
    config.persistencePath ??
      path.join(config.projectDir, '.convex-devtools', 'devtools.sqlite')
  );

  // API Routes
  app.get('/api/schema', (_req, res) => {
    const schema = config.schemaWatcher.getSchema();
    if (!schema) {
      res.status(503).json({ error: 'Schema not yet loaded' });
      return;
    }
    res.json(schema);
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      convexUrl: config.convexUrl,
      projectDir: config.projectDir,
      projectName: path.basename(config.projectDir),
    });
  });

  app.get('/api/persistence', (_req, res) => {
    res.json(persistenceDb.getData());
  });

  app.put('/api/persistence', (req, res) => {
    const { collections, history, dataHistory } = req.body || {};
    persistenceDb.setData({
      collections: Array.isArray(collections) ? collections : [],
      history: Array.isArray(history) ? history : [],
      dataHistory: Array.isArray(dataHistory) ? dataHistory : [],
    });
    res.json({ success: true });
  });

  const devtoolsModulePath = path.join(
    config.projectDir,
    'convex',
    'devtools.ts'
  );

  const devtoolsModuleTemplate = `import { v } from "convex/values";
import { query } from "./_generated/server";

type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte";

export const runQuery = query({
  args: {
    table: v.string(),
    filters: v.optional(
      v.array(
        v.object({
          field: v.string(),
          op: v.string(),
          value: v.any(),
        })
      )
    ),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    limit: v.optional(v.number()),
    pagination: v.optional(
      v.object({
        cursor: v.union(v.string(), v.null()),
        numItems: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query(args.table as any);

    if (args.filters && args.filters.length > 0) {
      q = q.filter((qb) => {
        const expressions = args.filters!.map((filter) => {
          const field = qb.field(filter.field);
          switch (filter.op as FilterOp) {
            case "eq":
              return qb.eq(field, filter.value);
            case "neq":
              return qb.neq(field, filter.value);
            case "gt":
              return qb.gt(field, filter.value);
            case "gte":
              return qb.gte(field, filter.value);
            case "lt":
              return qb.lt(field, filter.value);
            case "lte":
              return qb.lte(field, filter.value);
            default:
              throw new Error(\`Unsupported filter op: \${filter.op}\`);
          }
        });

        if (expressions.length === 1) {
          return expressions[0];
        }

        return qb.and(...expressions);
      });
    }

    const ordered = args.order ? q.order(args.order) : q;

    if (args.pagination) {
      return await ordered.paginate({
        cursor: args.pagination.cursor,
        numItems: args.pagination.numItems,
      });
    }

    if (args.limit !== undefined) {
      return await ordered.take(args.limit);
    }

    return await ordered.collect();
  },
});
`;

  app.get('/api/devtools/status', (_req, res) => {
    res.json({
      installed: fs.existsSync(devtoolsModulePath),
      path: devtoolsModulePath,
    });
  });

  app.post('/api/devtools/install', (_req, res) => {
    if (fs.existsSync(devtoolsModulePath)) {
      res.json({ installed: true, alreadyExisted: true });
      return;
    }

    try {
      fs.writeFileSync(devtoolsModulePath, devtoolsModuleTemplate, 'utf-8');
      res.json({ installed: true, created: true });
    } catch (error: any) {
      res.status(500).json({
        installed: false,
        error: error?.message || 'Failed to write devtools module',
      });
    }
  });

  app.post('/api/devtools/query', async (req, res) => {
    const { table, filters, order, limit, pagination, jwtToken } =
      req.body || {};

    if (!table) {
      res.status(400).json({
        error: 'Missing table',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!config.deployKey) {
      res.status(403).json({
        error:
          'CONVEX_DEPLOY_KEY is required to run devtools queries. Set it in .env.local and restart DevTools.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!fs.existsSync(devtoolsModulePath)) {
      res.status(428).json({
        error:
          'Devtools query helper is not installed. Install it from the UI first.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const startTime = Date.now();
      const result = await convexClient.invoke(
        'devtools:runQuery',
        'query',
        {
          table,
          filters,
          order,
          limit,
          pagination,
        },
        { jwtToken }
      );
      const duration = Date.now() - startTime;

      let payload: unknown = result;

      if (
        payload &&
        typeof payload === 'object' &&
        'status' in (payload as Record<string, unknown>) &&
        (payload as { status?: string }).status === 'success' &&
        'value' in (payload as Record<string, unknown>)
      ) {
        payload = (payload as { value?: unknown }).value;
      }

      let pageInfo =
        payload &&
        typeof payload === 'object' &&
        'pageInfo' in (payload as Record<string, unknown>)
          ? (payload as { pageInfo?: unknown }).pageInfo
          : undefined;

      if (
        !pageInfo &&
        payload &&
        typeof payload === 'object' &&
        'continueCursor' in (payload as Record<string, unknown>)
      ) {
        const cursor = (payload as { continueCursor?: string | null })
          .continueCursor ?? null;
        const isDone = !!(payload as { isDone?: boolean }).isDone;
        pageInfo = { cursor, hasNextPage: !isDone };
      }

      const data =
        payload &&
        typeof payload === 'object' &&
        'page' in (payload as Record<string, unknown>)
          ? (payload as { page?: unknown }).page
          : payload;

      res.json({
        success: true,
        result: data,
        pageInfo,
        duration,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.json({
        success: false,
        error: {
          message: error.message,
          code: error.code,
          data: error.data,
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Invoke a function
  app.post('/api/invoke', async (req, res) => {
    const { functionPath, functionType, args, jwtToken } = req.body;

    if (!functionPath || !functionType) {
      res.status(400).json({ error: 'Missing functionPath or functionType' });
      return;
    }

    try {
      const startTime = Date.now();
      const result = await convexClient.invoke(
        functionPath,
        functionType,
        args || {},
        { jwtToken }
      );
      const duration = Date.now() - startTime;

      res.json({
        success: true,
        result,
        duration,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.json({
        success: false,
        error: {
          message: error.message,
          code: error.code,
          data: error.data,
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Create HTTP server
  const server = http.createServer(app);

  // WebSocket for real-time schema updates
  const wss = new WebSocketServer({ server, path: '/ws' });

  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    clients.add(ws);

    // Send initial schema
    const schema = config.schemaWatcher.getSchema();
    if (schema) {
      ws.send(JSON.stringify({ type: 'schema', data: schema }));
    }

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  // Broadcast schema updates
  config.schemaWatcher.on('schema-updated', (schema) => {
    const message = JSON.stringify({ type: 'schema', data: schema });
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  });

  // SPA fallback - serve index.html for non-API routes
  app.get('*', (_req, res) => {
    res.sendFile(path.join(uiPath, 'index.html'));
  });

  return new Promise((resolve) => {
    server.listen(config.port, () => {
      resolve(server);
    });
  });
}
